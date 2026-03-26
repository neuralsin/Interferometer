# Simulab Research: Quantum Interferometry Suite 

A comprehensive, physics-accurate simulation suite for quantum and classical interferometry. This web-based application allows researchers, academics, and engineers to explore wave optics, quantum metrology, and gravitational wave astronomy through real-time, mathematically rigorous simulations. The platform leverages a high-performance **WebAssembly (WASM) C++ physics engine** to compute complex stochastic noise models, phase space evolutions, and interference patterns at native speeds.

## 🚀 Core Features & Physics Models

### 1. Classical Interferometry & Wave Optics
Calculates exact Gaussian beam propagation dynamics, avoiding simplified ray-optics generalizations:
- **Gaussian Beam Profiling**: Live computation of the beam envelope $w(z) = w_0\sqrt{1+(z/z_R)^2}$, tracking the Rayleigh Range ($z_R$), Gouy Phase shift ($\psi = \arctan(z/z_R)$), far-field divergence ($\Delta\theta$), and Beam Parameter Product (BPP).
- **Michelson Interferometer**: High-fidelity optical layout tracing, adjustable arm lengths, mirror tilt/displacement, and gas cell insertion for refractive index experiments via Edlén equations.
- **Mach-Zehnder Interferometer (MZI)**: Emphasizes quantum superposition, true optical path differences, stochastic particle routing, and probabilistic beam splitting.
- **Sagnac Interferometer**: Clean loop geometry demonstrating the Sagnac effect, rotational phase shifts ($ \Delta\phi = \frac{8\pi A \Omega}{\lambda c} $), and active optical gyroscope principles.

### 2. Subatomic & Quantum Metrology
Moves beyond classical limits to explore the quantum mechanical constraints of measurement:
- **Quantum Fisher Information & Bounds**: Calculates exact Quantum Fisher Information (QFI = $N e^{2r} + \sinh^2(r)$) and absolute Cramer-Rao Lower Bounds (CRLB) for phase estimation.
- **Optomechanics & SQL**: Dynamically computes the Standard Quantum Limit (SQL) crossover frequency where high-frequency Shot Noise intersects with low-frequency Radiation Pressure fluctuations ($\delta F_{rad} = \sqrt{4\pi \hbar P / c\lambda} e^r$). 
- **Phase Space Analysis**: Real-time Wigner phase space plotting and squeeze ellipse visualization (Amplitude vs. Phase squeezing).
- **Precision Optimization**: Built-in Homodyne SNR optimizer and Frequency-Dependent Squeezing (FDS) calculators to dynamically track the best measurement quadratures.

### 3. Comprehensive Noise Engine (WASM-Powered)
Simulates realistic environmental and technical noise floors to bridge the gap between theory and hardware:
- **Power Spectral Density (PSD)**: Real-time FFT/PSD rendering of noise sources.
- **Wiener Phase Noise**: Simulates laser linewidth ($\Delta\nu$) drift via continuous random walk generators porting directly to a C++ WASM buffer.
- **Seismic & Thermal Drift**: Includes mechanical vibration injections and coating Brownian noise limits, calculating total RMS displacement and coherent time degradation.

### 4. Astronomical (LIGO GW Analytics)
- **Gravitational Wave Astronomy**: Simulates binary black hole (BBH) and neutron star (BNS) mergers using General Relativity formulas (Peters' formula, Thorne's estimates).
- **Time-Frequency Analysis**: Live Q-scan spectrogram showing the characteristic "chirp" signal ($f(t) \propto (t_c - t)^{-3/8}$).
- **Detector Telemetry**: Calculates expected chirp mass, orbital frequency at ISCO, final spin, and peak luminosity against true O3 observation matched-filter SNRs.

## 🛠 Tech Stack & Architecture

- **Frontend Environment**: React 18, Vite, HTML5 Canvas API
- **State Management**: Zustand (for 60+ interdependent physical metrics)
- **High-Performance Compute**: C++ compiled to WebAssembly (WASM) via Emscripten for heavy stochastics
- **Styling**: Vanilla CSS with comprehensive Design System tokens (Glassmorphism, Dark/Light modes)

## 🏁 Quick Start

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended), as well as [Emscripten](https://emscripten.org/) if you intend to recompile the WASM engines.

### Installation

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd qthack
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:5173`. *(Note: The pre-compiled WASM binaries in `public/` will load automatically).*

## 🧪 Physics Authenticity Guarantee
This simulation enforces strict adherence to physical reality. **Every single data point, label, and graph is derived from first principles.** 
You will not find static placeholders or "cosmetic" math. If the display shows an Optical Path Difference (OPD) of $-3.6 \text{ mm}$, it is because the exact geometric distance between the simulated canvas nodes, minus the compensator plate refractive delay, equals exactly $-3.6 \text{ mm}$. If coherence drops to 40%, it is because $\exp(-\pi \Delta L \Delta\nu / c) = 0.4$. 

## 📄 License
This project is open-source.
