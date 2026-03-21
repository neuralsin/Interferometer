# Quantum Interferometry Suite: Core Physics & Concepts

This document serves as a comprehensive theoretical companion to the Simulab Research engine. It outlines the mathematical formulations, physical principles, and algorithmic approaches used to simulate classical and quantum interferometry, avoiding cosmetic approximations in favor of rigorous models.

---

## 1. Classical Interferometry & Topology

### 1.1 Michelson Interferometer
The Michelson interferometer splits a coherent beam of light via a 50:50 beam splitter into two orthogonal arms.
- **Optical Path Difference (OPD):** The core interference pattern depends on the differential path length $\Delta L$. The engine tracks geometric distance ($L_{arm1} - L_{arm2}$) and dynamically folds in index of refraction delays via the **Edlén equation** for gas pressures/temperatures. 
- **Fringe Intensity:** The detector output is modeled as: 
  $$ I = I_1 + I_2 + 2\sqrt{I_1 I_2} |g^{(1)}(\tau)| \cos(\Delta\phi) $$
  where $\Delta\phi = \frac{4\pi \Delta L}{\lambda} + \phi_{noise}$.

### 1.2 Sagnac Interferometer (Rotational Phase Shift)
The Sagnac configuration injects counter-propagating beams into a closed polygonal loop.
- **Sagnac Effect:** Due to relativistic invariants, a rotating frame causes the co-rotating beam to experience a longer path than the counter-rotating beam.
- The resulting phase shift is independent of the rotation center and depends purely on the enclosed area $A$:
  $$ \Delta\phi_S = \frac{8\pi N A \Omega}{\lambda c} $$
  where $\Omega$ is the angular velocity, $A$ is the loop area, and $N$ is the number of fiber loops.

### 1.3 Mach-Zehnder Interferometer
The MZI focuses on amplitude division and unitary transformations of the photon state. 
- **Quantum Superposition:** The initial state $|1\rangle_{in} |0\rangle_{vac}$ is split into a superposition $\frac{1}{\sqrt{2}}(|1,0\rangle + i|0,1\rangle)$. 
- The engine simulates tilt-averaged interference at the second beam splitter (BS2), determining stochastic detection probabilities at D1 and D2 based on the path operators.

---

## 2. Gaussian Beam Wave Optics

To move beyond simplified ray optics, the engine simulates lasers as $TEM_{00}$ transverse electromagnetic modes.
- **Rayleigh Range ($z_R$):** The distance over which the beam cross-section doubles: $z_R = \frac{\pi w_0^2}{\lambda}$.
- **Beam Envelope ($w(z)$):** The transverse width expands longitudinally: $w(z) = w_0 \sqrt{1 + \left(\frac{z}{z_R}\right)^2}$.
- **Gouy Phase Anomaly ($\psi$):** An additional longitudinal phase delay relative to a plane wave, critical for matched cavity resonance: $\psi(z) = \arctan\left(\frac{z}{z_R}\right)$.
- **Beam Parameter Product (BPP):** A metric of beam quality, calculated as $w_0 \times \Delta\theta$.

---

## 3. Quantum Metrology & Subatomic Limits

### 3.1 Shot Noise & The Standard Quantum Limit (SQL)
- Phase measurement precision for coherent (uncorrelated) photons scales with **Shot Noise**, following Poisson statistics: $\Delta\phi_{SN} = \frac{1}{\sqrt{N}}$.
- As laser power $P$ increases, radiation pressure noise ($\delta F_{rad}$) on the microscopic mirrors increases: $\delta F_{rad} = \sqrt{\frac{4\pi \hbar P}{c \lambda}}$.
- The **SQL Crossover Frequency** ($f_{SQL}$) is exactly calculated as the mechanical resonance where Shot Noise equates to Radiation Pressure noise.

### 3.2 Quantum Squeezing
To surpass the Shot Noise limit, the simulation introduces parametric down-conversion to generate **Squeezed Coherent States**.
- Squeezing redistributes quantum uncertainty away from the phase quadrature into the amplitude quadrature (or vice versa) via the squeezing parameter $r$.
- **Squeezed Variance:** $\Delta\phi_{sqz} = \frac{e^{-r}}{\sqrt{N}}$.
- **Wigner Phase Space:** The software renders the squeezed state's probability quasiprobability distribution $W(x, p)$. An $r > 0$ physically compresses the circular coherent uncertainty blob into a rotated ellipse.

### 3.3 Quantum Fisher Information (QFI) & Cramer-Rao Bound
To provide research-grade verification, the engine dynamically calculates the absolute theoretical boundary for phase extraction.
- **QFI:** $F_Q = N e^{2r} + \sinh^2(r)$.
- **Cramer-Rao Lower Bound (CRLB):** The absolute minimal variance physically achievable: $\Delta\phi_{CRLB} \ge \frac{1}{\sqrt{F_Q}}$.

---

## 4. Astronomical & Gravitational Wave Analytics

Simulating a laser interferometer gravitational-wave observatory (LIGO-class detector).

### 4.1 General Relativistic Inspirals
When Massive bodies (Binary Black Holes or Neutron Stars) orbit, they radiate energy as gravitational tensor metric perturbations ($h$).
- **Chirp Mass ($\mathcal{M}_c$):** The primary driver of the evolution, $\mathcal{M}_c = \frac{(m_1 m_2)^{3/5}}{(m_1 + m_2)^{1/5}}$.
- **Strain Amplitude ($h_0$):** Inversely proportional to the luminosity distance $D_L$:
  $$ h_0(t) \approx \frac{4}{D_L}\left(\frac{G \mathcal{M}_c}{c^2}\right)^{5/3} \left(\frac{\pi f(t)}{c}\right)^{2/3} $$
- **Time/Frequency Evolution (Chirp):** The frequency violently increases (chirps) as they merge, integrated via Peters' equations: $\frac{df}{dt} = \frac{96}{5} \pi^{8/3} \left(\frac{G\mathcal{M}_c}{c^3}\right)^{5/3} f^{11/3}$.

### 4.2 Matched Filtering & Signal-to-Noise
- The raw strain ($\sim 10^{-21}$) is completely beneath the quantum noise floor.
- The **Analytics Panel** integrates the inspiral templates over the dynamically generated detector noise Power Spectral Density (PSD) $S_n(f)$ to compute the **Optimal Matched Filter SNR**:
  $$ \text{SNR}^2 = 4 \int_{f_{min}}^{f_{ISCO}} \frac{|h(f)|^2}{S_n(f)} df $$

---

## 5. Noise & Stochastics (WASM Engine)

To accurately simulate hardware environments, noise is computed using high-speed Monte Carlo walks inside a compiled WebAssembly binary to avoid JavaScript thread-locking.

### 5.1 Wiener Phase Noise & Partial Coherence
- Laser linewidth ($\Delta\nu$) represents finite temporal coherence.
- The engine uses a stochastic random-walk generator where the phase diffuses according to a Wiener process: $\sigma_\phi^2(t) = 2\pi \Delta\nu t$.
- The **Lorentzian Power Spectral Density** represents this continuous decoherence in the frequency domain.

### 5.2 Seismic & Thermal Drift
- Sub-Hertz displacement noise follows a Brownian-motion power law approximation ($1/f^4$ isolation rolloff for suspension systems).
- Mechanical vibration and thermal coating losses dynamically stack to continuously scramble the OPD, forcing the simulated fringes to physically drift in real-time on the interferogram canvas.
