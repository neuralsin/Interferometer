import { generateFringePattern } from '../physics/basicInterference.js';
import { generateAdvancedFringePattern } from '../physics/advancedInterference.js';
import { computeOPD } from '../store/simulationStore.js';

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
 * Uses the central computeOPD engine for topology-aware OPD.
 *
 * @param {Object} state - Full Zustand store state
 * @param {number} elapsed - Elapsed time (seconds)
 * @returns {Float32Array} Intensity grid (N×N)
 */
export const computeFringePattern = (state, elapsed = 0) => {
  if (!state.isResearchMode) {
    const { opd, tiltFactor } = computeOPD(state);
    return generateFringePattern({
      wavelength: state.wavelength,
      opdCenter: opd,
      tiltX: state.mirror1Tip || 0,
      tiltY: state.mirror2Tip || 0,
      tiltFactor: tiltFactor,
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
