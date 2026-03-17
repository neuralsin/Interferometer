import { create } from 'zustand';

const DEFAULT_PARAMS = {
  /* --- Mode --- */
  isResearchMode: false,

  /* --- Laser Source --- */
  wavelength: 632.8e-9,       // meters (HeNe default)
  laserPower: 5e-3,           // watts
  laserLinewidth: 1.5e9,      // Hz (frequency bandwidth)
  beamWaist: 0.5e-3,          // meters (w0)

  /* --- Arm Geometry --- */
  armLengthX: 0.15,           // meters
  armLengthY: 0.15,           // meters
  mirrorTiltX: 0.0,           // radians
  mirrorTiltY: 0.0,           // radians
  mirrorTranslationX: 0.0,    // meters (piezo offset from nominal)
  mirrorTranslationY: 0.0,    // meters

  /* --- Polarization (Jones Calculus) --- */
  polarizationInput: 'horizontal',  // 'horizontal' | 'vertical' | 'diagonal' | 'circular'
  polarizerAngle: 0.0,              // radians (output analyzer angle)
  compensatorEnabled: false,
  compensatorThickness: 0.003,      // meters
  compensatorRefractiveIndex: 1.5168, // BK7

  /* --- Environment --- */
  temperature: 293.15,        // kelvin
  temperatureDrift: 0.0,      // K/s
  mountMaterial: 'invar',     // 'invar' | 'aluminum' | 'steel'

  /* --- Noise Enables --- */
  phaseNoiseEnabled: false,
  seismicNoiseEnabled: false,
  thermalDriftEnabled: false,

  /* --- Quantum --- */
  shotNoiseEnabled: false,
  squeezingParam: 0.0,        // r (squeeze factor)

  /* --- Detector --- */
  detectorResolution: 256,    // N×N pixels
  darkCurrent: 0.0,           // electrons/pixel/s
  quantumEfficiency: 0.9,     // 0–1

  /* --- Gravitational Waves --- */
  gwEnabled: false,
  gwStrain: 1e-21,            // dimensionless h
  gwFrequency: 100.0,         // Hz
  armLengthMultiplier: 1.0,   // scale factor (1 = tabletop, 1e4+ = LIGO-scale)
};

const useSimulationStore = create((set, get) => ({
  ...DEFAULT_PARAMS,

  setParam: (key, value) => set({ [key]: value }),

  setMultipleParams: (params) => set(params),

  toggleResearchMode: () => set((state) => ({
    isResearchMode: !state.isResearchMode,
  })),

  resetToDefaults: () => set(DEFAULT_PARAMS),

  /** Derived: coherence length in meters */
  getCoherenceLength: () => {
    const { wavelength, laserLinewidth } = get();
    const c = 299792458;
    return c / laserLinewidth;
  },

  /** Derived: wavenumber k */
  getWavenumber: () => {
    const { wavelength } = get();
    return (2 * Math.PI) / wavelength;
  },

  /** Derived: optical path difference */
  getOPD: () => {
    const { armLengthX, armLengthY, mirrorTranslationX, mirrorTranslationY } = get();
    return 2 * ((armLengthX + mirrorTranslationX) - (armLengthY + mirrorTranslationY));
  },
}));

export default useSimulationStore;
