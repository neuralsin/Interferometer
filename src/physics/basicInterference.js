/**
 * Basic Interference Physics (Beginner Mode)
 * 
 * Uses the ideal two-beam interference equation:
 *   I(x,y) = 2 * I0 * [1 + cos(k * Δx)]
 * 
 * where k = 2π/λ and Δx is the optical path difference.
 * No noise, no coherence effects, no beam profile — pure pedagogy.
 */

/**
 * Calculate intensity at a single point given OPD.
 * @param {number} wavelength - Wavelength in meters
 * @param {number} opd - Optical path difference in meters
 * @param {number} i0 - Base intensity (default 1.0)
 * @returns {number} Normalized intensity 0–1
 */
export const calculateIntensity = (wavelength, opd, i0 = 1.0) => {
  const k = (2 * Math.PI) / wavelength;
  return 2 * i0 * (1 + Math.cos(k * opd));
};

/**
 * Generate a 2D fringe pattern array for the detector screen.
 * Models circular fringes from a simple plane-wave interferometer
 * with optional mirror tilt for straight-line fringes.
 *
 * @param {Object} params
 * @param {number} params.wavelength - λ in meters
 * @param {number} params.opdCenter - Central OPD in meters (2 * arm difference)
 * @param {number} params.tiltX - Mirror tilt about X axis (radians)
 * @param {number} params.tiltY - Mirror tilt about Y axis (radians)
 * @param {number} params.resolution - Grid size N (NxN)
 * @param {number} params.detectorSize - Physical detector size in meters (default 0.01)
 * @returns {Float32Array} Intensity values, row-major, length N*N
 */
export const generateFringePattern = ({
  wavelength,
  opdCenter,
  tiltX = 0,
  tiltY = 0,
  resolution = 256,
  detectorSize = 0.01,
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
      const opdLocal = opdCenter + 2 * (tiltX * x + tiltY * y);

      // Ideal interference: I = 2 I0 [1 + cos(k * Δ)]
      const intensity = 0.5 * (1 + Math.cos(k * opdLocal));

      data[j * N + i] = intensity;
    }
  }

  return data;
};

/**
 * Convert wavelength in meters to approximate visible color (hex string).
 * @param {number} wavelength - in meters
 * @returns {string} hex color string
 */
export const wavelengthToColor = (wavelength) => {
  const nm = wavelength * 1e9;
  let r = 0, g = 0, b = 0;

  if (nm >= 380 && nm < 440) {
    r = -(nm - 440) / (440 - 380);
    b = 1.0;
  } else if (nm >= 440 && nm < 490) {
    g = (nm - 440) / (490 - 440);
    b = 1.0;
  } else if (nm >= 490 && nm < 510) {
    g = 1.0;
    b = -(nm - 510) / (510 - 490);
  } else if (nm >= 510 && nm < 580) {
    r = (nm - 510) / (580 - 510);
    g = 1.0;
  } else if (nm >= 580 && nm < 645) {
    r = 1.0;
    g = -(nm - 645) / (645 - 580);
  } else if (nm >= 645 && nm <= 780) {
    r = 1.0;
  }

  // Intensity falloff at edges of visible spectrum
  let factor = 1.0;
  if (nm >= 380 && nm < 420) factor = 0.3 + 0.7 * (nm - 380) / (420 - 380);
  else if (nm >= 645 && nm <= 780) factor = 0.3 + 0.7 * (780 - nm) / (780 - 645);
  else if (nm < 380 || nm > 780) factor = 0.0;

  r = Math.round(255 * Math.pow(r * factor, 0.8));
  g = Math.round(255 * Math.pow(g * factor, 0.8));
  b = Math.round(255 * Math.pow(b * factor, 0.8));

  const hex = '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
  return hex;
};
