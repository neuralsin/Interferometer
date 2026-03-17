/**
 * Gaussian Beam Propagation Module
 *
 * Computes the full complex electric field E(r,z) for a TEM00 Gaussian beam:
 *   E(r,z) = E0 * (w0/w(z)) * exp(-r²/w(z)²) * exp(-i[kz + kr²/(2R(z)) - ψ(z)])
 *
 * where:
 *   w(z)  = w0 * sqrt(1 + (z/zR)²)           — beam radius at z
 *   R(z)  = z * [1 + (zR/z)²]                 — radius of curvature
 *   ψ(z)  = atan(z/zR)                        — Gouy phase
 *   zR    = π * w0² / λ                       — Rayleigh range
 */

const TWO_PI = 2 * Math.PI;

/**
 * @param {number} w0 - Beam waist in meters
 * @param {number} wavelength - Wavelength in meters
 * @returns {number} Rayleigh range in meters
 */
export const rayleighRange = (w0, wavelength) =>
  Math.PI * w0 * w0 / wavelength;

/**
 * @param {number} w0 - Beam waist
 * @param {number} z - Propagation distance
 * @param {number} zR - Rayleigh range
 * @returns {number} Beam radius at z
 */
export const beamRadius = (w0, z, zR) =>
  w0 * Math.sqrt(1 + (z / zR) ** 2);

/**
 * @param {number} z - Propagation distance
 * @param {number} zR - Rayleigh range
 * @returns {number} Radius of curvature at z
 */
export const radiusOfCurvature = (z, zR) => {
  if (Math.abs(z) < 1e-15) return Infinity;
  return z * (1 + (zR / z) ** 2);
};

/**
 * @param {number} z - Propagation distance
 * @param {number} zR - Rayleigh range
 * @returns {number} Gouy phase at z
 */
export const gouyPhase = (z, zR) => Math.atan2(z, zR);

/**
 * Compute the complex electric field at point (r, z).
 *
 * @param {number} r - Radial distance from beam axis (meters)
 * @param {number} z - Propagation distance (meters)
 * @param {number} wavelength - λ (meters)
 * @param {number} w0 - Beam waist (meters)
 * @param {number} E0 - Peak amplitude (default 1.0)
 * @returns {{ re: number, im: number }} Complex field { real, imaginary }
 */
export const gaussianField = (r, z, wavelength, w0, E0 = 1.0) => {
  const k = TWO_PI / wavelength;
  const zR = rayleighRange(w0, wavelength);
  const wz = beamRadius(w0, z, zR);
  const Rz = radiusOfCurvature(z, zR);
  const psi = gouyPhase(z, zR);

  // Amplitude envelope
  const amplitude = E0 * (w0 / wz) * Math.exp(-(r * r) / (wz * wz));

  // Phase: kz + kr²/(2R) - ψ
  let phase = k * z - psi;
  if (isFinite(Rz)) {
    phase += k * r * r / (2 * Rz);
  }

  return {
    re: amplitude * Math.cos(phase),
    im: amplitude * Math.sin(phase),
  };
};

/**
 * Compute intensity |E|² at (r, z).
 */
export const gaussianIntensity = (r, z, wavelength, w0, E0 = 1.0) => {
  const f = gaussianField(r, z, wavelength, w0, E0);
  return f.re * f.re + f.im * f.im;
};
