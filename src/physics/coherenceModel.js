/**
 * Coherence Model Module
 *
 * Models spatial and temporal coherence of the laser source.
 *
 * The mutual coherence function γ₁₂(τ) determines fringe visibility:
 *   I(r,τ) = I1 + I2 + 2√(I1·I2) · |γ₁₂(τ)| · cos(Δφ + α(τ))
 *
 * For a Lorentzian lineshape laser, the coherence function is:
 *   γ(τ) = exp(-π · Δν · |τ|)
 *
 * For a Gaussian lineshape:
 *   γ(τ) = exp(-π² · Δν² · τ² / (4 ln2))
 *
 * Coherence length: Lc = c / Δν
 */

const C = 299792458; // speed of light m/s

/**
 * Coherence length from frequency bandwidth.
 * @param {number} deltaNU - Frequency bandwidth (Hz)
 * @returns {number} Coherence length (meters)
 */
export const coherenceLength = (deltaNU) => C / deltaNU;

/**
 * Coherence time from frequency bandwidth.
 * @param {number} deltaNU - Hz
 * @returns {number} Coherence time (seconds)
 */
export const coherenceTime = (deltaNU) => 1 / deltaNU;

/**
 * Mutual coherence function for a Lorentzian lineshape.
 * Returns the magnitude |γ(τ)| — the fringe visibility factor.
 *
 * @param {number} tau - Time delay between arms (seconds) = OPD / c
 * @param {number} deltaNU - Laser linewidth (Hz)
 * @returns {number} Visibility ∈ [0, 1]
 */
export const coherenceLorentzian = (tau, deltaNU) =>
  Math.exp(-Math.PI * deltaNU * Math.abs(tau));

/**
 * Mutual coherence function for a Gaussian lineshape.
 *
 * @param {number} tau - Time delay (seconds)
 * @param {number} deltaNU - Linewidth (Hz)
 * @returns {number} Visibility ∈ [0, 1]
 */
export const coherenceGaussian = (tau, deltaNU) =>
  Math.exp(-(Math.PI * Math.PI * deltaNU * deltaNU * tau * tau) / (4 * Math.LN2));

/**
 * Compute fringe visibility given OPD and laser linewidth.
 * Uses Lorentzian model (typical for HeNe, Nd:YAG).
 *
 * @param {number} opd - Optical path difference (meters)
 * @param {number} deltaNU - Laser linewidth (Hz)
 * @returns {number} Visibility ∈ [0, 1]
 */
export const fringeVisibility = (opd, deltaNU) => {
  const tau = Math.abs(opd) / C;
  return coherenceLorentzian(tau, deltaNU);
};

/**
 * Compute power spectral density (PSD) approximation.
 * For a Lorentzian line, PSD ~ Δν / (π * ((ν - ν0)² + (Δν/2)²))
 *
 * @param {number} nuOffset - Frequency offset from center (Hz)
 * @param {number} deltaNU - Full linewidth (Hz)
 * @returns {number} Normalized PSD value
 */
export const lorentzianPSD = (nuOffset, deltaNU) => {
  const halfWidth = deltaNU / 2;
  return (halfWidth / Math.PI) / (nuOffset * nuOffset + halfWidth * halfWidth);
};
