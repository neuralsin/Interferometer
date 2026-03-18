# Quantum Optics Simulator

A high-fidelity, real-time physics engine and web-based visualizer for advanced interferometry and quantum optics experiments. Features dynamic wave propagation, real-time fringe pattern rendering, and robust quantum state telemetry.

This project uses a hybrid architecture: a **React/Vite** frontend for a high-performance UI, and a **C++/WebAssembly** (WASM) physics backend for computationally intensive simulations (e.g., beam optics, noise generation, and coherence models).

---

## ⚡ Quick Start

If you have the prerequisites installed, run the following commands to get started immediately:

```bash
# 1. Install frontend dependencies
npm install

# 2. Build the WebAssembly physics engine
# Ensure you are in the emsdk environment before running this!
cd wasm
mkdir build && cd build
emcmake cmake ..
emmake make
cd ../..

# 3. Start the Vite development server
npm run dev
```

Visit `http://localhost:3000` to interact with the simulator.

---

## 🛠️ Prerequisites

To make the project development-ready, ensure you have the following installed on your system. Alternatively, you can refer to the `requirements.txt` file for a summary of system dependencies.

- **Node.js** (v18.0.0 or higher) & **npm**
- **CMake** (v3.14 or higher) - Required for configuring the C++ WASM builds.
- **Emscripten SDK (emsdk)** - Required to compile C++ to WebAssembly.
- **C++ Compiler** - GCC, Clang, or MSVC (depending on your OS).

---

## 📂 Project Structure

```text
├── src/                    # React Frontend Code
│   ├── physics/            # JS-based physics logic (fallback/bridges)
│   ├── shaders/            # GLSL WebGL shaders for rapid interference rendering
│   └── ui/                 # React components (Panels, Toggles, etc.)
├── wasm/                   # High-performance C++ Backend
│   ├── src/                # C++ source files (InterferometerEngine.cpp, etc.)
│   └── CMakeLists.txt      # Build configuration for Emscripten
├── public/                 # Static assets
├── index.html              # Vite entry point
├── package.json            # Node.js dependencies
├── requirements.txt        # High-level system dependencies list
└── vite.config.js          # Vite configuration including WASM + GLSL plugins
```

---

## 🔬 Supported Interferometers

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
- **Physics Demonstrated:** Relativistic phase shifts induced by rotation, speed of light observer differences.
- **Features:** Variable loop radius, number of loops, and tangential rotational velocity.

---

## 💻 Technical Stack & Architecture

- **Frontend Framework:** React (built with Vite)
- **State Management:** Zustand (Global zero-lag parameter mutation)
- **Styling:** Custom Vanilla CSS with Light/Dark mode theming (`[data-theme="light"]`). Glassmorphic UI overlays.
- **WebGL/Shaders:** Integrated via `vite-plugin-glsl` to power high-framerate fringe patterns natively on the GPU.
- **Rendering:** Heavily optimized HTML5 Canvas API arrays + Three.js synchronized with `requestAnimationFrame`.

## ⚙️ Physics Engines (Backend)

The simulation logic runs natively within the browser but is heavily driven by complex engines:
- **`InterferometerEngine.cpp` (WASM)**: Core entry point traversing the physics components bridging C++ structures and Javascript arrays.
- **`GaussianBeam.cpp` (WASM)**: Calculates Beam waist, Rayleigh range, and Gouy phase shifts.
- **`CoherenceModel.cpp` (WASM)**: Calculates visibility metrics, coherence lengths, and Lorentzian Power Spectral Density array generation.
- **`NoiseGenerator.cpp` (WASM)**: Seismic jitter models using Wiener Phase noise integration.
- **`quantumModel.js`**: Photon count estimations, Phase SNR (Signal-to-Noise Ratio), shot-noise limits, and squeezing factors.

---

## 👨‍💻 Development Workflow

### WebAssembly (C++) Development
Whenever modifying the C++ `.cpp` files in the `wasm/src/` folder, you must recompile the WASM module:

1. **Activate Emscripten**: Ensure `emsdk_env` is active in your terminal.
2. **Rebuild WASM**:
   ```bash
   cd wasm/build
   emmake make
   ```
   *Note: If you add new source files, run `emcmake cmake ..` before running `emmake make`.*
3. Vite's plugin will automatically reload your page utilizing the newly compiled `.js` and `.wasm` files.

### Frontend (React/GLSL) Development
For standard frontend tasks (UI changes, styling, GLSL shader tweaks):
- The `npm run dev` server features Hot Module Replacement (HMR). Changes to `src/**/*.jsx` or `src/shaders/**/*.frag` will reflect instantly without a full page reload.

## 🚀 Building for Production

Compile visually stunning setups to static asset bundles:

```bash
# 1. Build WASM backend (with -O3 optimizations inside CMakeLists.txt)
cd wasm/build
emmake make
cd ../..

# 2. Build Vite Frontend Bundle
npm run build
```

This will generate a `dist/` directory ready to be served over any static file server like Nginx, Apache, or Vercel.

## 📝 License

*(Add License Details Here)*
