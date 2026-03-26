import React, { useState, useCallback } from 'react';
import useSimulationStore from '../store/simulationStore.js';

/* ═══════════════════════════════════════════════════════════════
   CONTENT DATABASE — Theory, Procedure, and Assessment
   per interferometer type.
   
   Sources:
   - LIGO Caltech: https://www.ligo.caltech.edu/page/what-is-interferometer
   - Rutgers Sagnac Lab: physics.rutgers.edu/~eandrei/389/sagnac-interferometer-expt.pdf
   - IIT Madras MZI Handout: physics.iitm.ac.in/~EPLAB/handouts/mach_zender_revised.pdf
   - Wikipedia: Michelson interferometer, Mach–Zehnder interferometer, Sagnac effect, LISA
   - Oxford Physics Lab Manual: users.physics.ox.ac.uk/~lvovsky/471/labs/michel.pdf
   - St Andrews QuVis: st-andrews.ac.uk/physics/quvis/simulations_html5/sims
   - Quantum Flytrap: lab.quantumflytrap.com/lab/mach-zehnder
   ═══════════════════════════════════════════════════════════════ */

const CONTENT = {
  /* ╔══════════════════════════════════════════════════════════╗
     ║                MICHELSON INTERFEROMETER                  ║
     ╚══════════════════════════════════════════════════════════╝ */
  michelson: {
    title: 'Michelson Interferometer',
    theory: [
      {
        heading: '1. Historical Context & Principle',
        body: `Invented by Albert A. Michelson in 1887 (with Edward Morley), this instrument was originally designed to detect Earth's motion through the hypothetical "luminiferous aether". The null result became one of the key motivations for Einstein's Special Relativity (1905).

The interferometer splits a coherent beam into two perpendicular arms using a half-silvered mirror (beam splitter). Each beam reflects off a mirror at the end of its arm and returns to the beam splitter, where the two beams recombine. The recombined light produces an interference pattern whose structure encodes the Optical Path Difference (OPD) between the arms.

Key property: the Michelson uses a double-pass (retroreflection) geometry — each beam traverses its arm twice, giving a factor-of-2 sensitivity advantage.

Ref: A.A. Michelson & E.W. Morley, "On the Relative Motion of the Earth and the Luminiferous Ether," Am. J. Sci. 34 (1887), 333–345.`,
      },
      {
        heading: '2. Optical Path Difference (OPD)',
        body: `The total OPD is the sum of all contributions:

  OPD_total = OPD_gas + OPD_mirror + OPD_thermal + OPD_seismic + OPD_GW

Each component in detail:

• Gas Cell OPD:
  OPD_gas = 2 · (n_gas − 1) · L_cell
  where  n_gas = 1 + n₀ · P
  (n₀ = specific refractivity, P = pressure in atm, L_cell = cell length)

• Mirror Displacement:
  OPD_mirror = 2 · Δd
  (Δd = mirror offset in meters; factor 2 from double-pass)

• Thermal Drift:
  OPD_therm = 2 · (L₁ − L₂) · α · ΔT
  (α = CTE of mount material, ΔT = T − 293.15 K)

• Seismic Vibration:
  OPD_seis = 2 · A_seis · sin(2π · f_seis · t)
  (A_seis = seismic amplitude, f_seis = frequency, time-varying)

• Gravitational Wave:
  OPD_GW = 2 · h · L_arm · sin(2π · f_GW · t)
  (h = dimensionless strain amplitude, L_arm = arm length)`,
        formula: 'OPD = 2(n−1)L + 2Δd + 2(L₁−L₂)αΔT + 2A·sin(2πft) + 2hL·sin(2πf_GW·t)',
      },
      {
        heading: '3. Gas Cell Refractive Index',
        body: `The gas cell introduces OPD by changing the refractive index in one arm:

  n(P) = 1 + n₀ · P

Specific refractivity coefficients at STP:
• Air:    n₀ = 293 × 10⁻⁶   →  n = 1.000293 at 1 atm
• Helium: n₀ = 35 × 10⁻⁶    →  n = 1.000035 at 1 atm
• Argon:  n₀ = 281 × 10⁻⁶   →  n = 1.000281 at 1 atm

Edlén Equation (environmental correction for air):
  n_env = 1 + 0.000293 × (P_env / 101325) × (293.15 / T)

Number of fringes from a pressure sweep ΔP:
  m = 2 · n₀ · ΔP · L_cell / λ

Example: Air, ΔP = 4 atm, L = 5 cm, λ = 632.8 nm
  m = 2 × 293×10⁻⁶ × 4 × 0.05 / 632.8×10⁻⁹ ≈ 185 fringes`,
        formula: 'n(P) = 1 + n₀·P   |   m = 2·n₀·ΔP·L / λ',
      },
      {
        heading: '4. Intensity & Interference',
        body: `At the detector, recombined beams produce:

  I(x,y) = (I₀/2) · [1 + V · cos(k·OPD + k·θ·x)]

where:
• k = 2π/λ  (wavenumber)
• V = fringe visibility (from coherence)
• θ = mirror tilt angle (radians)
• x = transverse detector position

The tilt term (k·θ·x) creates straight fringes;
curvature creates circular Newton's ring fringes.

Central pixel intensity:
  I_center = ½ · (1 + V · cos(2π · OPD / λ))

• Constructive: OPD = mλ  (m = 0, ±1, ±2, …)
• Destructive:  OPD = (m + ½)λ

Tilt-averaged detection (spatial integration):
  P₁ = (1/D) · ∫cos²(δ/2 + k·θ·x) dx
This smoothly transitions from P₁ = cos²(δ/2) at θ=0 to P₁ ≈ 0.5 at large tilts.`,
        formula: 'I = ½·I₀·(1 + V·cos(k·OPD))   |   Constructive: OPD = mλ',
      },
      {
        heading: '5. Fringe Regimes & Mirror Tilt',
        body: `Fringe character depends on tilt angle θ (milliradians):

• Circular (Newton's Rings): θ < 0.05 mrad
  Equal-inclination fringes. Concentric rings. Ring spacing ∝ 1/√m.

• Curved: 0.05 < θ < 0.5 mrad
  Transitional. Superposition of linear tilt and quadratic curvature.

• Straight: 0.5 < θ < 2 mrad
  Equal-thickness fringes. Spacing d = λ/(2θ). Used in optical testing.

• Dense: θ > 2 mrad
  Fringes below pixel pitch → washout. Visibility appears zero.

The Michelson tilt factor is 2 (double-pass):
  φ_tilt = 2 · k · θ · x`,
        formula: 'Fringe spacing: d = λ/(2θ)   |   φ_tilt = 2kθx',
      },
      {
        heading: '6. Temporal Coherence & Visibility',
        body: `Fringe visibility measures interference contrast:

  V = (I_max − I_min) / (I_max + I_min) = |γ(τ)|

where γ(τ) is the mutual coherence function and τ = OPD/c.

Lorentzian lineshape (HeNe, Nd:YAG):
  γ(τ) = exp(−π · Δν · |τ|)
  V = exp(−π · Δν · |OPD| / c)

Gaussian lineshape:
  γ(τ) = exp(−π²·Δν²·τ² / (4·ln2))

Coherence length:  L_c = c / Δν
Coherence time:   τ_c = 1 / Δν

• HeNe (Δν ~ 1.5 GHz):  L_c ≈ 20 cm
• Stabilized Nd:YAG (Δν ~ 1 kHz):  L_c ≈ 300 km

Power Spectral Density (Lorentzian):
  S(ν) = (Δν/2π) / [(ν−ν₀)² + (Δν/2)²]

At OPD = L_c:  V = e⁻¹ ≈ 0.37
At OPD ≫ L_c: V → 0 (no fringes)`,
        formula: 'V = exp(−π·Δν·|OPD|/c)   |   L_c = c/Δν   |   τ_c = 1/Δν',
      },
      {
        heading: '7. Quantum Limits & Shot Noise',
        body: `Photon count during integration time t:
  N = P · λ · t / (h · c)

Standard Quantum Limit (shot noise):
  Δφ_min = 1/√N

Squeezed vacuum injection (parameter r > 0):
  Δφ_sqz = e⁻ʳ / √N

Phase Signal-to-Noise Ratio:
  SNR = |Δφ_signal| / Δφ_sqz = |Δφ| · √N · eʳ

Quantum phase noise:
  φ_noisy = φ_clean + σ·Z    (Z ~ Normal(0,1), σ = Δφ_sqz)

Example: HeNe at 5 mW, t = 1 ms, λ = 632.8 nm:
  N ≈ 1.6 × 10¹³ → Δφ_min ≈ 2.5 × 10⁻⁷ rad`,
        formula: 'N = Pλt/(hc)   |   Δφ = 1/√N   |   Δφ_sqz = e⁻ʳ/√N',
      },
      {
        heading: '8. Noise Sources in Detail',
        body: `Three environmental noise models perturb the OPD:

1. Thermal Drift:
  OPD_therm = 2·|L₁−L₂|·α·ΔT
  CTE values: Invar 1.2×10⁻⁶/K, Al 23×10⁻⁶/K, Steel 12×10⁻⁶/K, Zerodur 0.05×10⁻⁶/K

2. Seismic Vibration:
  OPD_seis = 2·A_seis·sin(2πf_seis·t)
  Typical: f = 0.1–10 Hz, A = 10⁻¹² – 10⁻⁶ m

3. Gravitational Waves:
  OPD_GW = 2·h·L_arm·sin(2πf_GW·t)
  GW stretches one arm while compressing the other — "differential arm" motion.`,
      },
      {
        heading: '9. LIGO & Gravitational Wave Detection',
        body: `LIGO is a modified Michelson with extraordinary enhancements:

• 4 km Fabry–Pérot arm cavities (~300 bounces → effective L ~ 1200 km)
• 200 W Nd:YAG laser (λ = 1064 nm), cavity power ~750 kW
• Power & signal recycling mirrors
• Squeezed vacuum (r ≈ 1.5 → 12 dB noise reduction)
• 7-stage seismic isolation

Sensitivity: 10⁻²³ /√Hz at 100 Hz
ΔL = h·L = 10⁻²¹ × 4000 = 4×10⁻¹⁸ m (1/1000th proton width!)

First detection (GW150914): Sep 14, 2015 — merging black holes at 1.3 Gly.

LISA (planned): 3 spacecraft in triangle, 2.5 million km arms, targeting 0.1 mHz–1 Hz GWs from supermassive BH mergers.`,
        formula: 'ΔL = h·L   |   h ~ 10⁻²¹   |   ΔL ~ 4×10⁻¹⁸ m',
      },
      {
        heading: '10. Applications',
        body: `• Rayleigh Refractometry: Gas refractive index via fringe counting
• FTIR Spectroscopy: Fourier-transforming the interferogram
• Precision Displacement: Sub-nm sensing for lithography
• Optical Surface Testing: Comparing test surface against reference flat
• Gravitational Wave Astronomy (LIGO/Virgo/KAGRA)
• Testing Special Relativity: Michelson–Morley null result confirms Lorentz invariance`,
      },
    ],
    procedure: [
      { step: 1, title: 'Set Up the Laser', desc: 'Select wavelength via Laser Engine λ slider. Try λ=632.8 nm (HeNe) and λ=532 nm (Nd:YAG). Note fringe spacing depends on λ.' },
      { step: 2, title: 'Observe Circular Fringes', desc: 'With Tilt at 0 mrad, observe Newton\'s rings in the Interferogram disc. Each ring = half-wavelength OPD change.' },
      { step: 3, title: 'Sweep Mirror Displacement', desc: 'Click "Animate M2". Watch I(t) oscillate sinusoidally as OPD sweeps through constructive/destructive cycles.' },
      { step: 4, title: 'Measure Gas n₀', desc: 'Click "Animate P" to sweep pressure. Count fringes from 0.1→10 atm. Use m = 2(n-1)L/λ to extract n₀.' },
      { step: 5, title: 'Explore Fringe Regimes', desc: 'Click "Animate Tilt". Watch: Circular → Curved → Straight → Dense. Verify spacing d = λ/(2θ).' },
      { step: 6, title: 'Enable Noise', desc: 'Toggle GW, Seismic, Thermal. Each adds distinct OPD modulation frequencies.' },
      { step: 7, title: 'Quantum Limits', desc: 'In SUBATOMIC tab, adjust power to see N and shot noise Δφ = 1/√N. Enable squeezing.' },
      { step: 8, title: 'Export Data', desc: 'Export JSON for offline analysis (Python/MATLAB).' },
    ],
    quiz: [
      { id: 'mi1', q: 'With equal arm lengths and no gas cell, what fringe pattern do you observe?', options: ['No fringes — uniform illumination', 'Dense straight fringes', 'A single bright spot', 'Random speckle'], answer: 0, explanation: 'OPD = 0 everywhere → uniform constructive interference, no spatial variation.' },
      { id: 'mi2', q: 'If gas pressure increases from 1 to 5 atm (air), what happens to fringes?', options: ['Stay the same', 'More fringes appear (OPD increases)', 'Fewer fringes', 'Fringes disappear'], answer: 1, explanation: 'Higher P → higher n → larger OPD = 2(n-1)L → more fringe cycles.' },
      { id: 'mi3', q: 'Fringe visibility V measures:', options: ['Beam brightness', 'Degree of temporal coherence', 'Mirror reflectivity', 'Laser power'], answer: 1, explanation: 'V = |γ(τ)| quantifies how well beams interfere → direct measure of temporal coherence.' },
      { id: 'mi4', q: 'Why is Michelson ideal for LIGO?', options: ['Amplifies GW', 'Measures differential arm length changes', 'Filters EM noise', 'Creates standing waves'], answer: 1, explanation: 'GW stretches one arm, compresses the other → differential signal. Michelson measures Δ(L₁−L₂).' },
      { id: 'mi5', q: 'Standard Quantum Limit for phase sensitivity:', options: ['Δφ = 1/N', 'Δφ = 1/√N', 'Δφ = √N', 'Δφ = N²'], answer: 1, explanation: 'Shot noise limit: Δφ_min = 1/√N from Poissonian photon statistics.' },
    ],
  },

  /* ╔══════════════════════════════════════════════════════════╗
     ║             MACH-ZEHNDER INTERFEROMETER                 ║
     ╚══════════════════════════════════════════════════════════╝ */
  mzi: {
    title: 'Mach-Zehnder Interferometer',
    theory: [
      {
        heading: '1. Historical Context & Principle',
        body: `Independently developed by Ludwig Mach (1891) and Ludwig Zehnder (1891), the MZI uses two beam splitters and two mirrors to create two spatially separated optical paths. Unlike Michelson, beams travel single-pass — they never retrace their path.

Topology:
  Source → BS₁ → [Arm 1 via M₁] → BS₂ → Detector D₁
                → [Arm 2 via M₂] → BS₂ → Detector D₂

The open geometry makes MZI ideal for transmission measurements (samples in one arm) and for quantum optics experiments where path distinguishability matters.

Ref: Zehnder, L. (1891) "Ein neuer Interferenzrefraktor," Z. Instrumentenkunde, 11, 275–285.
Ref: Mach, L. (1891) "Ueber einen Interferenzrefraktor," Z. Instrumentenkunde, 12, 89–93.`,
      },
      {
        heading: '2. Classical Wave Optics',
        body: `At BS₁ (50:50), input field E₀ splits:
  E₁ = E₀/√2       (transmitted)
  E₂ = i·E₀/√2     (reflected — acquires π/2 from coating)

After arms, fields acquire phase:
  E₁' = (E₀/√2)·exp(ikL₁)
  E₂' = (i·E₀/√2)·exp(ikL₂)

At BS₂, outputs are:
  E_D₁ = (E₁' + i·E₂')/√2
  E_D₂ = (i·E₁' + E₂')/√2

Output intensities:
  I(D₁) = I₀ · cos²(Δφ/2)
  I(D₂) = I₀ · sin²(Δφ/2)

where Δφ = k·OPD,  k = 2π/λ.

Energy conservation: I(D₁) + I(D₂) = I₀

OPD for MZI (single-pass, no factor of 2):
  OPD = n_env·(L₁ − L₂) − OPD_comp + OPD_noise
  OPD_comp = (n_glass − n_env) · t_comp`,
        formula: 'I(D₁) = I₀·cos²(Δφ/2)   |   I(D₂) = I₀·sin²(Δφ/2)   |   Δφ = k·OPD',
      },
      {
        heading: '3. Quantum Single-Photon Regime',
        body: `Single photons traversing the MZI follow quantum state evolution:

1. Input state: |ψ₀⟩ = |1⟩ (one photon at input)

2. After BS₁ (Hadamard gate H):
  |ψ₁⟩ = (|arm1⟩ + i|arm2⟩) / √2
  The photon is in a SUPERPOSITION of both arms simultaneously.

3. Phase accumulation:
  |ψ₂⟩ = (e^{iφ₁}|arm1⟩ + i·e^{iφ₂}|arm2⟩) / √2

4. After BS₂ (second Hadamard):
  |ψ_out⟩ = α|D₁⟩ + β|D₂⟩

Detection probabilities (Born rule):
  P(D₁) = |α|² = cos²(Δφ/2)
  P(D₂) = |β|² = sin²(Δφ/2)

Wave-particle duality: each photon arrives as a discrete "click" at exactly one detector, but the statistical distribution of many clicks reproduces the wave interference pattern.

Blocking either arm destroys interference → P(D₁) = P(D₂) = 0.5 (which-path information erases superposition).

After N photons, the measured ratio D₁/N converges to P(D₁) via the Law of Large Numbers:
  σ_P = √(P(1−P)/N)  (Binomial standard deviation)`,
        formula: '|ψ⟩ = (|arm1⟩ + i·e^{iΔφ}|arm2⟩)/√2   |   P(D₁) = cos²(Δφ/2)   |   σ = √(P(1−P)/N)',
      },
      {
        heading: '4. Beam Splitter Matrix Formalism',
        body: `A 50:50 beam splitter is described by the unitary matrix:

  BS = (1/√2) · [ 1   i ]
                 [ i   1 ]

The reflected beam acquires a relative phase of π/2 (factor of i). This ensures energy conservation (unitarity): BS†·BS = I.

For the full MZI with phase shift Δφ in arm 2:

  MZI = BS · Phase · BS

Where Phase = [ 1    0        ]
              [ 0    e^{iΔφ}  ]

The output state is:
  |out⟩ = MZI · |in⟩ = [ cos(Δφ/2)  ] · e^{iΔφ/2}
                         [ i·sin(Δφ/2) ]

This is the quantum transfer matrix of the MZI — it implements a controlled rotation in Hilbert space, making it a fundamental building block for photonic quantum computing.`,
        formula: 'BS = (1/√2)·[[1,i],[i,1]]   |   MZI = BS · Φ · BS',
      },
      {
        heading: '5. Compensator Plate',
        body: `BS₁ introduces asymmetric glass traversals:
• Transmitted beam passes THROUGH the glass substrate
• Reflected beam reflects OFF the surface (no glass traversal)

This creates a spurious OPD:
  OPD_spurious = (n_glass − n_air) × t_BS

For BK7 glass (n = 1.5168), t = 6.35 mm:
  OPD_spurious ≈ (1.5168 − 1.0003) × 0.00635 = 3.28 μm

The Compensator Plate is an identical glass plate placed in the other arm:
  OPD_comp = (n_comp − n_env) × t_comp

This equalizes the glass path, eliminating:
• Spurious OPD shift
• Chromatic dispersion (wavelength-dependent n causes different shifts at different λ)
• Group velocity dispersion (pulse broadening in ultrafast experiments)`,
        formula: 'OPD_comp = (n_glass − n_env) × t   |   n_BK7 = 1.5168',
      },
      {
        heading: '6. Coherence & Visibility',
        body: `Same coherence model as Michelson:

Coherence length:  L_c = c / Δν
Visibility:  V = exp(−π·Δν·|OPD|/c)  (Lorentzian)

For Gaussian lineshape:
  V = exp(−π²·Δν²·OPD² / (4c²·ln2))

In MZI, OPD is typically small (mm-scale arm differences), so V ≈ 1 unless using a broadband source.

When V < 1:  I(D₁) = ½·(1 + V·cos(Δφ))
Reduced visibility means reduced contrast but NOT randomized detection.

PSD (Lorentzian lineshape):
  S(ν) = (Δν/2π) / [(ν−ν₀)² + (Δν/2)²]`,
        formula: 'L_c = c/Δν   |   V = exp(−π·Δν·|OPD|/c)',
      },
      {
        heading: '7. Quantum Limits & Shot Noise',
        body: `Photon count: N = P·λ·t / (h·c)
Shot noise limit: Δφ_min = 1/√N
Squeezed limit: Δφ_sqz = e⁻ʳ/√N
Phase SNR: SNR = |Δφ|·√N·eʳ

In MZI quantum regime:
• Each photon detected at exactly one port (no half-photons)
• Detection is inherently probabilistic
• Statistical uncertainty: σ_P = √(P·(1−P)/N)  (Binomial)
• For N = 500 at P = 0.5: σ ≈ 2.2%

Quantum phase noise:
  φ_noisy = φ_clean + σ·Z   (Z ~ Normal(0,1))`,
        formula: 'N = Pλt/(hc)   |   Δφ = 1/√N   |   σ_P = √(P(1−P)/N)',
      },
      {
        heading: '8. Applications',
        body: `• Electro-Optic Modulation: Telecom MZI modulators encode data via voltage-controlled phase (Pockels effect). Bandwidth > 100 GHz. In every fiber-optic link worldwide.

• Quantum Computing: MZI = quantum Hadamard gate. KLM protocol (2001): universal linear-optical quantum computation using sequences of MZIs.

• Integrated Photonics: Silicon photonic MZIs for on-chip sensing, switching, routing. Phase tuned via thermo-optic or carrier-injection.

• Flow Visualization: Quantitative density-gradient imaging in wind tunnels (schlieren alternative).

• Refractive Index Measurement: Sample in one arm → count fringes → extract n·t with sub-λ precision.

• Quantum Key Distribution (QKD): MZI used in BB84/B92 protocols for phase-encoding qubits.`,
      },
    ],
    procedure: [
      { step: 1, title: 'Send a Single Photon', desc: 'Click "Send 1". Observe the photon split into ghost paths (superposition) then collapse to one detector at BS₂.' },
      { step: 2, title: 'Build Statistics', desc: 'Click "×50" then "×500". Watch the detection ratio converge to cos²(Δφ/2) via Law of Large Numbers.' },
      { step: 3, title: 'Break an Arm', desc: 'Toggle M₁ OFF. Detection becomes 50/50 — no interference without both paths.' },
      { step: 4, title: 'Remove BS₂', desc: 'Toggle BS₂ OFF. Without recombination → random detection. BS₂ erases which-path information.' },
      { step: 5, title: 'Adjust Geometry', desc: 'Drag mirrors / use Geometry Offset slider for sub-wavelength OPD tuning. Watch P(D₁) oscillate.' },
      { step: 6, title: 'Add Compensator', desc: 'Toggle CP ON. Note OPD shift from equalizing glass paths.' },
      { step: 7, title: 'Auto Mode', desc: 'Click "▶ Auto" for continuous single-photon firing. Simulates a real quantum optics lab.' },
    ],
    quiz: [
      { id: 'mz1', q: 'In a balanced MZI (Δφ = 0), where do all photons go?', options: ['50% D₁, 50% D₂', '100% D₁', '100% D₂', 'Neither'], answer: 1, explanation: 'P(D₁) = cos²(0) = 1. All photons constructively interfere at D₁.' },
      { id: 'mz2', q: 'Removing one mirror causes:', options: ['Double interference', '50/50 (no interference)', 'All photons lost', 'Fringe inversion'], answer: 1, explanation: 'One arm gone → no second amplitude → no interference → 50/50 at BS₂.' },
      { id: 'mz3', q: 'Before reaching BS₂, where is a single photon?', options: ['Arm 1', 'Arm 2', 'Superposition of both', 'Absorbed'], answer: 2, explanation: 'After BS₁: |ψ⟩ = (|arm1⟩ + i|arm2⟩)/√2. Both arms simultaneously until measured.' },
      { id: 'mz4', q: 'The BS matrix has factors of i because:', options: ['Manufacturing defect', 'Energy conservation (unitarity)', 'Gravity', 'Temperature'], answer: 1, explanation: 'BS†·BS = I requires the reflected beam to acquire π/2 phase. This ensures energy conservation.' },
      { id: 'mz5', q: 'What does the Compensator Plate do?', options: ['Amplifies laser', 'Equalizes glass path lengths in both arms', 'Filters wavelengths', 'Reflects photons'], answer: 1, explanation: 'Matches the glass traversal asymmetry from BS₁, eliminating spurious OPD and chromatic dispersion.' },
    ],
  },

  /* ╔══════════════════════════════════════════════════════════╗
     ║                SAGNAC INTERFEROMETER                    ║
     ╚══════════════════════════════════════════════════════════╝ */
  sagnac: {
    title: 'Sagnac Interferometer',
    theory: [
      {
        heading: '1. Historical Context & Principle',
        body: `Demonstrated by Georges Sagnac in 1913, this interferometer sends two beams around the same closed loop in opposite directions — clockwise (CW) and counter-clockwise (CCW).

When stationary: both beams travel identical paths → Δφ = 0.
When rotating: the co-rotating beam travels further (mirror "runs away"), counter-rotating beam travels less (mirror "approaches") → phase difference ∝ Ω.

Key insight: the Sagnac effect measures ABSOLUTE rotation — no external reference needed. This makes it fundamentally different from Michelson/MZI which measure path length differences.

Sagnac originally used a 0.86 m² loop rotating at several rev/s, observing a fringe shift of ~0.07 fringes — proving that rotation is detectable by purely optical means.

Ref: Sagnac, G. (1913) C.R. Acad. Sci. 157, 708–710.
Ref: E.J. Post, "Sagnac Effect," Rev. Mod. Phys. 39, 475 (1967).`,
      },
      {
        heading: '2. Sagnac Phase — Area Method (Method 1)',
        body: `The fundamental Sagnac equations from enclosed area:

Time difference:
  Δt = 4·A·Ω / c²

Fringe shift:
  ΔN = 4·A·Ω / (c·λ)

Phase difference:
  Δφ = 2π·ΔN = 8π·A·Ω / (c·λ)

For fiber-optic gyroscope with N coils:
  A_total = N · π · R²
  L_total = N · 2πR

Substituting:
  Δφ = 8π·N·π·R²·Ω / (c·λ) = 8π²·N·R²·Ω / (c·λ)

The sensitivity scales as N·R² — this is WHY FOGs use many turns of fiber at the largest practical radius.

Scale factor: S = dΔN/dΩ = 4NA/(cλ)`,
        formula: 'Δφ = 8πNAΩ/(cλ)   |   Δt = 4AΩ/c²   |   ΔN = 4AΩ/(cλ)',
      },
      {
        heading: '3. Velocity Addition Method (Method 2)',
        body: `Equivalent derivation via rotating-frame beam speeds:

Tangential velocity: v = Ω · R

Beam speeds in rotating frame:
  c_CW = c − v  (co-rotating)
  c_CCW = c + v  (counter-rotating)

Round-trip times:
  t_CW = L / (c − v)
  t_CCW = L / (c + v)

Time difference:
  Δt = t_CW − t_CCW = L·[1/(c−v) − 1/(c+v)]
     = 2Lv / (c² − v²)
     ≈ 2Lv / c²  (since v ≪ c)

For circular loop (L = 2πR, v = ΩR):
  Δt = 2·2πR·ΩR / c² = 4πR²Ω / c² = 4AΩ / c²  ✓

Fringe shift:
  ΔN = [L/(c−v) − L/(c+v)] · c / λ

Both methods yield identical results to first order in v/c.`,
        formula: 'c_CW = c−ΩR   |   c_CCW = c+ΩR   |   Δt = 2LΩR/(c²−v²)',
      },
      {
        heading: '4. Detector Intensity',
        body: `Standard two-beam interference:

  I = (I₀/2) · [1 + V · cos(Δφ)]

Normalized intensity parameter:
  cos_val = [cos(Δφ) + 1] / 2

Mapping:
• cos_val > 0.5 → constructive dominates
• cos_val < 0.5 → destructive dominates
• cos_val = 0.5 → balanced (Δφ = π/2)

Intensity oscillates sinusoidally with Ω, period:
  Ω_period = cλ / (8π·N·A)

For small rotations (Δφ ≪ 1):
  I ≈ I₀/2 · [1 + V · (1 − Δφ²/2)]
  → linear response: ΔI ∝ Δφ² ∝ Ω²

For maximum sensitivity, bias the interferometer at Δφ = π/2:
  I ≈ I₀/2 · [1 − V·sin(δΔφ)] → linear in δΔφ`,
        formula: 'I = ½(1 + V·cos(Δφ))   |   Ω_period = cλ/(8πNA)',
      },
      {
        heading: '5. Sensitivity & Scaling Laws',
        body: `Phase sensitivity to rotation:
  dΔφ/dΩ = 8πNA / (cλ)

Minimum detectable rotation (shot-noise limited):
  Ω_min = cλ / (8πNA√N_photon) = Δφ_min · cλ/(8πNA)

Numerical examples:

Earth's rotation: Ω_Earth = 7.27 × 10⁻⁵ rad/s
  N=1000, R=0.15 m, λ=633 nm:
  Δφ ≈ 8.6 × 10⁻³ rad ≈ 0.49°  → measurable!

Navigation-grade FOG:
  N=3000, R=0.1 m, λ=1550 nm:
  Scale factor S = 4×3000×π×0.01/(3×10⁸×1.55×10⁻⁶) ≈ 0.81 rad/(rad/s)
  With 1 mW source: N_photon/s ≈ 7.8×10¹⁵
  Ω_min ≈ 3×10⁻⁸ rad/s ≈ 0.006°/hr (navigation grade!)

Switching from 632.8 nm to 405 nm:
  Sensitivity increases by factor 632.8/405 ≈ 1.56 (+56%)`,
        formula: 'dΔφ/dΩ = 8πNA/(cλ)   |   Ω_min = cλ/(8πNA√N)   |   S = 4NA/(cλ)',
      },
      {
        heading: '6. Refractive Index Effects',
        body: `In a fiber medium with refractive index n:

Wavelength in medium: λ_m = λ_vacuum / n

Naively, one might expect: Δφ = 8πNAΩn/(cλ)

But the Fresnel-Fizeau drag effect partially compensates:
  Δφ = 8πNAΩ / (cλ)  ← INDEPENDENT of n!

This remarkable result follows from special relativity. The medium drags the light by exactly the amount needed to cancel the n-enhancement. Confirmed experimentally.

Environmental refractive index (Edlén):
  n_env = 1 + 0.000293 × (P/101325) × (293.15/T)

The simulation uses n_env for wavelength correction:
  λ_medium = λ / n_env

But the Sagnac phase itself remains independent of the medium.`,
        formula: 'λ_m = λ/n   |   Δφ = 8πNAΩ/(cλ)  [n-independent!]',
      },
      {
        heading: '7. Common-Path Noise Rejection',
        body: `The Sagnac topology has a fundamental advantage: common-path rejection.

Both CW and CCW beams travel the SAME physical path. Any reciprocal perturbation affects both equally and cancels:

• Thermal expansion → affects both paths equally → Δ = 0
• Vibration → affects both paths equally → Δ = 0
• Slow refractive index drift → affects both equally → Δ = 0

Only NON-RECIPROCAL effects produce a net phase shift:
• Rotation (Sagnac effect) — the fundamental signal
• Faraday effect (magneto-optic)
• Kerr effect (intensity-dependent n — creates asymmetry)

Dominant real-world noise in FOGs:
• Rayleigh backscattering (backward-scattered photons couple into counter-propagating beam)
• Kerr effect asymmetry
• Shupe effect (time-varying temperature gradients along fiber)
• Polarization coupling

This is why noise sources (thermal, seismic, GW) are NOT applied to Sagnac in this simulation — physically correct!`,
      },
      {
        heading: '8. Ring Laser Gyroscopes',
        body: `An alternative Sagnac device: two counter-propagating laser modes in a gas ring cavity.

Instead of measuring fringe shift, the RLG measures the BEAT FREQUENCY between CW and CCW modes:

  Δf = 4AΩ / (λP)

where P = perimeter of the ring cavity.

Advantages over FOG:
• Direct frequency measurement (digital output)
• No need for external light source
• Very high bandwidth

Disadvantages:
• Lock-in at small Ω (modes couple and synchronize)
• Mechanical dither needed to overcome lock-in
• Gas tube lifetime limited

Used in: Boeing 777/787, Airbus A320/A380, military aircraft, submarine navigation.

The G-ring at Wettzell (Germany): 4×4 m² ring laser — measures Earth's rotation to 10⁻⁹ rad/s precision and detects tidal tilts.`,
        formula: 'Δf_beat = 4AΩ / (λP)',
      },
      {
        heading: '9. Applications',
        body: `• Fiber Optic Gyroscopes (FOG): Navigation-grade sensing (0.001–0.01°/hr drift). No moving parts.

• Ring Laser Gyroscopes (RLG): Commercial/military aviation inertial navigation.

• Earth Rotation Detection: Sagnac (1913) demonstrated with 0.86 m² loop. Modern G-ring: 10⁻⁹ rad/s precision.

• General Relativity Tests: Frame-dragging (Lense-Thirring) measurement near rotating masses.

• LISA Pathfinder: Sagnac-type interferometry for drag-free spacecraft attitude sensing.

• Quantum Sagnac: Single-photon Sagnac loops for rotation sensing with quantum uncertainty limits — potential for Heisenberg-limited gyroscopes.`,
      },
    ],
    procedure: [
      { step: 1, title: 'Set Ω = 0', desc: 'Zero rotation → identical CW/CCW paths → full constructive interference (I = 1.0).' },
      { step: 2, title: 'Animate Omega', desc: 'Click "Animate Ω". Watch intensity trace the Sagnac phase sinusoidally.' },
      { step: 3, title: 'Verify Scaling', desc: 'Increase N (loops). Trace oscillates faster at same Ω. Double N → double phase sensitivity.' },
      { step: 4, title: 'Change Wavelength', desc: 'Switch red→violet. Phase shift increases (Δφ ∝ 1/λ). Faster oscillation.' },
      { step: 5, title: 'Read Data Overlay', desc: 'Check CW/CCW speeds, Δt, ΔN, area A. Verify Δt = 4AΩ/c².' },
      { step: 6, title: 'Test Ω_min', desc: 'Set Ω = 0.001 rad/s. Tiny fringe shift → motivates why FOGs need >1000 loops.' },
    ],
    quiz: [
      { id: 'sa1', q: 'At Ω = 0, what is the phase difference?', options: ['π', '0', 'π/2', 'Depends on λ'], answer: 1, explanation: 'No rotation → same path for both beams → OPD = 0 → Δφ = 0.' },
      { id: 'sa2', q: 'Doubling fiber loops does what to Δφ?', options: ['Nothing', 'Doubles it', 'Halves it', 'Squares it'], answer: 1, explanation: 'Δφ = 8πNAΩ/(λc). N linear → doubling N doubles Δφ.' },
      { id: 'sa3', q: 'Why is Sagnac immune to vibration?', options: ['Uses vacuum', 'Both beams share same path (common-mode rejection)', 'Electronic filtering', 'Fiber absorbs vibration'], answer: 1, explanation: 'CW and CCW beams traverse the exact same path. Any reciprocal perturbation cancels. Only rotation (non-reciprocal) produces signal.' },
      { id: 'sa4', q: 'The Sagnac effect measures:', options: ['Light mass', 'Absolute rotation', 'Speed-of-light variation', 'Laser coherence'], answer: 1, explanation: 'Sagnac detects absolute rotation without external reference — proven in 1913.' },
      { id: 'sa5', q: 'Switching HeNe (633 nm) → violet (405 nm) changes sensitivity by:', options: ['+56%', '−56%', 'No change', '+100%'], answer: 0, explanation: 'Δφ ∝ 1/λ. Factor = 633/405 ≈ 1.56. Sensitivity increases by 56%.' },
    ],
  },
};

/* ─────────────────────────────────────────────────────────
   SUB-COMPONENTS
   ───────────────────────────────────────────────────────── */

const TheorySection = ({ data }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    {data.map((sec, i) => (
      <div key={i} className="glass-card" style={{ borderRadius: 12, padding: '20px 24px' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 10, letterSpacing: '0.05em' }}>
          {sec.heading}
        </h3>
        <p style={{ fontSize: 11, lineHeight: 1.7, color: 'rgba(255,255,255,0.65)', whiteSpace: 'pre-line' }}>
          {sec.body}
        </p>
        {sec.formula && (
          <div style={{
            marginTop: 12, padding: '10px 16px', borderRadius: 8,
            background: 'rgba(79,156,249,0.08)', border: '1px solid rgba(79,156,249,0.15)',
            fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(79,156,249,0.9)',
            textAlign: 'center', letterSpacing: '0.05em',
          }}>
            {sec.formula}
          </div>
        )}
      </div>
    ))}
  </div>
);

const ProcedureSection = ({ steps }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {steps.map((s) => (
      <div key={s.step} className="glass-card" style={{
        borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(79,156,249,0.15)', border: '1px solid rgba(79,156,249,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: '#4f9cf9', fontFamily: 'var(--font-mono)',
        }}>
          {s.step}
        </div>
        <div>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{s.title}</h4>
          <p style={{ fontSize: 11, lineHeight: 1.6, color: 'rgba(255,255,255,0.55)' }}>{s.desc}</p>
        </div>
      </div>
    ))}
  </div>
);

const QuizCard = ({ item, index, answered, onAnswer }) => {
  const selected = answered[item.id];
  const isAnswered = selected !== undefined;
  const isCorrect = selected === item.answer;

  return (
    <div className="glass-card" style={{
      borderRadius: 12, padding: '20px 24px',
      border: isAnswered
        ? `1px solid ${isCorrect ? 'rgba(45,212,168,0.4)' : 'rgba(240,96,96,0.4)'}`
        : '1px solid rgba(255,255,255,0.06)',
      transition: 'border-color 300ms',
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)',
          fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', flexShrink: 0,
        }}>
          Q{index + 1}
        </span>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.5 }}>{item.q}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: isAnswered ? 14 : 0 }}>
        {item.options.map((opt, oi) => {
          const isThis = selected === oi;
          const isRight = oi === item.answer;
          let bg = 'rgba(255,255,255,0.04)';
          let border = 'rgba(255,255,255,0.08)';
          let color = 'rgba(255,255,255,0.6)';

          if (isAnswered) {
            if (isRight) { bg = 'rgba(45,212,168,0.1)'; border = 'rgba(45,212,168,0.4)'; color = '#2dd4a8'; }
            else if (isThis && !isRight) { bg = 'rgba(240,96,96,0.1)'; border = 'rgba(240,96,96,0.4)'; color = '#f06060'; }
          }

          return (
            <button key={oi} onClick={() => !isAnswered && onAnswer(item.id, oi)} disabled={isAnswered} style={{
              textAlign: 'left', padding: '10px 14px', borderRadius: 8, cursor: isAnswered ? 'default' : 'pointer',
              background: bg, border: `1px solid ${border}`, color,
              fontSize: 11, lineHeight: 1.4, fontFamily: 'inherit', transition: 'all 200ms',
              opacity: isAnswered && !isRight && !isThis ? 0.4 : 1,
            }}>
              <span style={{ fontWeight: 700, marginRight: 8, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                {String.fromCharCode(65 + oi)}.
              </span>
              {opt}
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <div style={{
          padding: '12px 14px', borderRadius: 8,
          background: isCorrect ? 'rgba(45,212,168,0.06)' : 'rgba(240,96,96,0.06)',
          border: `1px solid ${isCorrect ? 'rgba(45,212,168,0.15)' : 'rgba(240,96,96,0.15)'}`,
        }}>
          <p style={{
            fontSize: 10, fontWeight: 700, marginBottom: 4,
            color: isCorrect ? '#2dd4a8' : '#f06060',
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            {isCorrect ? '✓ Correct' : '✗ Incorrect'}
          </p>
          <p style={{ fontSize: 11, lineHeight: 1.5, color: 'rgba(255,255,255,0.55)' }}>
            {item.explanation}
          </p>
        </div>
      )}
    </div>
  );
};

const AssessmentSection = ({ quiz }) => {
  const [answered, setAnswered] = useState({});

  const onAnswer = useCallback((id, idx) => {
    setAnswered(prev => ({ ...prev, [id]: idx }));
  }, []);

  const total = quiz.length;
  const done = Object.keys(answered).length;
  const correct = quiz.filter(q => answered[q.id] === q.answer).length;

  return (
    <div>
      {/* Score bar */}
      {done > 0 && (
        <div className="glass-card" style={{
          borderRadius: 12, padding: '14px 20px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
              Progress: {done}/{total}
            </span>
            <div style={{ width: 120, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${(done / total) * 100}%`, height: '100%', background: '#4f9cf9', borderRadius: 2, transition: 'width 300ms' }} />
            </div>
          </div>
          <span style={{
            fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: correct === done ? '#2dd4a8' : correct > done / 2 ? '#f5a623' : '#f06060',
          }}>
            {correct}/{done} correct
          </span>
        </div>
      )}

      {/* Quiz cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {quiz.map((item, i) => (
          <QuizCard key={item.id} item={item} index={i} answered={answered} onAnswer={onAnswer} />
        ))}
      </div>

      {/* Final score */}
      {done === total && (
        <div className="glass-card" style={{
          borderRadius: 12, padding: '24px 28px', marginTop: 20, textAlign: 'center',
          border: `1px solid ${correct >= 4 ? 'rgba(45,212,168,0.3)' : correct >= 2 ? 'rgba(245,166,35,0.3)' : 'rgba(240,96,96,0.3)'}`,
        }}>
          <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#fff', marginBottom: 4 }}>
            {correct}/{total}
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
            {correct === total ? 'Perfect Score! Excellent understanding.' :
             correct >= 4 ? 'Great work! Strong grasp of the concepts.' :
             correct >= 2 ? 'Good effort. Review the explanations above.' :
             'Keep studying. Re-read the Theory section and try again.'}
          </p>
          <button onClick={() => setAnswered({})} style={{
            padding: '8px 24px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(79,156,249,0.15)', border: '1px solid rgba(79,156,249,0.3)',
            borderRadius: 8, color: '#4f9cf9', fontFamily: 'inherit',
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Retake Quiz
          </button>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
   MAIN LAB PAGE
   ───────────────────────────────────────────────────────── */

const SUB_TABS = [
  { id: 'theory', label: 'Theory', icon: '📖' },
  { id: 'procedure', label: 'Procedure', icon: '🔬' },
  { id: 'assessment', label: 'Assessment', icon: '✎' },
];

const LabPage = () => {
  const interferometerType = useSimulationStore((s) => s.interferometerType);
  const [subTab, setSubTab] = useState('theory');

  const content = CONTENT[interferometerType] || CONTENT.mzi;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Sub-tab navigation */}
      <div style={{
        padding: '12px 32px', display: 'flex', gap: 6, alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.15em', textTransform: 'uppercase', marginRight: 24 }}>
          {content.title}
        </h2>
        {SUB_TABS.map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id)} style={{
            padding: '7px 18px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
            borderRadius: 8, fontFamily: 'inherit', letterSpacing: '0.08em',
            textTransform: 'uppercase', transition: 'all 200ms',
            color: subTab === tab.id ? '#000' : 'rgba(255,255,255,0.45)',
            background: subTab === tab.id ? '#fff' : 'rgba(255,255,255,0.04)',
            border: subTab === tab.id ? '1px solid #fff' : '1px solid rgba(255,255,255,0.08)',
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 32px 40px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {subTab === 'theory' && <TheorySection data={content.theory} />}
          {subTab === 'procedure' && <ProcedureSection steps={content.procedure} />}
          {subTab === 'assessment' && <AssessmentSection quiz={content.quiz} />}
        </div>
      </div>
    </div>
  );
};

export default LabPage;
