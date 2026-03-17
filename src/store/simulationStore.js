import { create } from 'zustand';

/**
 * Complete Michelson Interferometer Simulation Store
 * All variables represent REAL physical quantities with research-level defaults.
 * No placeholders — every value is physically meaningful.
 *
 * Constants:
 *   c = 299792458 m/s
 *   h = 6.62607015e-34 J·s
 *   HeNe laser: λ = 632.8 nm
 */

const C_LIGHT = 299792458;
const H_PLANCK = 6.62607015e-34;

const DEFAULT_PARAMS = {
  /* ===== Mode ===== */
  isResearchMode: false,
  simulationPaused: false,

  /* ===== SOURCE ===== */
  wavelength:       632.8e-9,         // m — HeNe default
  beamWaist:        0.5e-3,           // m — beam waist w₀
  laserPower:       5e-3,             // W — 5 mW HeNe
  laserLinewidth:   1.5e9,            // Hz — frequency bandwidth Δν
  polarizationInput: 'horizontal',    // 'horizontal'|'vertical'|'diagonal'|'circular'

  /* ===== QUANTUM ===== */
  squeezingParam:   0.0,              // r — squeeze factor
  squeezingAngle:   0.0,              // rad — squeeze angle θ

  /* ===== MIRROR 1 (End mirror, X-arm) ===== */
  mirror1PosX:      0.175,            // m
  mirror1PosY:      0.015,            // m
  mirror1PosZ:      0.0,              // m
  mirror1Tip:       3e-4,             // rad — small default for visible fringes
  mirror1Tilt:      0.0,              // rad
  mirror1Reflectivity: 0.9995,        // HR mirror
  mirror1Transmissivity: 0.0005,
  mirror1Mass:      0.25,             // kg
  mirror1CTE:       0.55e-6,          // /K — fused silica
  mirror1TempDrift: 0.0,              // K/s

  /* ===== MIRROR 2 (End mirror, Y-arm) ===== */
  mirror2PosX:      0.0,              // m
  mirror2PosY:      0.015,            // m
  mirror2PosZ:     -0.175,            // m
  mirror2Tip:       2e-4,              // rad — slightly different for asymmetric fringes
  mirror2Tilt:      0.0,              // rad
  mirror2Reflectivity: 0.9995,
  mirror2Transmissivity: 0.0005,
  mirror2Mass:      0.25,             // kg
  mirror2CTE:       0.55e-6,          // /K
  mirror2TempDrift: 0.0,              // K/s

  /* ===== BEAM SPLITTER ===== */
  bsReflectivity:   0.5,              // 50:50
  bsTransmissivity: 0.5,
  bsThickness:      6.35e-3,          // m — ¼" plate
  bsRefractiveIndex:1.5168,           // BK7 @ 632.8nm
  bsDispersion:     64.17,            // Abbe V_d (BK7)
  bsWedgeAngle:     0.0,              // rad
  bsCoatingPhaseShift: 0.0,           // rad

  /* ===== COMPENSATOR PLATE ===== */
  compensatorEnabled: false,
  compensatorThickness: 6.35e-3,      // m
  compensatorRefractiveIndex: 1.5168,
  compensatorTiltAngle: 0.0,          // rad

  /* ===== ENVIRONMENT ===== */
  envRefractiveIndex: 1.000293,       // air at STP
  envPressure:       101325,          // Pa
  envTemperature:    293.15,          // K — 20°C
  envHumidity:       0.45,            // 45% RH

  /* ===== SEISMIC / ACOUSTIC ===== */
  seismicAmplitude:  1e-9,            // m
  seismicFrequency:  15.0,            // Hz
  acousticNoiseDensity: 1e-6,         // Pa/√Hz

  /* ===== NOISE ENABLES ===== */
  phaseNoiseEnabled:   false,
  seismicNoiseEnabled: false,
  thermalDriftEnabled: false,
  shotNoiseEnabled:    false,

  /* ===== GRAVITATIONAL WAVES ===== */
  gwEnabled:         false,
  gwStrain:          1e-21,           // h₀
  gwFrequency:       100.0,           // Hz
  gwPolarization:    'plus',          // 'plus'|'cross'

  /* ===== LIGO ANALYTICS ===== */
  celestialSource:   'bbh',
  mass1:             36,              // M☉
  mass2:             29,              // M☉
  gwArmLength:       4.0,             // km
  gwSimRunning:      false,

  /* ===== DETECTOR ===== */
  detectorDistance:   0.175,           // m
  detectorPixelPitch: 10e-6,          // m — 10μm
  detectorArrayWidth: 256,            // px
  detectorArrayHeight:256,            // px
  detectorQE:        0.9,             // 0–1
  detectorDarkCurrent:0.5,            // e⁻/px/s
  detectorReadNoise: 3.0,             // e⁻ RMS
  detectorExposureTime: 0.033,        // s

  /* ===== LEGACY COMPAT ===== */
  mountMaterial:     'invar',
};

const useSimulationStore = create((set, get) => ({
  ...DEFAULT_PARAMS,

  setParam: (key, value) => set({ [key]: value }),
  setMultipleParams: (params) => set(params),
  toggleResearchMode: () => set((s) => ({ isResearchMode: !s.isResearchMode })),
  resetToDefaults: () => set(DEFAULT_PARAMS),

  /* ===== DERIVED GETTERS (real physics) ===== */

  /** ν = c / λ */
  getFrequency: () => C_LIGHT / get().wavelength,

  /** Lc = c / Δν */
  getCoherenceLength: () => C_LIGHT / get().laserLinewidth,

  /** τc = 1 / Δν */
  getCoherenceTime: () => 1.0 / get().laserLinewidth,

  /** k = 2π / λ */
  getWavenumber: () => (2 * Math.PI) / get().wavelength,

  /** Φ = P·λ / (h·c) */
  getPhotonFlux: () => {
    const { laserPower, wavelength } = get();
    return (laserPower * wavelength) / (H_PLANCK * C_LIGHT);
  },

  /** Arm length from mirror1 position */
  getArmLengthX: () => {
    const { mirror1PosX, mirror1PosZ } = get();
    return Math.sqrt(mirror1PosX * mirror1PosX + mirror1PosZ * mirror1PosZ);
  },

  /** Arm length from mirror2 position */
  getArmLengthY: () => {
    const { mirror2PosX, mirror2PosZ } = get();
    return Math.sqrt(mirror2PosX * mirror2PosX + mirror2PosZ * mirror2PosZ);
  },

  /** OPD including BS compensation */
  getOPD: () => {
    const s = get();
    const armX = Math.sqrt(s.mirror1PosX ** 2 + s.mirror1PosZ ** 2);
    const armY = Math.sqrt(s.mirror2PosX ** 2 + s.mirror2PosZ ** 2);
    const bsOPD = s.compensatorEnabled ? 0 : (s.bsRefractiveIndex - 1) * s.bsThickness;
    return 2 * (armX - armY) + bsOPD;
  },
}));

export default useSimulationStore;
