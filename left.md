# Unimplemented Features & Refactoring Audit
All items from this audit have been implemented. ✓

## 1. C++ WebAssembly Physics Engine (Research Mode) ✅
- [x] **Gaussian Beam Propagation** → `src/physics/gaussianBeam.js` + `wasm/src/GaussianBeam.h`
- [x] **Spatial & Temporal Coherence** → `src/physics/coherenceModel.js` + `wasm/src/CoherenceModel.h`
- [x] **Polarization (Jones Calculus)** → `src/physics/polarization.js` + store params added
- [x] **Stochastic Phase Noise** → `src/physics/noiseGenerator.js` (Wiener process)
- [x] **Environmental Noise** → `src/physics/noiseGenerator.js` (1/f pink + seismic)
- [x] **Detector Imperfections** → `src/physics/detectorModel.js` (shot noise, dark current, QE)
- [x] **Thermal Expansion** → `src/physics/thermalModel.js` (CTE database, OPD shift)
- [x] **Quantum Squeezing** → `src/physics/quantumModel.js` (SQL, Δφ_sqz)
- [x] **Gravitational Waves** → `src/physics/gravitationalWave.js` (sinusoidal + chirp)
- [x] **Wasm Infrastructure** → `wasm/CMakeLists.txt` + `wasm/src/InterferometerEngine.cpp`

## 2. WebGL / WebGPU Compute Shaders ✅
- [x] **GPU-accelerated Fringe Rendering** → `src/shaders/fringePattern.vert/frag` + `DetectorScreen.js` using `ShaderMaterial`

## 3. Interactive "Simulab" Experience ✅
- [x] **Drag & Drop Optics** → `TransformControls` in `SceneManager.jsx`
- [x] **Dynamic Snap-to-Grid** → 25mm `snapToGrid()` function
- [x] **Compensator Plates** → `src/scene/CompensatorPlate.js` (BK7 glass, optical path physics)

## 4. Advanced 3D Rendering & Shaders ✅
- [x] **Volumetric Raymarching Beam** → `src/shaders/volumetricBeam.vert/frag` + `LaserBeam.js` using `ShaderMaterial`

## 5. Data Export ✅
- [x] **Export Logic** → `src/physics/dataExport.js` (CSV, PNG, JSON) wired into Sidebar
