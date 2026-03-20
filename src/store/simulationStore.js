import { create } from 'zustand';
import { thermalOPDShift, MATERIAL_CTE } from '../physics/thermalModel.js';

/**
 * Complete Michelson Interferometer Simulation Store
 * All variables represent REAL physical quantities with research-level defaults.
 * No placeholders — every value is physically meaningful.
 *
 * Constants:
 *   c = 299792458 m/s
 *   h = 6.62607015e-34 J·s
 *   HeNe laser: λ = 632.8 nm
 */

const C_LIGHT = 299792458;
const H_PLANCK = 6.62607015e-34;

const DEFAULT_PARAMS = {
  /* ===== Mode ===== */
  isResearchMode: false,
  simulationPaused: false,
  interferometerType: 'mzi', // 'mzi' | 'michelson' | 'sagnac'

  /* ===== MICHELSON-SPECIFIC ===== */
  gasCellGas: 'air',       // 'air' | 'he' | 'ar'
  gasCellPressure: 1.0,     // atm
  gasCellLength: 0.05,      // m (5 cm)
  mirrorTilt: 0,            // mrad
  mirrorDisplacement: 0,    // μm — M2 position offset
  curvatureFactor: 0.5,
  waveAnimSpeed: 1.2,
  waveAnimAmplitude: 11,

  /* ===== SAGNAC-SPECIFIC ===== */
  sagnacLoopLength: 1000,       // m — total fiber loop length
  sagnacLoopRadius: 1.0,        // m — loop radius
  sagnacNumLoops: 159.15,       // number of loops (L / 2πR)
  sagnacOmega: 1.0,             // rad/s — rotational velocity

  /* ===== SOURCE ===== */
  wavelength: 632.8e-9,         // m — HeNe default
  beamWaist: 0.5e-3,           // m — beam waist w₀
  laserPower: 5e-3,             // W — 5 mW HeNe
  laserLinewidth: 1.5e9,            // Hz — frequency bandwidth Δν
  polarizationInput: 'horizontal',    // 'horizontal'|'vertical'|'diagonal'|'circular'

  /* ===== QUANTUM ===== */
  squeezingParam: 0.0,              // r — squeeze factor
  squeezingAngle: 0.0,              // rad — squeeze angle θ
  detectorExposureTime: 0.01,       // s — integration time for photon counts

  /* ===== MIRROR 1 (End mirror, X-arm) ===== */
  mirror1PosX: 0.175,            // m
  mirror1PosY: 0.015,            // m
  mirror1PosZ: 0.0,              // m
  mirror1Tip: 3e-4,             // rad — small default for visible fringes
  mirror1Tilt: 0.0,              // rad
  mirror1Reflectivity: 0.9995,        // HR mirror
  mirror1Transmissivity: 0.0005,
  mirror1Mass: 0.25,             // kg
  mirror1CTE: 0.55e-6,          // /K — fused silica
  mirror1TempDrift: 0.0,              // K/s

  /* ===== MIRROR 2 (End mirror, Y-arm) ===== */
  mirror2PosX: 0.0,              // m
  mirror2PosY: 0.015,            // m
  mirror2PosZ: -0.175,            // m
  mirror2Tip: 2e-4,              // rad — slightly different for asymmetric fringes
  mirror2Tilt: 0.0,              // rad
  mirror2Reflectivity: 0.9995,
  mirror2Transmissivity: 0.0005,
  mirror2Mass: 0.25,             // kg
  mirror2CTE: 0.55e-6,          // /K
  mirror2TempDrift: 0.0,              // K/s

  /* ===== BEAM SPLITTER ===== */
  bsReflectivity: 0.5,              // 50:50
  bsTransmissivity: 0.5,
  bsThickness: 6.35e-3,          // m — ¼" plate
  bsRefractiveIndex: 1.5168,           // BK7 @ 632.8nm
  bsDispersion: 64.17,            // Abbe V_d (BK7)
  bsWedgeAngle: 0.0,              // rad
  bsCoatingPhaseShift: 0.0,           // rad

  /* ===== COMPENSATOR PLATE ===== */
  compensatorEnabled: false,
  compensatorThickness: 6.35e-3,      // m
  compensatorRefractiveIndex: 1.5168,
  compensatorTiltAngle: 0.0,          // rad

  /* ===== ENVIRONMENT ===== */
  envRefractiveIndex: 1.000293,       // air at STP
  envPressure: 101325,          // Pa
  envTemperature: 293.15,          // K — 20°C
  envHumidity: 0.45,            // 45% RH

  /* ===== SEISMIC / ACOUSTIC ===== */
  seismicAmplitude: 1e-9,            // m
  seismicFrequency: 15.0,            // Hz
  acousticNoiseDensity: 1e-6,         // Pa/√Hz

  /* ===== NOISE ENABLES ===== */
  phaseNoiseEnabled: false,
  seismicNoiseEnabled: false,
  thermalDriftEnabled: false,
  shotNoiseEnabled: false,

  /* ===== GRAVITATIONAL WAVES ===== */
  gwEnabled: false,
  gwStrain: 1e-21,           // h₀
  gwFrequency: 100.0,           // Hz
  gwPolarization: 'plus',          // 'plus'|'cross'

  /* ===== LIGO ANALYTICS ===== */
  celestialSource: 'bbh',
  mass1: 36,              // M☉
  mass2: 29,              // M☉
  gwArmLength: 4.0,             // km
  gwSimRunning: false,

  /* ===== DETECTOR ===== */
  detectorDistance: 0.175,           // m
  detectorPixelPitch: 10e-6,          // m — 10μm
  detectorArrayWidth: 256,            // px
  detectorArrayHeight: 256,            // px
  detectorQE: 0.9,             // 0–1
  detectorDarkCurrent: 0.5,            // e⁻/px/s
  detectorReadNoise: 3.0,             // e⁻ RMS
  detectorExposureTime: 0.033,        // s

  /* ===== LEGACY COMPAT ===== */
  mountMaterial: 'invar',

  /* ===== COMPONENT ENABLES (toggleable in toolbar) ===== */
  m1Enabled: true,
  m2Enabled: true,
  bs2Enabled: true,

  /* ===== LIVE SIM COUNTS (from SceneManager particle sim) ===== */
  simD1: 0,
  simD2: 0,
  simFired: 0,
};

/**
 * Topology-aware OPD computation — SINGLE SOURCE OF TRUTH.
 * All components must use this instead of computing OPD locally.
 * Includes noise perturbations when enabled.
 *
 * @param {Object} state — full simulation store state
 * @returns {{ opd: number, phase: number, tiltFactor: number }}
 */
export const computeOPD = (state) => {
  const iType = state.interferometerType;

  // --- Noise perturbations (applied to Michelson & MZI, NOT Sagnac) ---
  let thermalOPD = 0;
  if (state.thermalDriftEnabled && iType !== 'sagnac') {
    const armX = Math.sqrt((state.mirror1PosX || 0) ** 2 + (state.mirror1PosZ || 0) ** 2);
    const armY = Math.sqrt((state.mirror2PosX || 0) ** 2 + (state.mirror2PosZ || 0) ** 2);
    const deltaT = state.envTemperature - 293.15;
    const passFactor = iType === 'michelson' ? 2 : 1;
    const alpha = MATERIAL_CTE[state.mountMaterial] || MATERIAL_CTE.invar;
    thermalOPD = passFactor * (armX - armY) * alpha * deltaT;
  }

  let seismicOPD = 0;
  if (state.seismicNoiseEnabled && iType !== 'sagnac') {
    // Simplified seismic: sinusoidal perturbation at seismicFrequency
    const t = Date.now() / 1000;
    const passFactor = iType === 'michelson' ? 2 : 1;
    seismicOPD = passFactor * state.seismicAmplitude * Math.sin(2 * Math.PI * state.seismicFrequency * t);
  }

  let gwOPD = 0;
  if (state.gwEnabled && iType !== 'sagnac') {
    const armX = Math.sqrt((state.mirror1PosX || 0) ** 2 + (state.mirror1PosZ || 0) ** 2);
    const t = Date.now() / 1000;
    const h = state.gwStrain * Math.sin(2 * Math.PI * state.gwFrequency * t);
    gwOPD = 2 * h * armX; // GW differential: + on X arm, - on Y arm
  }

  if (iType === 'michelson') {
    // Michelson: gas cell + mirror displacement (double-pass)
    const GAS = { air: { n0: 293e-6 }, he: { n0: 35e-6 }, ar: { n0: 281e-6 } };
    const gasN = 1 + (GAS[state.gasCellGas]?.n0 || 293e-6) * state.gasCellPressure;
    const gasOPD = 2 * (gasN - 1) * state.gasCellLength;
    const mirOPD = 2 * (state.mirrorDisplacement || 0) * 1e-6;
    return {
      opd: gasOPD + mirOPD + thermalOPD + seismicOPD + gwOPD,
      tiltFactor: 2,  // double-pass reflection
      tiltRad: state.mirrorTilt * 1e-3,  // mrad → rad
    };
  }

  // ── Environment Refractive Index (Edlén approximation) ──
  const index = 1 + 0.000293 * (state.envPressure / 101325) * (293.15 / state.envTemperature);

  if (iType === 'sagnac') {
    // Sagnac: phase from rotation, NOT a linear OPD
    const mediumWavelength = state.wavelength / index;
    const A = state.sagnacNumLoops * Math.PI * state.sagnacLoopRadius ** 2;
    const fringeShift = (4 * A * Math.abs(state.sagnacOmega)) / (C_LIGHT * mediumWavelength);
    const phase = 2 * Math.PI * fringeShift;
    return {
      opd: fringeShift * mediumWavelength, // effective OPD for display
      tiltFactor: 0,  // no tilt in Sagnac
      tiltRad: 0,
      sagnacPhase: phase,
    };
  }

  // MZI: compensator + drag geometry + noise
  const compensatorOPD = state.compensatorEnabled
    ? ((state.compensatorRefractiveIndex || 1.5168) - index) * (state.compensatorThickness || 0.00635)
    : 0;
  // Drag OPD from visual arm-length difference (SceneManager positions)
  const armX = Math.sqrt((state.mirror1PosX || 0) ** 2 + (state.mirror1PosZ || 0) ** 2);
  const armY = Math.sqrt((state.mirror2PosX || 0) ** 2 + (state.mirror2PosZ || 0) ** 2);
  const geometricOPD = index * (armX - armY); // single-pass for MZI
  return {
    opd: geometricOPD - compensatorOPD + thermalOPD + seismicOPD + gwOPD,
    tiltFactor: 1,  // single-pass transmission
    tiltRad: (state.mirror1Tip || 0) - (state.mirror2Tip || 0),
  };
};

/**
 * Compute tilt-averaged detection probability by 1D spatial integration.
 * Integrates cos²(δ/2 + k·θ·x) across the detector aperture.
 * This replaces the broken 0D point-math that ignores wavefront tilt.
 *
 * @param {Object} state — full simulation store state
 * @returns {{ p1: number, p2: number, visibility: number }}
 */
export const computeTiltAveragedProbability = (state) => {
  const { opd, tiltRad } = computeOPD(state);
  const k = (2 * Math.PI) / state.wavelength;
  const detSize = 0.01; // 10mm detector
  const halfSize = detSize / 2;
  const N_STEPS = 64;

  // Coherence visibility
  const cohVis = Math.exp(-Math.PI * Math.abs(opd) * state.laserLinewidth / C_LIGHT);

  if (Math.abs(tiltRad) < 1e-9) {
    // No tilt: standard point-math
    const delta = k * opd;
    const p1 = 0.5 * (1 + cohVis * Math.cos(delta));
    return { p1, p2: 1 - p1, visibility: cohVis };
  }

  // 1D spatial integral: average I(x) = 0.5*(1 + V*cos(k*opd + k*tiltFactor*tilt*x)) dx
  let sum = 0;
  for (let i = 0; i < N_STEPS; i++) {
    const x = -halfSize + (i / (N_STEPS - 1)) * detSize;
    const localPhase = k * opd + k * tiltRad * x;
    sum += 0.5 * (1 + cohVis * Math.cos(localPhase));
  }
  const p1 = sum / N_STEPS;
  return { p1, p2: 1 - p1, visibility: cohVis };
};

const useSimulationStore = create((set, get) => ({
  ...DEFAULT_PARAMS,

  setParam: (key, value) => set({ [key]: value }),
  setMultipleParams: (params) => set(params),
  toggleResearchMode: () => set((s) => ({ isResearchMode: !s.isResearchMode })),
  resetToDefaults: () => set(DEFAULT_PARAMS),
  incSimCount: (detector) => set((s) => ({
    [detector === 1 ? 'simD1' : 'simD2']: s[detector === 1 ? 'simD1' : 'simD2'] + 1,
    simFired: s.simFired + 1,
  })),
  resetSimCounts: () => set({ simD1: 0, simD2: 0, simFired: 0 }),

  /* ===== DERIVED GETTERS (real physics) ===== */

  /** ν = c / λ */
  getFrequency: () => C_LIGHT / get().wavelength,

  /** Lc = c / Δν */
  getCoherenceLength: () => C_LIGHT / get().laserLinewidth,

  /** τc = 1 / Δν */
  getCoherenceTime: () => 1.0 / get().laserLinewidth,

  /** k = 2π / λ */
  getWavenumber: () => (2 * Math.PI) / get().wavelength,

  /** Φ = P·λ / (h·c) */
  getPhotonFlux: () => {
    const { laserPower, wavelength } = get();
    return (laserPower * wavelength) / (H_PLANCK * C_LIGHT);
  },

  /** Arm length from mirror1 position */
  getArmLengthX: () => {
    const { mirror1PosX, mirror1PosZ } = get();
    return Math.sqrt(mirror1PosX * mirror1PosX + mirror1PosZ * mirror1PosZ);
  },

  /** Arm length from mirror2 position */
  getArmLengthY: () => {
    const { mirror2PosX, mirror2PosZ } = get();
    return Math.sqrt(mirror2PosX * mirror2PosX + mirror2PosZ * mirror2PosZ);
  },

  /** OPD — use the exported computeOPD(state) utility instead */
  getOPD: () => {
    const s = get();
    return computeOPD(s).opd;
  },
}));

export default useSimulationStore;
