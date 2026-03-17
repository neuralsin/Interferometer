/**
 * Thermal Expansion Module
 *
 * Models micro-shifts in mirror positions due to temperature changes
 * via the coefficient of thermal expansion (CTE) α.
 *
 * ΔL = L × α × ΔT
 *
 * Material database:
 *   Invar:      α ≈ 1.2 × 10⁻⁶ /K
 *   Aluminum:   α ≈ 23  × 10⁻⁶ /K
 *   Steel:      α ≈ 17  × 10⁻⁶ /K
 *   Zerodur:    α ≈ 0.05× 10⁻⁶ /K
 *   Fused Silica: α ≈ 0.55× 10⁻⁶ /K
 */

export const MATERIAL_CTE = {
  invar:        1.2e-6,
  aluminum:     23e-6,
  steel:        17e-6,
  zerodur:      0.05e-6,
  fused_silica: 0.55e-6,
};

/**
 * Compute thermal length change.
 *
 * @param {number} length - Original length (meters)
 * @param {number} deltaT - Temperature change (K)
 * @param {string} material - Material key
 * @returns {number} ΔL in meters
 */
export const thermalExpansion = (length, deltaT, material = 'invar') => {
  const alpha = MATERIAL_CTE[material] || MATERIAL_CTE.invar;
  return length * alpha * deltaT;
};

/**
 * Compute the OPD shift caused by thermal drift on both arms.
 *
 * @param {number} armLengthX - Arm X length (meters)
 * @param {number} armLengthY - Arm Y length (meters)
 * @param {number} deltaT - Temperature change from reference (K)
 * @param {string} material
 * @returns {number} Additional OPD contribution (meters)
 */
export const thermalOPDShift = (armLengthX, armLengthY, deltaT, material = 'invar') => {
  const dLx = thermalExpansion(armLengthX, deltaT, material);
  const dLy = thermalExpansion(armLengthY, deltaT, material);
  return 2 * (dLx - dLy); // factor of 2 for double-pass
};
