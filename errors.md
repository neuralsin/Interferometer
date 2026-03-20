# Deep System-Level Audit: Errors and Bug Report

This file systematically tracks all bugs, placeholder data, misaligned values, and logical errors found during a top-to-bottom codebase review.

## 1. Store & Core Routing
- **[simulationStore.js]** `getOPD()` is defined but NEVER used. Furthermore, its formula `2 * (armX - armY) + bsOPD` hardcodes a 2x multiplier (Michelson round-trip), which makes it completely incorrect if called while in `mzi` or `sagnac` modes. Should be removed or refactored.
- **[PhysicsRouter.js]** `computeFringePattern` falls back to `basicInterference` for `isResearchMode===false`. In its basic branch (lines 43-55), it computes `opd = 2 * (armX - armY)`. This hardcodes the Michelson 2x geometry again, and ignores compensator OPD or tip completely, guaranteeing wrong fringes for MZI and Sagnac in beginner mode.

## 2. Physics Engines
- **[basicInterference.js]** `generateFringePattern` hardcodes `2 * (tiltX * x)` for wavefront tilt. This assumes a reflection geometry (Michelson). For transmission geometries (MZI), the path difference from tilt is just `1 * tilt * x`. Thus, if MZI passes data here, fringes are drawn incorrectly.
- **[advancedInterference.js]** Entirely hardcoded to Michelson physics (`baseOPD = 2 * (effArmX - effArmY) + ...`). If research mode is active and the interferometer is `mzi` or `sagnac`, the detector screen will display Michelson physics instead of the selected interferometer's physics.
- **[thermalModel.js]** `thermalOPDShift` hardcodes `2 * (dLx - dLy)`. This factor of 2 is only correct for double-pass (Michelson).
- **[dataExport.js]** The `exportCSV`, `exportImage`, and `exportJSON` functions explicitly calculate OPD as `2 * (armX - armY)` and always call `generateFringePattern`. If a user is viewing an MZI or Sagnac interferometer and clicks 'Export', the application will export Michelson data and Michelson fringes instead of what's currently on screen. This is a severe data-integrity bug.

## 3. UI Panels & Bindings
- **[BeginnerPanel.jsx] Hardcoded Partial Physics:** The interferogram canvas explicitly hardcodes `opd = 2 * (armX - armY)`, bypassing the store and ignoring `gasCellLength`, `gasCellPressure`, `thermalDrift`, MZI `compensator`, and even `mirrorDisplacement`. Modifying these parameters affects the main canvas but the BeginnerPanel interferogram remains utterly static.
- **[BottomBar.jsx] Sagnac Forgery:** The `BottomBar` calculates its down `opd` and forces it to `0` for `interferometerType === 'sagnac'`. This means the bottom thumbnail interferogram for the Sagnac FOG is completely static and cosmetic, ignoring rotation (`sagnacOmega`). It never shifts fringes.
- **[App.jsx] The 4th Physics Engine & Overlay Forgery:** The `<DetectionOverlay>` component in `App.jsx` implements yet another, completely distinct version of OPD. In Michelson, it assumes `mTotalOPD = mGasOPD + mMirOPD` completely ignoring `armX` and `armY` differences! In MZI, it computes `-compensatorOPD` and ignores mirror movements. It then explicitly overrides P(constructive) and Visibility. This text overlay physically conflicts with the scene canvases and the bottom bars.
- **[AnalyticsPanel.jsx] & [QuantumPanel.jsx] Mathematical Isolation:** While these panels use correct equations (drawn from `quantumModel.js` and `gravitationalWave.js`), they run their own isolated pseudo-simulations. E.g., `AnalyticsPanel` computes matched-filter GW strain SNR without interacting with the 2D scene detector; it is essentially a high-quality calculator widget painted on top of a disconnected UI, not driven by or driving the visual interferogram.
- **[Physics Desync Systemic Issue]:** There is zero single source of truth for OPD. `BottomBar`, `BeginnerPanel`, `SceneManager`, `MichelsonScene`, `App.jsx (DetectionOverlay)`, `advancedInterference.js`, and `dataExport` ALL implement their own, completely incompatible versions of the Optical Path Difference.
- **Fake Research Mode:** Sliders for "Gravitational Waves", "Phase Noise", "Seismic Vibration", and "Thermal Drift" modify state, but none of these perturbations are routed to the 2D detector plots, density profiles, or main scene animations. They are essentially cosmetic UI toggles disconnected from the visualizations (because the visuals bypass `advancedInterference.js`).

## 4. Scene Renderers (Canvas/3D/Pathing)
- **Dead Code (3D Engine & Shaders):** The files `LaserBeam.js`, `Mirror.js`, `BeamSplitter.js`, `CompensatorPlate.js`, `DetectorScreen.js`, `OpticalTable.js`, and all files in `src/shaders/` (`fringePattern.frag/vert`, `volumetricBeam.frag/vert`) contain hundreds of lines of `THREE.js` mesh and WebGL shader generation. However, a global search reveals they are **never imported or instantiated** anywhere in the application. The app relies entirely on the 2D `Canvas API` implementations.
- **Physics Desync in Visuals:** `MichelsonScene.jsx` and `SceneManager.jsx` (MZI) manually re-calculate base OPD and interference for their visual photon dots / beam animations, completely bypassing `advancedInterference.js`. Consequently, if a user enables Seismic Noise or Gravitational Waves, the visual detector flash and beam intensity in the 2D view will **not reflect** the perturbations, remaining perfectly static.

## 5. Main Application & CSS
- **Static Header Bug**: The top-left application header ("MICHELSON INTERFEROMETER SUITE V4.2") is static. It does not update its text when the user switches to Mach-Zehnder or Sagnac modes.
- **Variable Name Leakage**: Several user-facing labels and buttons use internal variable naming conventions (snake_case) rather than polished UI labels (e.g., `RESET_DEFAULTS`, `STABLE_OSCILLATION`).
- **Button Duplication & Clipping**: In Research Mode, the "RESET_DEFAULTS" button appears twice. The instance in the Quantum panel is partially clipped at the bottom of its container.
- **Missing Interactivity Cues**: The header icons for Gravitational Waves, Noise, and Temperature lack tooltips or hover states.
- **Text Overlap & Data Wrapping**: In the Phase Density Profile, the "Gas OPD" value (~29300.00 nm) significantly overlaps its unit ("nm") and the label below it. The temporal value `Δt` wraps incorrectly, overlapping its container. In the Sagnac overlay, CW/CCW speed values are poorly aligned, and the "Destructive" status pill partially overlaps the "ΔN" value box.
- **Astronomical (LIGO) Panel Visuals**: Red threshold text `ρ=8 threshold` overlaps the axis labels. The "Sensitivity Curve" graph has extremely low contrast, making lines difficult to distinguish.
- **LIGO Magnitude Failures (Fake Math)**: The Horizon distance is calculated as `8.32e+19 Gpc` (larger than universe), and Event Rate is `~5.7e+61 /yr` (impossible). SNR Calculation is negative (`-27.7 dB`) indicating inverted math or wrong log scaling.
- **Quantum & Wave Optics Extreme Values**: The Σ-LEVEL shows `49,716,766.27 σ` (impossible for coherent state). Phase Noise Integral shows `~281,000 rad RMS` (would cause complete decoherence).
- **Placeholder Visuals**: The "Detector Output Stream" in the beginner panel is a purely cosmetic static circular design overlaying a canvas, rather than rendering an actual scoped stream as implied.

## 6. Real-Time Simulation Binding & Logic Failures
- **Stuck Probabilities (Michelson & MZI)**: In the 'Detected Counts / Michelson Data' overlays, **P(constr)** and **P(destr)** are hard-stuck (e.g., at 9.3% and 90.7%) and completely ignore the `Mirror 1 Tip` and `Mirror 2 Tip` sliders. Even when "Animate tilt" is running, the probabilities do not budge, proving the math model in the overlay is disjointed from the physical ray geometry.
- **Linewidth Disconnect**: Adjusting the `Laser Linewidth` scalar (e.g., to 1500 MHz) has zero effect on the output. `Visibility` stays locked at 100.0% and `Coherence` stays locked at 99.95%, violating fundamental temporal coherence geometry.
- **Missing Sagnac & MZI UI Controls**: The manual **'Rotational Velocity Ω_Sagnac'** slider is entirely absent from the DOM, meaning rotation can only be altered via a hard-coded auto-animator button. Similarly, the **'Compensator Plate Thickness'** slider for MZI is entirely missing from the Research UI.
- **Static Pattern Canvases**: The `Interferogram` and `Phase Density Profile` canvases do not reflect dynamic angular fringe shifting. When drastically racking the Mirror Tip sliders from negative to positive extremes, the drawn interference pattern does not dynamically distort, shift, or adapt to the new wavefront tilt—they act as static pictorial facades rather than actual mathematical evaluations of a 2D intensity array.
- **Delay in Photon Logic**: The 'Run Auto' photon emitter triggers particles visually, but there is a distinct visual lag/disconnect before the **D1/D2** counts begin to increment in the UI table, pointing to a discrepancy between the animation loop and React state updates.

## 7. Deep Atomic Analysis (Final Re-Audit)

### 7.1 Missing & Disjointed Probability Displays (`App.jsx`)
- **Missing Empirical Probabilities**: The `DetectionOverlay` component fails to display the real-time empirical probabilities (D1/Total vs D2/Total) from the physical particle engine. It only outputs the expected "Theory", leaving researchers without a way to verify the Monte Carlo photon engine against the analytical equations.
- **Omitted D1/D2 Counts (Michelson/Sagnac)**: The `DetectionOverlay` uses an `if/else` block based on `iType`. If the mode is "michelson" or "sagnac", it explicitly renders only the "Theory" values and omits the actual raw `D1` and `D2` particle counters entirely. The physical counts are only visible if the app falls through to the MZI default.

### 7.2 The "Stuck Probability" Mathematical Flaw (MZI & Michelson)
- **0D Point Math vs 2D Wavefronts**: The reason theoretical probabilities (`P(constr)` and `P(destr)`) are "stuck" when adjusting `Mirror Tip` sliders is a fundamental physics mismatch in `App.jsx`. The overlay calculates `P = 0.5 * (cos(2π/λ * OPD) + 1)`. This is a **0-dimensional infinite plane-wave formula**. It natively ignores 2D wavefront tilt, spatial frequency, and interference fringe averaging across a finite detector aperture.
- Moving the Mirror Tip slider tilts the 2D wavefront, creating spacial fringes, which should average the total integrated detector power towards 50/50. Because the UI overlay mathematical engine does not perform a 2D spatial integral, the probabilities remain mathematically locked to the central longitudinal OPD (Gas Cell or Compensator Plate), completely ignoring the sliders.

### 7.3 Cosmetic Forgery in the Astronomical LIGO Simulator (`AnalyticsPanel.jsx`)
- **Hardcoded Chirp Envelopes**: The "Celestial Source" dropdown is cosmetically decoupled from the chirp graph. In `AnalyticsPanel.jsx`, the variables governing the physical chirp waveform are hardcoded: `const tMerge = 1.5; const f0GW = 20;`. Switching from a 30M☉ Binary Black Hole to a 1.4M☉ Binary Neutron Star—which should drastically alter the chirp duration from seconds to minutes—has absolutely zero effect on the plotted waveform.
- **Fabricated Noise Floor**: The noise injected into the h(t) canvas is generated by a function called `pseudoNoise()`, which leverages a hard-coded sum of 5 sine waves to fake a random noisy signal. It completely bypasses the actual `noiseGenerator.js` engine, the Phase Noise parameters, and the `asdLIGO()` specific noise budget.
- The matched filter SNR trace is effectively playing a pre-recorded generic animation rather than processing the live simulated interferometer state.

### 7.4 Superficiality of the Quantum Metrology Lab (`QuantumPanel.jsx`)
- **Static Wigner Function**: The Phase Space canvas plots a generic squeezed ellipse based solely on `state.squeezingParam` and `state.squeezingAngle`. It is a textbook math render. It fails to integrate live detector readout noise, phase noise decoherence, or thermal state mixing into the Wigner function calculation. 
- **Lack of Interactive Graphing Tools**: The "Sensitivity vs Squeezing" plot is a pre-calculated immutable array. To make this an actual research tool, the Quantum panel requires interactive inputs to inject arbitrary quantum states, plot homodyne quadrature distributions (X1/X2 variance), and visualize a real-time noise power spectrum (PSD) demonstrating the sub-shot-noise floor reduction dynamically, rather than just overlaying textbook SVG static paths.

## 8. Thorough Numerical Value Validation (Theoretic vs Real-Time)

### 8.1 The Cosmic Scaling Bug in LIGO Astronomy
- **Instantaneous vs Integrated SNR**: The values displayed in the Astronomical panel (Horizon, Maximum Redshift, and Expected Events/yr) are computationally destroyed by severe domain mismatch. The code calculates `snrV = N > 0 ? phaseSNR(...)` using the `quantumModel.js` engine designed for *continuous-wave metrology frames* (giving a massive instantaneous scalar, e.g., $10^8$). 
- **Impossible Volumes**: The Horizon distance then multiplies this massive `snrV` directly (e.g., `horizonMpc = lumDistMpc * (snrV / 8)`). Since `snrV` is in the millions instead of typical GW integrated values (8–20), the resulting Horizon inflates to $10^{19}$ Gpc, and the corresponding comoving volume yields an absurd `Expected Events/yr` of $\approx 10^{61}$. The UI claims this is a "Matched-Filter SNR" prediction, but the underlying equation calculates static phase certainty, entirely discarding the chirp integration timescale and the full broadband spectral noise density `asdLIGO(f)`.

### 8.2 Frequency-Agnostic Fake Noise Budget
- **Missing Spectral Integration**: Inside `QuantumPanel.jsx`, the "Noise Budget" section plots radiation pressure and thermal noise as static, globally fixed radians (`radPressNoise = 4 P h / λ c m^2`). In physics, these are inherently frequency-dependent spectral density functions (e.g., Radiation Pressure $\propto 1/f^2$, Thermal $\propto 1/f$). Plotting them out of context of the observation bandwidth makes the bar chart computationally arbitrary and meaningless to a researcher trying to locate the Standard Quantum Limit.

### 8.3 Fabricated Equations for Hardware Properties
- **Bogus Effective Quantum Efficiency**: `QuantumPanel.jsx` dynamically recalculates `Effective QE = detectorQE * (1 - totalElecNoise / sqrt(N))`. This formula implies that increasing the dark current physically reduces the photodiode's material photon absorption probability, scaling indefinitely. Hardware QE is a static material property. Readout noise and dark current compound additively in variance ($\sigma_{tot}^2$); they do *not* act as nonlinear transmission-loss filters on the optical beam.

### 8.4 MZI Complete Parameter Disassociation
- **Sim vs Slider Decoupling**: In tests, manipulating mirror dimensions, beam power, and gas elements completely derails the theoretical vs. displayed correlation. MZI mode enforces a rigid override (`opd = -compensatorOPD`) that bypasses all layout geometry. At $x=0$, with Mirror 1 tilted by +5 mRad, the empirical particle simulator (the photons running the visual paths) will slowly diverge or show completely decorrelated detector counts, while the `<DetectionOverlay>` rigorously reads $78.7\%$ permanently because its model mathematically lacks variables for angular tilt and spatial integrals.

## 9. Visual Simulation Ray-Tracing & Geometric Flaws

### 9.1 Sagnac Kinematic Inversion
- **Opposed Traversals**: In `SagnacScene.jsx`, the visual arrays responsible for tracing the perimeter (`cwPath` and `ccwPath`) are physically inverted relative to screen geometry. The array labeled "CW (blue)" traverses the pentagon coordinates as `BS(0°) -> M2(-72°) -> M1(-144°) -> M4(144°)`. In a standard Y-down canvas, this traces a **counter-clockwise** loop. The red "CCW" loop traces clockwise. The mathematical phase `sg.phaseDiff` is calculated correctly, but it is applied to the wrong geometric tracing arrays.

### 9.2 Michelson Classical Bullet Fallacy
- **Absence of Superposition**: While the Mach-Zehnder scene correctly maps quantum superposition by drawing two ghost particles simultaneously taking both arms and resolving state upon recombination at BS2, the `MichelsonScene.jsx` completely fails this. It treats the photon as a classical bullet. A single photon is fired down Arm 1, absorbed, and then the simulation flips a boolean (`ph.arm = (ph.arm + 1) % 2`) to fire the next sequential photon down Arm 2. It visually destroys the concept of single-photon self-interference.

### 9.3 0D Mathematical Cheating in 2D Renderers
- **MZI Recombination Bypass**: The MZI Visual canvas (`SceneManager.jsx`) does not actually simulate 2D electromagnetic phase merging at BS2. Instead of letting the geometry dictate the fringe probabilities locally, it imports the global 0D point math `p1` variable directly from the theoretical engine and uses a global `Math.random() < effectiveP1` check to decide if the ghost particle turns left or right. The visualization is "cheating" by inheriting the UI's broken point-math model rather than simulating spatial physics autonomously.
- **Michelson Tilt Omission**: The wave amplitude renderer in `MichelsonScene.jsx` computes its raw visual intensity using `tOPD = gOPD + mOPD`, intentionally omitting `st.mirrorTilt`. As a result, even the raw visual halo at the detector and the recombined wave opacity fail to respond to the macroscopic wavefront tilt slider inputs, permanently displaying a perfectly uniform beam.

### 9.4 Sagnac Geometric Optics Violations (Snell's Law)
- **Arbitrary Beam "Kinks"**: By comparing the Sagnac source-coupling geometry against canonical Sagnac layouts, I found the 2D canvas entirely violates the Law of Reflection and rectilinear transmission. The source (`Src`) is placed at an arbitrary ~40-degree angle relative to the BS. However, the transmission path into the pentagon loop is geometrically fixed at exactly 54 degrees. Because the rendering engine simply connects raw `(x,y)` dots rather than tracing rays, the light traveling from `Src` hits the `BS` and magically bends ~14 degrees mid-air to align with the loop. It is a completely unphysical cartoon coupling.
- Conversely, the MZI layout is perfectly rectilinear and strictly obeys 90-degree table-top reflection angles and 0-degree straight-line transmission. The Sagnac geometry needs to be mathematically rewritten to align the external source/detector axes exactly with the BS transmission vectors.

## 10. Research Configuration Disconnects & Theoretical Relevancy

### 10.1 Environmental & Noise Parametric Dead-Ends
The `ResearchPanel` exposes over 20 advanced configuration sliders. Exhaustive code tracing reveals that the vast majority are "Cosmetic State Fakes" that write to the data store but are never routed into the 2D visual layout or the empirical photon engines.
- **Thermal Drift & Mount Material**: Computes expansion via `MATERIAL_CTE[mountMaterial]`. This calculation is trapped inside `advancedInterference.js`, which is globally bypassed by `SceneManager`, `MichelsonScene`, and `SagnacScene`. It has zero visual or probabilistic effect.
- **Seismic / Acoustic Noise**: `seismicAmplitude` overlays visually onto the PSD graph in `PhysicsNoisePanel`, but is entirely bypassed by the main interferogram fringes and real-time path lengths. `acousticNoiseDensity` is entirely dead code; it is never mathematically referenced anywhere in the application.
- **Detector Array Size & Pitch**: Sliders exist to configure a 64x64 or 512x512 matrix. However, the sidebar rendering function explicitly hardcodes `resolution: 64` and `detectorSize: 0.01` regardless of the slider values, rendering the Research UI inputs completely severed from the graphics.

### 10.2 Quantum Model Isolation
- **Squeezing in Ray-Tracing**: The `Squeezing (r)` slider affects theoretical limits in the Quantum Panel, but the empirical photon Monte Carlo simulator (`Math.random() < effectiveP1`) in `SceneManager` is hard-locked to purely classical probability thresholds. Quantum squeezing does not alter the empirical variance of the 2D simulated photon hit-rates.
- **Detector Hardware Errors**: Variables like `Dark Current`, `Readout Noise`, and `Exposure` only feed the fabricated `effectiveQE` formula. They do not inject false or dark-count photon particles onto the visual 2D detector components in the scenes.

### 10.3 Theoretical Mismatches across Topologies
Beyond code disconnection, several sliders are theoretically irrelevant to the chosen architectures but remain blindly active without UX warnings:
- **Sagnac vs Gravitational Waves / Seismic**: By the principle of reciprocity, a tabletop Sagnac interferometer is a common-path device fundamentally insensitive to reciprocal path-length changes (like translational seismic vibration or $10^{-21}$ GW strain). Letting users "Inject GW Strain" into a tabletop Sagnac simulation without explicitly simulating or noting its physical immunity breaks educational physics modeling.
- **MZI vs Spatial Perturbations**: An MZI is typically heavily affected by environmental acoustic and thermal gradient mismatches between its split macroscopic arms. The absolute mathematical override `opd = -compensatorOPD` completely shields the MZI visuals from all environmental research sliders, treating the table as perfectly rigid.
