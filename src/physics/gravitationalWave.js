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
 * Uses 0PN (leading-order) post-Newtonian waveform:
 *   h(t) ∝ Mc^(5/4) × τ^(-1/4) × sin(Φ(t))
 *   Φ(t) = -2 × (5 G Mc / c³)^(-5/8) × τ^(5/8)
 *   where τ = t_merge - t
 *
 * @param {number} t - Current time (seconds)
 * @param {number} h0 - Characteristic strain amplitude
 * @param {number} tMerge - Time of merger (seconds)
 * @param {number} m1Solar - Mass 1 in solar masses (default 30)
 * @param {number} m2Solar - Mass 2 in solar masses (default 25)
 * @returns {number} h(t)
 */
export const chirpStrain = (t, h0, tMerge, m1Solar = 30, m2Solar = 25) => {
  const tau = tMerge - t;
  if (tau <= 0) return 0;

  const G = 6.674e-11, Msun = 1.989e30, c = 3e8;
  const m1 = m1Solar * Msun, m2 = m2Solar * Msun;
  const Mtot = m1 + m2;
  // Chirp mass: Mc = (m1·m2)^(3/5) / (m1+m2)^(1/5)
  const Mc = Math.pow(m1 * m2, 3 / 5) / Math.pow(Mtot, 1 / 5);

  // Post-Newtonian phase: Φ(τ) = -2 × (τ / (5 G Mc / c³))^(5/8)
  const tScale = 5 * G * Mc / (c * c * c); // characteristic time = 5 G Mc / c³
  const phase = -2 * Math.pow(tau / tScale, 5 / 8);

  // Amplitude: h ∝ τ^(-1/4) (from inspiral quadrupole formula)
  const amplitude = h0 * Math.pow(tau, -0.25);
  // Clamp amplitude to prevent singularity near merger
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
