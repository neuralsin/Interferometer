/**
 * Advanced Interference Engine (Research Mode)
 *
 * Combines ALL physics models to produce a high-fidelity fringe pattern:
 *  1. Gaussian beam profile for both arms
 *  2. Partial coherence via mutual coherence function
 *  3. Thermal expansion OPD shift
 *  4. Phase noise (Wiener process)
 *  5. Seismic vibration displacement
 *  6. Gravitational wave strain
 *  7. Detector imperfections (shot noise, dark current, QE)
 *
 * Outputs a Float32Array of intensity values for the detector grid.
 */

import { gaussianField, rayleighRange, beamRadius } from './gaussianBeam.js';
import { fringeVisibility } from './coherenceModel.js';
import { wienerPhaseNoise, pinkNoise, seismicNoise } from './noiseGenerator.js';
import { thermalOPDShift } from './thermalModel.js';
import { sinusoidalStrain, gwPhaseShift } from './gravitationalWave.js';
import { photonCount, addQuantumPhaseNoise } from './quantumModel.js';
import { applyDetectorEffects } from './detectorModel.js';

const TWO_PI = 2 * Math.PI;
const C_LIGHT = 299792458;

// Pre-allocated noise buffers (regenerated periodically, not every frame)
let cachedPhaseNoise = null;
let cachedSeismicX = null;
let cachedSeismicY = null;
let noiseFrame = 0;
const NOISE_REGEN_INTERVAL = 60; // regenerate noise every 60 frames
const NOISE_SAMPLES = 512;
const NOISE_DT = 1 / 60;

/**
 * Generate the full research-mode fringe pattern.
 *
 * @param {Object} state - Full simulation state from Zustand store
 * @param {number} elapsed - Elapsed time in seconds (from THREE.Clock)
 * @returns {Float32Array} Intensity grid, length N*N, values ∈ [0,1]
 */
export const generateAdvancedFringePattern = (state, elapsed) => {
  const {
    wavelength, laserLinewidth, laserPower, beamWaist,
    mirror1PosX, mirror1PosZ, mirror2PosX, mirror2PosZ,
    mirror1Tip, mirror2Tip,
    envTemperature, mountMaterial,
    thermalDriftEnabled, phaseNoiseEnabled, seismicNoiseEnabled,
    shotNoiseEnabled, squeezingParam,
    detectorDarkCurrent, detectorQE,
    detectorArrayWidth,
    gwEnabled, gwStrain, gwFrequency,
  } = state;

  const armLengthX = Math.sqrt(mirror1PosX ** 2 + mirror1PosZ ** 2);
  const armLengthY = Math.sqrt(mirror2PosX ** 2 + mirror2PosZ ** 2);
  const N = detectorArrayWidth;
  const k = TWO_PI / wavelength;
  const detectorSize = 0.01; // 10mm detector
  const halfSize = detectorSize / 2;

  // ---- 1. Thermal OPD shift ----
  const deltaT = envTemperature - 293.15; // deviation from 20°C reference
  const thermalOPD = thermalDriftEnabled
    ? thermalOPDShift(armLengthX, armLengthY, deltaT, mountMaterial)
    : 0;

  // ---- 2. Noise buffers (regenerate periodically) ----
  if (noiseFrame % NOISE_REGEN_INTERVAL === 0 || !cachedPhaseNoise) {
    if (phaseNoiseEnabled) {
      cachedPhaseNoise = wienerPhaseNoise(NOISE_SAMPLES, NOISE_DT, laserLinewidth);
    }
    if (seismicNoiseEnabled) {
      cachedSeismicX = seismicNoise(NOISE_SAMPLES, NOISE_DT, 1e-9);
      cachedSeismicY = seismicNoise(NOISE_SAMPLES, NOISE_DT, 1e-9);
    }
  }
  noiseFrame++;

  // Current noise sample index (wrapping)
  const nIdx = Math.floor(elapsed / NOISE_DT) % NOISE_SAMPLES;

  // Phase noise contribution
  const phaseNoiseDelta = (phaseNoiseEnabled && cachedPhaseNoise)
    ? cachedPhaseNoise[nIdx]
    : 0;

  // Seismic displacement
  const seismicDx = (seismicNoiseEnabled && cachedSeismicX) ? cachedSeismicX[nIdx] : 0;
  const seismicDy = (seismicNoiseEnabled && cachedSeismicY) ? cachedSeismicY[nIdx] : 0;

  // ---- 3. GW strain ----
  const effectiveArmLength = armLengthX;
  let gwOPD = 0;
  if (gwEnabled) {
    const h = sinusoidalStrain(elapsed, gwStrain, gwFrequency);
    // Differential: ΔLx = +h/2 * L, ΔLy = -h/2 * L → total OPD = 2 * h * L
    gwOPD = 2 * h * effectiveArmLength;
  }

  // ---- 4. Effective arm lengths with all perturbations ----
  const effArmX = armLengthX + seismicDx;
  const effArmY = armLengthY + seismicDy;

  // ---- 5. Base OPD ----
  const baseOPD = 2 * (effArmX - effArmY) + thermalOPD + gwOPD;

  // ---- 6. Coherence visibility ----
  const visibility = fringeVisibility(baseOPD, laserLinewidth);

  // ---- 7. Photon count for quantum noise ----
  const N_photons = photonCount(laserPower, wavelength, 0.001);

  // ---- 8. Gaussian beam parameters ----
  const zR = rayleighRange(beamWaist, wavelength);
  const wzX = beamRadius(beamWaist, effArmX * 2, zR);
  const wzY = beamRadius(beamWaist, effArmY * 2, zR);

  // ---- 9. Generate fringe pattern ----
  const data = new Float32Array(N * N);

  for (let j = 0; j < N; j++) {
    const y = -halfSize + (j / (N - 1)) * detectorSize;
    for (let i = 0; i < N; i++) {
      const x = -halfSize + (i / (N - 1)) * detectorSize;

      // Radial distance for Gaussian envelope
      const r = Math.sqrt(x * x + y * y);

      // Gaussian amplitude envelopes for each arm
      const ampX = Math.exp(-(r * r) / (wzX * wzX));
      const ampY = Math.exp(-(r * r) / (wzY * wzY));

      // Local OPD variation from mirror tilt
      const opdLocal = baseOPD + 2 * (mirror1Tip * x + mirror2Tip * y);

      // Phase with noise
      let phase = k * opdLocal + phaseNoiseDelta;

      // Apply quantum phase noise if squeezing is active
      if (squeezingParam > 0 || shotNoiseEnabled) {
        phase = addQuantumPhaseNoise(phase, N_photons, squeezingParam);
      }

      // Interference with partial coherence:
      // I = I1 + I2 + 2√(I1·I2) · V · cos(Δφ)
      const I1 = ampX * ampX;
      const I2 = ampY * ampY;
      const interference = I1 + I2 + 2 * Math.sqrt(I1 * I2) * visibility * Math.cos(phase);

      // Normalize to [0, 1]
      data[j * N + i] = interference / 4.0;
    }
  }

  // ---- 10. Apply detector imperfections ----
  const finalData = applyDetectorEffects(data, {
    shotNoiseEnabled,
    darkCurrent: detectorDarkCurrent,
    quantumEfficiency: detectorQE,
    photonScale: N_photons,
  });

  return finalData;
};
