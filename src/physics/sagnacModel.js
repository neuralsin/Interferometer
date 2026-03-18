/**
 * Sagnac Interferometer / Fibre-Optic Gyroscope (FOG) Physics
 *
 * The Sagnac effect: counter-propagating beams in a rotating loop
 * accumulate a phase difference proportional to the enclosed area
 * and angular velocity.
 *
 * Key equations:
 *   Δt = 4AΩ/c²                    — time difference
 *   ΔFringe = 4AΩ/(cλ)             — fringe shift
 *   CW speed:  C' = C - v           — in rotating frame
 *   CCW speed: C" = C + v           — in rotating frame
 *   v = Ω × R                       — tangential velocity
 *
 * Two methods for rotation values:
 *   Method 1 (area-based): ΔN = 4ΩA/(cλ),  Δt = 4ΩA/c²
 *   Method 2 (velocity):   Δt = L/(C-v) - L/(C+v)
 *
 * Reference: Sagnac, G. (1913). C.R. Acad. Sci. 157, 708–710.
 */

const C_LIGHT = 299792458; // m/s

/**
 * Compute the area of the Sagnac loop.
 * For a circular loop: A = π × R²
 * For N loops: A_total = N × π × R²
 *
 * @param {number} radius - Loop radius in meters
 * @param {number} numLoops - Number of loops (fiber coils)
 * @returns {number} Total enclosed area in m²
 */
export const loopArea = (radius, numLoops = 1) => {
  return numLoops * Math.PI * radius * radius;
};

/**
 * Compute the total loop perimeter length.
 * L = N × 2πR
 *
 * @param {number} radius - Loop radius in meters
 * @param {number} numLoops - Number of loops
 * @returns {number} Total path length in meters
 */
export const loopPerimeter = (radius, numLoops = 1) => {
  return numLoops * 2 * Math.PI * radius;
};

/**
 * Sagnac time difference (Equation 1 method).
 * Δt = 4AΩ/c²
 *
 * @param {number} area - Enclosed area (m²)
 * @param {number} omega - Angular velocity (rad/s)
 * @returns {number} Time difference in seconds
 */
export const sagnacTimeDiff = (area, omega) => {
  return (4 * area * Math.abs(omega)) / (C_LIGHT * C_LIGHT);
};

/**
 * Sagnac fringe shift (Equation 1 method).
 * ΔN = 4AΩ/(cλ)
 *
 * @param {number} area - Enclosed area (m²)
 * @param {number} omega - Angular velocity (rad/s)
 * @param {number} wavelength - Wavelength in meters
 * @returns {number} Fringe shift (dimensionless)
 */
export const sagnacFringeShift = (area, omega, wavelength) => {
  return (4 * area * Math.abs(omega)) / (C_LIGHT * wavelength);
};

/**
 * Sagnac time difference (Equation 2 method / velocity addition).
 * Δt = L/(C-v) - L/(C+v)
 * where v = ΩR (tangential velocity)
 *
 * @param {number} loopLength - Total path length (m)
 * @param {number} omega - Angular velocity (rad/s)
 * @param {number} radius - Loop radius (m)
 * @returns {number} Time difference in seconds
 */
export const sagnacTimeDiffVelocity = (loopLength, omega, radius) => {
  const v = Math.abs(omega) * radius;
  if (v >= C_LIGHT) return Infinity;
  return loopLength / (C_LIGHT - v) - loopLength / (C_LIGHT + v);
};

/**
 * Sagnac fringe shift (Equation 2 method).
 * Same result via velocity addition:
 * ΔN = [L/(C-v) - L/(C+v)] × C/λ
 *
 * @param {number} loopLength - Total path length (m)
 * @param {number} omega - Angular velocity (rad/s)
 * @param {number} radius - Loop radius (m)
 * @param {number} wavelength - Wavelength in meters
 * @returns {number} Fringe shift
 */
export const sagnacFringeShiftVelocity = (loopLength, omega, radius, wavelength) => {
  const dt = sagnacTimeDiffVelocity(loopLength, omega, radius);
  return (dt * C_LIGHT) / wavelength;
};

/**
 * CW and CCW speeds in the rotating frame.
 * CW:  C' = C - v
 * CCW: C" = C + v
 *
 * @param {number} omega - Angular velocity (rad/s)
 * @param {number} radius - Loop radius (m)
 * @returns {{ cw: number, ccw: number }}
 */
export const rotatingFrameSpeeds = (omega, radius) => {
  const v = Math.abs(omega) * radius;
  return {
    cw: C_LIGHT - v,
    ccw: C_LIGHT + v,
  };
};

/**
 * Round-trip times for CW and CCW beams.
 * t_CW  = L / (C - v)
 * t_CCW = L / (C + v)
 *
 * @param {number} loopLength - Total path length (m)
 * @param {number} omega - Angular velocity (rad/s)
 * @param {number} radius - Loop radius (m)
 * @returns {{ tCW: number, tCCW: number }}
 */
export const roundTripTimes = (loopLength, omega, radius) => {
  const v = Math.abs(omega) * radius;
  return {
    tCW: loopLength / (C_LIGHT - v),
    tCCW: loopLength / (C_LIGHT + v),
  };
};

/**
 * Compute all Sagnac values at once for display.
 *
 * @param {Object} params
 * @param {number} params.loopLength - Sagnac loop length (m)
 * @param {number} params.loopRadius - Loop radius (m)
 * @param {number} params.numLoops - Number of loops
 * @param {number} params.omega - Rotational velocity (rad/s)
 * @param {number} params.wavelength - Wavelength (m)
 * @param {number} params.refractiveIndex - Refractive index of medium
 * @returns {Object} All computed values
 */
export const computeSagnac = ({
  loopLength,
  loopRadius,
  numLoops = 1,
  omega = 1,
  wavelength = 632.8e-9,
  refractiveIndex = 1,
}) => {
  const A = loopArea(loopRadius, numLoops);
  const L = loopLength || loopPerimeter(loopRadius, numLoops);
  const v = Math.abs(omega) * loopRadius;
  const speeds = rotatingFrameSpeeds(omega, loopRadius);
  const trips = roundTripTimes(L, omega, loopRadius);

  // Method 1: area-based
  const dtMethod1 = sagnacTimeDiff(A, omega);
  const dnMethod1 = sagnacFringeShift(A, omega, wavelength);

  // Method 2: velocity-based
  const dtMethod2 = sagnacTimeDiffVelocity(L, omega, loopRadius);
  const dnMethod2 = sagnacFringeShiftVelocity(L, omega, loopRadius, wavelength);

  // Phase difference
  const phaseDiff = 2 * Math.PI * dnMethod1;
  const cosVal = (Math.cos(phaseDiff) + 1) / 2;
  const isConstructive = cosVal > 0.5;

  return {
    area: A,
    perimeter: L,
    tangentialVelocity: v,
    cwSpeed: speeds.cw,
    ccwSpeed: speeds.ccw,
    tCW: trips.tCW,
    tCCW: trips.tCCW,
    dtMethod1,
    dtMethod2,
    fringeShiftMethod1: dnMethod1,
    fringeShiftMethod2: dnMethod2,
    phaseDiff,
    cosVal,
    isConstructive,
    intensity: cosVal,
  };
};
