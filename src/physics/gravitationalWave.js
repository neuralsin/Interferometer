/**
 * Gravitational Wave Module
 *
 * Simulates the effect of a passing gravitational wave on a
 * Michelson interferometer with arm length L.
 *
 * A GW with strain h(t) causes differential arm length changes:
 *   ΔLx = +½ h(t) L
 *   ΔLy = -½ h(t) L
 *
 * The resulting phase shift:
 *   Δφ_GW = (4π L / λ) × h(t)
 *
 * For a sinusoidal GW:
 *   h(t) = h₀ sin(2π f_GW t)
 *
 * For a chirp (binary merger):
 *   h(t) = h₀ × (t_merge - t)^(-1/4) × sin(φ(t))
 *   where φ(t) evolves with increasing frequency
 */

const TWO_PI = 2 * Math.PI;

/**
 * Sinusoidal GW strain at time t.
 *
 * @param {number} t - Time (seconds)
 * @param {number} h0 - Peak strain amplitude (dimensionless)
 * @param {number} fGW - GW frequency (Hz)
 * @returns {number} h(t)
 */
export const sinusoidalStrain = (t, h0, fGW) =>
  h0 * Math.sin(TWO_PI * fGW * t);

/**
 * Chirp GW strain simulating a compact binary merger.
 *
 * @param {number} t - Current time (seconds)
 * @param {number} h0 - Characteristic strain
 * @param {number} tMerge - Time of merger (seconds)
 * @param {number} f0 - Initial GW frequency (Hz)
 * @returns {number} h(t)
 */
export const chirpStrain = (t, h0, tMerge, f0 = 30) => {
  const dt = tMerge - t;
  if (dt <= 0) return 0;

  // Simplified chirp: frequency increases as dt^(-3/8), amplitude as dt^(-1/4)
  const amplitude = h0 * Math.pow(dt, -0.25);
  const freq = f0 * Math.pow(dt, -3 / 8);
  const phase = -2 * Math.pow(dt, 5 / 8) * TWO_PI * f0;

  // Clamp amplitude to prevent singularity
  const clampedAmp = Math.min(amplitude, h0 * 100);
  return clampedAmp * Math.sin(phase);
};

/**
 * Compute the GW-induced phase shift on the interferometer.
 *
 * @param {number} armLength - Physical arm length L (meters)
 * @param {number} wavelength - Laser wavelength λ (meters)
 * @param {number} strain - Current h(t) value
 * @returns {number} Δφ_GW (radians)
 */
export const gwPhaseShift = (armLength, wavelength, strain) =>
  (4 * Math.PI * armLength / wavelength) * strain;

/**
 * Compute GW-induced differential arm length changes.
 *
 * @param {number} armLength - Arm length L (meters)
 * @param {number} strain - h(t)
 * @returns {{ dLx: number, dLy: number }} Arm length changes
 */
export const gwArmChanges = (armLength, strain) => ({
  dLx: 0.5 * strain * armLength,
  dLy: -0.5 * strain * armLength,
});

/**
 * LIGO-scale sensitivity: compute minimum detectable strain.
 *
 * @param {number} armLength - Arm length (meters)
 * @param {number} wavelength - Laser wavelength (meters)
 * @param {number} photonCount - N
 * @param {number} squeezingParam - r
 * @returns {number} Minimum detectable strain h_min
 */
export const minDetectableStrain = (armLength, wavelength, photonCount, squeezingParam = 0) => {
  const phaseMin = Math.exp(-squeezingParam) / Math.sqrt(photonCount);
  return (phaseMin * wavelength) / (4 * Math.PI * armLength);
};
