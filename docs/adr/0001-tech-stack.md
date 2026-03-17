# ADR-0001: Technology Stack for Michelson Interferometer Simulab

## Status
Accepted

## Context
We need to build a dual-mode web application serving both as a pedagogical Michelson Interferometer visualization and a research-grade simulator (Simulab). Requirements include real-time 3D rendering at 60+ FPS, PhD-level precision physics, noise/quantum modeling, and an interactive Simlab experience with drag-and-drop optics. The application must run entirely in the browser.

## Decision Drivers
* **Real-time 3D rendering** with post-processing (bloom, FXAA)
* **High-precision physics** (Float64 for nm/pm calculations)
* **GPU-accelerated fringe computation** on the detector
* **Interactive controls** (drag optics, parameter sliders)
* **Modern, premium UI** with glassmorphism dark theme

## Considered Options
### Option 1: React + Vite + Three.js + Zustand + C++ Wasm (Emscripten)
- **Pros**: Tree-shaking via Vite, Three.js latest features (r170+), Zustand is minimal and fast, Wasm enables Float64 precision on hot paths
- **Cons**: Emscripten setup complexity, Wasm loading time

### Option 2: Vanilla JS + CDN Three.js (r128)
- **Pros**: No build step
- **Cons**: No tree-shaking, limited to r128 features, no OrbitControls, no post-processing imports

### Option 3: React Three Fiber (R3F) + Drei
- **Pros**: Declarative 3D, good React integration
- **Cons**: Abstraction overhead, less direct shader control for our custom fringe computation

## Decision
**Option 1**: React + Vite + Three.js + Zustand + C++ WebAssembly.

## Rationale
- Vite's GLSL plugin allows inline shader imports critical for our fringe and volumetric beam shaders.
- Three.js via npm (r170) gives access to OrbitControls, TransformControls, EffectComposer, and MeshPhysicalMaterial.
- Zustand is ~1KB, avoids Redux boilerplate, and provides direct `.getState()` access from the Three.js animation loop without React re-renders.
- C++ Wasm (Phase 2) unlocks Float64 precision for Gaussian beam propagation, FFT noise generation, and coherence calculations that would exceed JS precision limits.

## Consequences
### Positive
- Modern, optimized bundle with tree-shaking
- Full Three.js ecosystem available
- Clean separation: Zustand state → Three.js scene → GLSL shaders
### Negative
- Requires `npm install` and build step
- Emscripten C++ compilation adds to CI complexity
