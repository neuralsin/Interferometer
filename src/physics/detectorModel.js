/**
 * Detector Imperfections Module
 *
 * Models real-world sensor effects:
 * - Shot noise (Poisson statistics of photon arrival)
 * - Dark current (thermal electrons per pixel)
 * - Quantum efficiency (fraction of photons detected)
 */

import { gaussianRandom } from './noiseGenerator.js';

/**
 * Apply Poisson-distributed shot noise to an intensity value.
 * For large N, Poisson(N) ≈ Normal(N, √N).
 *
 * @param {number} intensity - Expected intensity (proportional to photon count)
 * @param {number} photonScale - Photons per unit intensity (controls SNR)
 * @returns {number} Noisy intensity
 */
export const applyShotNoise = (intensity, photonScale = 1e6) => {
  const expectedPhotons = intensity * photonScale;
  if (expectedPhotons <= 0) return 0;

  // Gaussian approximation for large N (valid when N > ~20)
  const noisyPhotons = expectedPhotons + gaussianRandom(0, Math.sqrt(expectedPhotons));
  return Math.max(0, noisyPhotons / photonScale);
};

/**
 * Apply dark current noise to a pixel value.
 * Dark current adds a constant background + Poisson fluctuation.
 *
 * @param {number} intensity - Clean intensity
 * @param {number} darkCurrent - Dark current rate (electrons/pixel/s)
 * @param {number} exposureTime - Exposure time (seconds)
 * @param {number} photonScale - Photons per unit intensity
 * @returns {number} Intensity with dark current added
 */
export const applyDarkCurrent = (intensity, darkCurrent, exposureTime = 0.033, photonScale = 1e6) => {
  const darkElectrons = darkCurrent * exposureTime;
  const darkNoise = darkElectrons + gaussianRandom(0, Math.sqrt(Math.max(darkElectrons, 1)));
  return intensity + Math.max(0, darkNoise) / photonScale;
};

/**
 * Apply quantum efficiency — simply scales the intensity.
 *
 * @param {number} intensity
 * @param {number} qe - Quantum efficiency [0, 1]
 * @returns {number}
 */
export const applyQuantumEfficiency = (intensity, qe) =>
  intensity * qe;

/**
 * Apply all detector imperfections to a full intensity grid.
 *
 * @param {Float32Array} data - Intensity values [0,1], length N*N
 * @param {Object} config
 * @param {boolean} config.shotNoiseEnabled
 * @param {number}  config.darkCurrent - e⁻/px/s
 * @param {number}  config.quantumEfficiency - [0,1]
 * @param {number}  config.photonScale - photons per unit intensity
 * @returns {Float32Array} Modified intensity array
 */
export const applyDetectorEffects = (data, config) => {
  const {
    shotNoiseEnabled = false,
    darkCurrent = 0,
    quantumEfficiency = 1.0,
    photonScale = 1e6,
  } = config;

  const result = new Float32Array(data.length);

  for (let i = 0; i < data.length; i++) {
    let val = data[i];

    // 1. Quantum efficiency
    val = applyQuantumEfficiency(val, quantumEfficiency);

    // 2. Shot noise
    if (shotNoiseEnabled) {
      val = applyShotNoise(val, photonScale);
    }

    // 3. Dark current
    if (darkCurrent > 0) {
      val = applyDarkCurrent(val, darkCurrent, 0.033, photonScale);
    }

    result[i] = Math.max(0, Math.min(1, val));
  }

  return result;
};
