/**
 * Basic Interference Physics
 *
 * Uses the partially-coherent two-beam interference equation:
 *   I(x,y) = I₁ + I₂ + 2√(I₁I₂) · V(Δ) · cos(k · Δ)
 *
 * where:
 *   k = 2π/λ
 *   V(Δ) = exp(-π · |Δ| · Δν / c)  — fringe visibility from source linewidth
 *   Δ = opdCenter + 2·(tiltX·x + tiltY·y)
 *
 * This properly models:
 *   - Linewidth reducing fringe contrast at large OPD
 *   - Mirror tilt producing straight-line fringes
 *   - Wavelength determining fringe spacing
 */

const C_LIGHT = 299792458;

/**
 * Fringe visibility from temporal coherence (Wiener-Khinchin).
 * For a Lorentzian line:  V = exp(-π·|Δ|·Δν/c)
 */
const temporalVisibility = (opd, linewidth) => {
  if (linewidth <= 0) return 1.0;
  return Math.exp(-Math.PI * Math.abs(opd) * linewidth / C_LIGHT);
};

/**
 * Calculate intensity at a single point given OPD.
 * Includes coherence envelope from linewidth.
 */
export const calculateIntensity = (wavelength, opd, linewidth = 0, i0 = 1.0) => {
  const k = (2 * Math.PI) / wavelength;
  const V = temporalVisibility(opd, linewidth);
  return i0 * (1 + V * Math.cos(k * opd));
};

/**
 * Generate a 2D fringe pattern with coherence effects.
 *
 * @param {Object} params
 * @param {number} params.wavelength - λ in meters
 * @param {number} params.opdCenter - Central OPD (2 × arm difference)
 * @param {number} params.tiltX - Mirror tilt about X (radians)
 * @param {number} params.tiltY - Mirror tilt about Y (radians)
 * @param {number} params.resolution - Grid N (N×N)
 * @param {number} params.detectorSize - Physical size (m), default 0.01
 * @param {number} params.linewidth - Source linewidth Δν (Hz), default 0
 * @returns {Float32Array} Intensity [0,1], length N×N
 */
export const generateFringePattern = ({
  wavelength,
  opdCenter,
  tiltX = 0,
  tiltY = 0,
  tiltFactor = 2, // 2 for double-pass (Michelson), 1 for single-pass (MZI)
  resolution = 256,
  detectorSize = 0.01,
  linewidth = 0,
}) => {
  const N = resolution;
  const k = (2 * Math.PI) / wavelength;
  const halfSize = detectorSize / 2;
  const data = new Float32Array(N * N);

  for (let j = 0; j < N; j++) {
    const y = -halfSize + (j / (N - 1)) * detectorSize;
    for (let i = 0; i < N; i++) {
      const x = -halfSize + (i / (N - 1)) * detectorSize;

      // OPD varies across detector due to mirror tilt
      // tiltFactor: 2 for double-pass reflection (Michelson), 1 for transmission (MZI)
      const opdLocal = opdCenter + tiltFactor * (tiltX * x + tiltY * y);

      // Visibility from coherence envelope
      const V = temporalVisibility(opdLocal, linewidth);

      // Partially-coherent interference:
      // I = 0.5 * (1 + V·cos(k·Δ))
      const intensity = 0.5 * (1 + V * Math.cos(k * opdLocal));

      data[j * N + i] = intensity;
    }
  }

  return data;
};

/**
 * Compute detection probabilities for both output ports.
 * Port 1 (constructive):  P₁ = cos²(δ/2)
 * Port 2 (destructive):   P₂ = sin²(δ/2)
 * where δ = k·OPD
 */
export const detectionProbabilities = (wavelength, opd) => {
  const delta = (2 * Math.PI / wavelength) * opd;
  const p1 = Math.cos(delta / 2) ** 2;
  const p2 = Math.sin(delta / 2) ** 2;
  return { p1, p2 };
};

/**
 * Convert wavelength in meters to approximate visible color (hex string).
 */
export const wavelengthToColor = (wavelength) => {
  const nm = wavelength * 1e9;
  let r = 0, g = 0, b = 0;

  if (nm >= 380 && nm < 440) { r = -(nm - 440) / (440 - 380); b = 1; }
  else if (nm >= 440 && nm < 490) { g = (nm - 440) / (490 - 440); b = 1; }
  else if (nm >= 490 && nm < 510) { g = 1; b = -(nm - 510) / (510 - 490); }
  else if (nm >= 510 && nm < 580) { r = (nm - 510) / (580 - 510); g = 1; }
  else if (nm >= 580 && nm < 645) { r = 1; g = -(nm - 645) / (645 - 580); }
  else if (nm >= 645 && nm <= 780) { r = 1; }

  let factor = 1.0;
  if (nm >= 380 && nm < 420) factor = 0.3 + 0.7 * (nm - 380) / (420 - 380);
  else if (nm >= 645 && nm <= 780) factor = 0.3 + 0.7 * (780 - nm) / (780 - 645);
  else if (nm < 380 || nm > 780) factor = 0;

  r = Math.round(255 * Math.pow(r * factor, 0.8));
  g = Math.round(255 * Math.pow(g * factor, 0.8));
  b = Math.round(255 * Math.pow(b * factor, 0.8));

  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
};
