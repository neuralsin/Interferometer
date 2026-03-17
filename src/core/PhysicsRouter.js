import { generateFringePattern } from '../physics/basicInterference.js';
import { generateAdvancedFringePattern } from '../physics/advancedInterference.js';

/**
 * PhysicsRouter — Conditional computation routing.
 *
 * isResearchMode === false → Basic JS interference (ideal two-beam)
 * isResearchMode === true  → Advanced JS engine (Gaussian beams, coherence,
 *                             noise, quantum, GW, detector imperfections)
 *                             OR Wasm engine if compiled and loaded.
 *
 * Returns a Float32Array of intensity values for the detector.
 */

let wasmEngine = null;
let wasmLoading = false;

/** Attempt lazy load of Wasm engine */
const loadWasmEngine = async () => {
  if (wasmEngine || wasmLoading) return wasmEngine;
  wasmLoading = true;
  try {
    // Uncomment when Wasm is compiled:
    // const Module = await import('/wasm/interferometer_engine.js');
    // wasmEngine = await Module.default();
    console.info('[PhysicsRouter] Wasm not available, using JS advanced engine.');
  } catch (err) {
    console.warn('[PhysicsRouter] Wasm load failed:', err);
  } finally {
    wasmLoading = false;
  }
  return wasmEngine;
};

/**
 * Compute fringe pattern from simulation state.
 *
 * @param {Object} state - Full Zustand store state
 * @param {number} elapsed - Elapsed time (seconds)
 * @returns {Float32Array} Intensity grid (N×N)
 */
export const computeFringePattern = (state, elapsed = 0) => {
  if (!state.isResearchMode) {
    const armX = Math.sqrt((state.mirror1PosX || 0) ** 2 + (state.mirror1PosZ || 0) ** 2);
    const armY = Math.sqrt((state.mirror2PosX || 0) ** 2 + (state.mirror2PosZ || 0) ** 2);
    const opd = 2 * (armX - armY);
    return generateFringePattern({
      wavelength: state.wavelength,
      opdCenter: opd,
      tiltX: state.mirror1Tip || 0,
      tiltY: state.mirror2Tip || 0,
      resolution: state.detectorArrayWidth || 256,
      detectorSize: 0.01,
      linewidth: state.laserLinewidth || 0,
    });
  }

  // Research mode: use advanced JS engine (or Wasm if available)
  if (wasmEngine) {
    // Future: call wasmEngine.calculateFringePattern(...)
  }

  return generateAdvancedFringePattern(state, elapsed);
};

export default computeFringePattern;
