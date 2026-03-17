/**
 * Quantum Optics Module
 *
 * Models quantum limits and squeezed-state enhancements:
 *
 * Shot Noise Limit (Standard Quantum Limit):
 *   Δφ_min = 1/√N
 *
 * Squeezed Vacuum State injection:
 *   Δφ_sqz = e^(-r) / √N
 *   where r = squeezing parameter
 *
 * Photon number from power and wavelength:
 *   N = P × t / (h × ν)  =  P × λ × t / (h × c)
 */

const H_PLANCK = 6.62607015e-34;  // J·s
const C_LIGHT = 299792458;         // m/s

/**
 * Compute expected photon count from laser parameters.
 *
 * @param {number} power - Laser power (W)
 * @param {number} wavelength - λ (m)
 * @param {number} integrationTime - Detector integration time (s)
 * @returns {number} Expected photon count N
 */
export const photonCount = (power, wavelength, integrationTime = 0.001) =>
  (power * wavelength * integrationTime) / (H_PLANCK * C_LIGHT);

/**
 * Standard quantum limit on phase sensitivity.
 *
 * @param {number} N - Photon count
 * @returns {number} Δφ_min (radians)
 */
export const shotNoiseLimit = (N) => {
  if (N <= 0) return Infinity;
  return 1 / Math.sqrt(N);
};

/**
 * Squeezed-state phase sensitivity.
 *
 * @param {number} N - Photon count
 * @param {number} r - Squeezing parameter (r=0 → standard, r>0 → squeezed)
 * @returns {number} Δφ_sqz (radians)
 */
export const squeezedSensitivity = (N, r) => {
  if (N <= 0) return Infinity;
  return Math.exp(-r) / Math.sqrt(N);
};

/**
 * Compute signal-to-noise ratio for a phase measurement.
 *
 * @param {number} phaseDiff - Measured phase difference (radians)
 * @param {number} N - Photon count
 * @param {number} r - Squeezing parameter
 * @returns {number} SNR = Δφ / Δφ_sqz
 */
export const phaseSNR = (phaseDiff, N, r = 0) => {
  const sensitivity = squeezedSensitivity(N, r);
  return Math.abs(phaseDiff) / sensitivity;
};

/**
 * Apply quantum phase noise to a phase value.
 * Adds uncertainty drawn from the quantum noise floor.
 *
 * @param {number} phase - Clean phase (radians)
 * @param {number} N - Photon count
 * @param {number} r - Squeezing parameter
 * @returns {number} Noisy phase
 */
export const addQuantumPhaseNoise = (phase, N, r = 0) => {
  const sigma = squeezedSensitivity(N, r);
  // Simple Gaussian approximation
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return phase + sigma * z;
};
