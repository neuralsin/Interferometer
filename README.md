# Simulab Research: Quantum Interferometry Suite 

A comprehensive, physics-accurate simulation suite for quantum and classical interferometry. This web-based application allows researchers and students to explore wave optics, quantum metrology, and gravitational wave astronomy through real-time, mathematically rigorous simulations.

## 🚀 Features

### 1. Classical Interferometry (Wave Optics)
- **Michelson Interferometer**: High-fidelity optical layout tracing, adjustable arm lengths, mirror tilt/displacement, and gas cell insertion for refractive index experiments.
- **Mach-Zehnder Interferometer (MZI)**: Emphasizes quantum superposition, true optical path differences, and probabilistic beam splitting.
- **Sagnac Interferometer**: Clean pentagonal loop geometry for demonstrating the Sagnac effect, rotational phase shifts, and gyroscope principles.

### 2. Subatomic (Quantum Metrology)
- **Phase Space Analysis**: Real-time Wigner phase space plotting and squeeze ellipse visualization.
- **Quantum Noise Limits**: Live calculations for Shot Noise Limit (SQL), Squeezed Sensitivity, and the Heisenberg Limit.
- **Precision Optimization**: Built-in squeeze optimizer, calculating the exact required squeezing parameter (r) for maximum Signal-to-Noise Ratio (SNR).
- **Measurement Diagnostics**: Subatomic parameter readouts including displacement/strain precision, quantum state purity, and entanglement metrics.

### 3. Astronomical (LIGO GW Analytics)
- **Gravitational Wave Astronomy**: Simulates binary black hole (BBH) and neutron star (BNS) mergers using General Relativity formulas (Peters' formula, Thorne's estimates).
- **Detection Performance**: Computes matched filter SNR, detection horizons, and expected event rates based on LIGO O3 observation data.
- **Source Properties**: Calculates chirp mass, orbital frequency at ISCO, final spin (Boyle-Buonanno), and peak luminosity. 
- **Time-Frequency Analysis**: Live Q-scan spectrogram showing the characteristic "chirp" signal ($f(t) \propto (t_c - t)^{-3/8}$).
- **Noise Budgets**: Displays the realistic frequency-domain sensitivity curve.

## 🛠 Tech Stack

- **Frontend**: React 18, HTML5 Canvas API (for high-performance particle/wave rendering)
- **State Management**: Zustand
- **Build Tool**: Vite
- **Styling**: Vanilla CSS (with robust Dark/Light mode support)
- **Physics Engine**: Custom deterministic JS backend (`src/physics/`)

## 🏁 Quick Start

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

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

4. Open your browser to `http://localhost:5173`.

## 📂 Project Structure

```text
src/
├── physics/          # Core mathematical simulation engines
│   ├── quantumModel.js       # Squeezed states, shot noise, Heisenberg limit
│   ├── gravitationalWave.js  # GW strain, chirp evolution, source modeling
│   ├── basicInterference.js  # Coherence, wave superposition, fringe generation
│   └── sagnacModel.js        # Relativistic rotation phase shifts
├── ui/               # User Interface panels
│   ├── AnalyticsPanel.jsx    # Astronomical/LIGO research panel
│   ├── QuantumPanel.jsx      # Subatomic metrology panel
│   ├── BeginnerPanel.jsx     # Fringe visualizer 
│   ├── PhysicsNoisePanel.jsx # Environmental noise PSD configuration
│   └── BottomBar.jsx         # Live telemetry and data readouts
├── scene/            # Canvas-based optical layout renderers 
│   ├── MichelsonScene.jsx 
│   ├── SagnacScene.jsx
│   └── SceneManager.jsx      # Photon routing & MZI visualization
├── store/            # Global application state
│   └── simulationStore.js    # Single source of truth for 60+ physical metrics
└── App.jsx           # Main application shell and routing
```

## 🧪 Physics Accuracy
This simulation avoids placeholder or cosmetic data. Outputs such as the detection probability, noise floor PSD, and interferogram fringe geometry are derived strictly from first principles (e.g., $I \propto \cos^2(\Delta\phi/2)$, $\Delta\phi = 4\pi h L / \lambda$, $r_{opt} = \frac{1}{2}\ln(2\eta N)$).

## 📄 License
This project is open-source.
