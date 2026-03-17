/**
 * Data Export Module
 * Exports simulation data to CSV, PNG, and JSON using REAL physics values.
 */

import { generateFringePattern, wavelengthToColor } from './basicInterference.js';

/**
 * Export fringe data as CSV.
 * @param {Object} state - Full simulation state from store
 */
export const exportCSV = (state) => {
  const armX = Math.sqrt(state.mirror1PosX ** 2 + state.mirror1PosZ ** 2);
  const armY = Math.sqrt(state.mirror2PosX ** 2 + state.mirror2PosZ ** 2);
  const opd = 2 * (armX - armY);

  const data = generateFringePattern({
    wavelength: state.wavelength,
    opdCenter: opd,
    tiltX: state.mirror1Tip,
    tiltY: state.mirror2Tip,
    resolution: state.detectorArrayWidth,
  });

  const N = state.detectorArrayWidth;
  let csv = '# Michelson Interferometer Simulab — CSV Export\n';
  csv += `# Wavelength: ${(state.wavelength * 1e9).toFixed(2)} nm\n`;
  csv += `# Power: ${(state.laserPower * 1e3).toFixed(3)} mW\n`;
  csv += `# OPD: ${(opd * 1e6).toFixed(4)} μm\n`;
  csv += `# Arm X: ${(armX * 1e3).toFixed(3)} mm\n`;
  csv += `# Arm Y: ${(armY * 1e3).toFixed(3)} mm\n`;
  csv += `# Detector: ${N}x${N} pixels\n`;
  csv += 'x,y,intensity\n';

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      csv += `${i},${j},${data[j * N + i].toFixed(6)}\n`;
    }
  }

  downloadFile(csv, 'interferogram_data.csv', 'text/csv');
};

/**
 * Export fringe pattern as PNG image.
 * @param {Object} state - Full simulation state from store
 */
export const exportImage = (state) => {
  const armX = Math.sqrt(state.mirror1PosX ** 2 + state.mirror1PosZ ** 2);
  const armY = Math.sqrt(state.mirror2PosX ** 2 + state.mirror2PosZ ** 2);
  const opd = 2 * (armX - armY);
  const N = state.detectorArrayWidth;

  const data = generateFringePattern({
    wavelength: state.wavelength,
    opdCenter: opd,
    tiltX: state.mirror1Tip,
    tiltY: state.mirror2Tip,
    resolution: N,
  });

  const canvas = document.createElement('canvas');
  canvas.width = N;
  canvas.height = N;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(N, N);

  const color = wavelengthToColor(state.wavelength);
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  for (let i = 0; i < data.length; i++) {
    const val = Math.max(0, Math.min(1, data[i]));
    imageData.data[i * 4]     = Math.round(r * val);
    imageData.data[i * 4 + 1] = Math.round(g * val);
    imageData.data[i * 4 + 2] = Math.round(b * val);
    imageData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'interferogram.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
};

/**
 * Export full simulation state as JSON.
 * @param {Object} state - Full simulation state from store
 */
export const exportJSON = (state) => {
  const armX = Math.sqrt(state.mirror1PosX ** 2 + state.mirror1PosZ ** 2);
  const armY = Math.sqrt(state.mirror2PosX ** 2 + state.mirror2PosZ ** 2);

  const exportData = {
    meta: {
      format: 'Simulab_v4.2_JSON',
      timestamp: new Date().toISOString(),
      engine: 'stochastic_v18.4.3',
    },
    source: {
      wavelength_m: state.wavelength,
      power_W: state.laserPower,
      linewidth_Hz: state.laserLinewidth,
      beamWaist_m: state.beamWaist,
      polarization: state.polarizationInput,
    },
    mirror1: {
      position_m: [state.mirror1PosX, state.mirror1PosY, state.mirror1PosZ],
      tip_rad: state.mirror1Tip,
      tilt_rad: state.mirror1Tilt,
      reflectivity: state.mirror1Reflectivity,
      mass_kg: state.mirror1Mass,
      CTE_perK: state.mirror1CTE,
    },
    mirror2: {
      position_m: [state.mirror2PosX, state.mirror2PosY, state.mirror2PosZ],
      tip_rad: state.mirror2Tip,
      tilt_rad: state.mirror2Tilt,
      reflectivity: state.mirror2Reflectivity,
      mass_kg: state.mirror2Mass,
      CTE_perK: state.mirror2CTE,
    },
    beamSplitter: {
      reflectivity: state.bsReflectivity,
      thickness_m: state.bsThickness,
      refractiveIndex: state.bsRefractiveIndex,
      wedgeAngle_rad: state.bsWedgeAngle,
    },
    environment: {
      temperature_K: state.envTemperature,
      pressure_Pa: state.envPressure,
      humidity: state.envHumidity,
      refractiveIndex: state.envRefractiveIndex,
    },
    detector: {
      quantumEfficiency: state.detectorQE,
      darkCurrent_ePxS: state.detectorDarkCurrent,
      readNoise_eRMS: state.detectorReadNoise,
      pixelPitch_m: state.detectorPixelPitch,
      arraySize: [state.detectorArrayWidth, state.detectorArrayHeight],
      exposureTime_s: state.detectorExposureTime,
    },
    derived: {
      armLengthX_m: armX,
      armLengthY_m: armY,
      opticalPathDifference_m: 2 * (armX - armY),
    },
    quantum: {
      squeezingParam: state.squeezingParam,
      squeezingAngle_rad: state.squeezingAngle,
      shotNoiseEnabled: state.shotNoiseEnabled,
    },
    gravitationalWave: {
      enabled: state.gwEnabled,
      strain: state.gwStrain,
      frequency_Hz: state.gwFrequency,
      polarization: state.gwPolarization,
    },
  };

  downloadFile(JSON.stringify(exportData, null, 2), 'simulation_state.json', 'application/json');
};

/** Helper to trigger file download */
const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
