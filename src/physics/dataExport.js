/**
 * Data Export Module
 *
 * Provides export of detector data as:
 * - CSV (raw intensity grid)
 * - Simulated TIFF (as downloadable binary blob)
 */

import { generateFringePattern } from './basicInterference.js';
import { generateAdvancedFringePattern } from './advancedInterference.js';

/**
 * Generate the current fringe data from simulation state.
 * @param {Object} state - Zustand store state
 * @param {number} elapsed - Elapsed time
 * @returns {Float32Array}
 */
const getCurrentFringeData = (state, elapsed = 0) => {
  if (state.isResearchMode) {
    return generateAdvancedFringePattern(state, elapsed);
  }

  const opd = 2 * ((state.armLengthX + state.mirrorTranslationX) -
                    (state.armLengthY + state.mirrorTranslationY));
  return generateFringePattern({
    wavelength: state.wavelength,
    opdCenter: opd,
    tiltX: state.mirrorTiltX,
    tiltY: state.mirrorTiltY,
    resolution: state.detectorResolution,
    detectorSize: 0.01,
  });
};

/**
 * Export fringe data as a CSV file.
 * Each row = one detector row, columns = pixel values.
 *
 * @param {Object} state - Simulation state
 */
export const exportCSV = (state) => {
  const N = state.detectorResolution;
  const data = getCurrentFringeData(state);

  let csv = '# Michelson Interferometer Simulab — Fringe Data Export\n';
  csv += `# Wavelength: ${state.wavelength * 1e9} nm\n`;
  csv += `# Resolution: ${N}x${N}\n`;
  csv += `# Mode: ${state.isResearchMode ? 'Research' : 'Beginner'}\n`;
  csv += `# OPD: ${(2 * ((state.armLengthX + state.mirrorTranslationX) - (state.armLengthY + state.mirrorTranslationY)) * 1e6).toFixed(4)} μm\n`;
  csv += '#\n';

  for (let j = 0; j < N; j++) {
    const row = [];
    for (let i = 0; i < N; i++) {
      row.push(data[j * N + i].toFixed(6));
    }
    csv += row.join(',') + '\n';
  }

  downloadBlob(csv, 'interferometer_fringes.csv', 'text/csv');
};

/**
 * Export fringe data as a simulated TIFF-like image.
 * Actually exports a PNG (universally readable) from a canvas.
 *
 * @param {Object} state - Simulation state
 */
export const exportImage = (state) => {
  const N = state.detectorResolution;
  const data = getCurrentFringeData(state);

  const canvas = document.createElement('canvas');
  canvas.width = N;
  canvas.height = N;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(N, N);

  for (let i = 0; i < N * N; i++) {
    const val = Math.round(Math.max(0, Math.min(1, data[i])) * 255);
    imageData.data[i * 4] = val;
    imageData.data[i * 4 + 1] = val;
    imageData.data[i * 4 + 2] = val;
    imageData.data[i * 4 + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  canvas.toBlob((blob) => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'interferometer_fringes.png';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, 'image/png');
};

/**
 * Export full simulation parameters as JSON.
 *
 * @param {Object} state - Simulation state
 */
export const exportJSON = (state) => {
  const exportData = {
    metadata: {
      application: 'Michelson Interferometer Simulab',
      exportDate: new Date().toISOString(),
      mode: state.isResearchMode ? 'Research' : 'Beginner',
    },
    parameters: {
      wavelength_m: state.wavelength,
      armLengthX_m: state.armLengthX,
      armLengthY_m: state.armLengthY,
      mirrorTranslationX_m: state.mirrorTranslationX,
      mirrorTranslationY_m: state.mirrorTranslationY,
      mirrorTiltX_rad: state.mirrorTiltX,
      mirrorTiltY_rad: state.mirrorTiltY,
      laserLinewidth_Hz: state.laserLinewidth,
      laserPower_W: state.laserPower,
      beamWaist_m: state.beamWaist,
      temperature_K: state.temperature,
      mountMaterial: state.mountMaterial,
      squeezingParam: state.squeezingParam,
      detectorResolution: state.detectorResolution,
      quantumEfficiency: state.quantumEfficiency,
      darkCurrent: state.darkCurrent,
    },
    noiseConfig: {
      phaseNoise: state.phaseNoiseEnabled,
      seismicNoise: state.seismicNoiseEnabled,
      thermalDrift: state.thermalDriftEnabled,
      shotNoise: state.shotNoiseEnabled,
    },
    gravitationalWave: {
      enabled: state.gwEnabled,
      strain: state.gwStrain,
      frequency_Hz: state.gwFrequency,
      armLengthMultiplier: state.armLengthMultiplier,
    },
  };

  const json = JSON.stringify(exportData, null, 2);
  downloadBlob(json, 'interferometer_config.json', 'application/json');
};

/** Helper: download a string/blob as a file */
const downloadBlob = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
