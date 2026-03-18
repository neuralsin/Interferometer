# Quantum Optics Simulator

A high-fidelity, real-time physics engine and web-based visualizer for advanced interferometry and quantum optics experiments. Features dynamic wave propagation, real-time fringe pattern rendering, and robust quantum state telemetry.

## Supported Interferometers

The simulator currently supports (or is in the process of supporting) three primary experimental setups, selectable from the top navigation bar:

### 1. Mach-Zehnder Interferometer (MZI)
A foundational amplitude-splitting interferometer.
- **Components:** Laser source, two beam splitters (BS1, BS2), and two fully reflective mirrors (M1, M2).
- **Physics Demonstrated:** Quantum superposition, single-photon interference, Phase density profiling.
- **Features:** 
  - Draggable, snappable components on a dynamic 2D canvas grid.
  - Component toggling (enabling/disabling mirrors or beam splitters to break interference paths).
  - High-speed statistical photon batch firing (x50, x500) representing probability amplitudes.

### 2. Michelson Interferometer
Developed from historical experiments mapping ether drift and refractive indices.
- **Components:** Laser, stationary half-silvered mirror (BS), fixed mirror (M1), adjustable mirror (M2), and an inserted Gas Cell.
- **Physics Demonstrated:** Refractometry via gas cell index properties, spatial coherence, constructive/destructive halos.
- **Features:**
  - Gas Cell Simulation: Swap between Air, Helium, and Argon with variable pressure (atm) and cell length modifying the speed of light ($v = c/n$) in the path.
  - Dedicated Wave Propagation Canvas and Fringe Canvas.
  - Granular control over mirror displacement ($\Delta d$) down to $\mu m$ ranges.

### 3. Sagnac Interferometer (Fibre-Optic Gyroscope)
*(In Development - Phase 2)*
A rotational loop interferometer demonstrating the Sagnac effect, foundational for modern optical gyroscopes.
- **Components:** Rotating disk platform, fiber loops (or polygonal mirror paths), CW and CCW laser paths, detector.
- **Physics Demonstrated:** Relativistic phase shifts induced by rotation, $C'$ and $C''$ speed of light observer differences.
- **Features:** Variable loop radius, number of loops, and tangential rotational velocity.

---

## Technical Stack & Architecture
- **Frontend Framework:** React (Vite)
- **State Management:** Zustand (Global zero-lag parameter mutation)
- **Styling:** Custom Vanilla CSS with Light/Dark mode theming (`[data-theme="light"]`). Glassmorphic UI overlays.
- **Rendering:** Highly optimized HTML5 Canvas API arrays with requestAnimationFrame loop synchronization. 

## Physics Engines (Backend)
- `basicInterference.js`: Core fringe generation, wavelength color scaling, OPD detection probabilities.
- `coherenceModel.js`: Visibility metrics, coherence length calculation, and Lorentzian Power Spectral Density arrays.
- `gaussianBeam.js`: Beam waist, Rayleigh range, Gouy phase shifts.
- `noiseGenerator.js`: Seismic jitter models, Wiener Phase noise integration.
- `quantumModel.js`: Photon count estimations, Phase SNR (Signal-to-Noise Ratio), shot-noise limits, and squeezing factors.
