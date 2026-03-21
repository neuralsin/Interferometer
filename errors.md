# Comprehensive System Level Audit

## 1. Why The Graph Was a Flat Line (The Time-vs-Space Issue)
The widget plotted the **time-series history of the central detector intensity**: `I(t) = 0.5 * (1 + V * cos(k * OPD))`. 

In all optical homodyne interferometers (Mach-Zehnder, Michelson, Sagnac), if the physical components (mirrors, gas pressure, rotation speed) are stationary, the Optical Path Difference (OPD) is a **constant scaler**. Because the OPD doesn't change over time, the intensity `I(t)` does not change over time. Plotting a constant value across a moving time axis physically results in a perfectly flat horizontal line (e.g., a straight line at `1.0` or `0.025`). **This is a physically accurate representation of a static system.** The graph will only draw a "sine wave" if an element is actively moving (e.g., clicking "Animate M2").

Your Equation Academy reference image shows a mathematical **Parametric Extrapolation** ($f(t) = \cos(kt)$) which maps a spatial coordinate to a time axis. To replicate that continuous wave natively without mirrors moving, see the Solutions at the bottom.

## 2. Why The Graph Color Was Not Wavelength Synced
**Bug Pinpointed:** In the initial generation of `FringeExtrapolation.jsx`, I wrote explicit hard-coded RGB values to rapidly differentiate the interferometers (Green for Michelson, Gold for Sagnac, Cyan for Mach-Zehnder). 

**The Fix:** I completely bypassed the existing `wavelengthToColor(state.wavelength)` helper located in `src/physics/basicInterference.js`. The correct implementation must import `wavelengthToColor` and map the laser wavelength directly to the canvas `strokeStyle`. This was a cosmetic shortcut on my part for the line colors.

## 3. Was The Data Cosmetic or Placeholder?
**Audit Result: ZERO PLACEHOLDERS IN DATA.**
Despite the flat-line appearance and the hardcoded colors, the actual underlying math generating the data points was **100% physically real**.
- The `I_center` was dynamically computed exactly via `computeOPD(st)` in `src/store/simulationStore.js`.
- It accounted for exact laser wavelength ($k=2\pi/\lambda$).
- It dynamically folded in real-time fringe visibility `V` based on laser linewidth and coherence length.
- The flat line sat at precisely `I=0.0253` in your Michelson screenshot because the exact physical properties (Gas OPD of 29300nm, etc.) dictated a 97.5% destructive interference state at the center of the detector. 

**Codebase Scan for Placeholders:**
A deep scan of `BottomBar.jsx` confirming `Phase Density Profile`, `Interferogram Thumb`, and the metrics verifies that **no cosmetic placeholders exist in the data pipeline**. The `profileData` computes exactly 128 real spatial points across a mathematically accurate 10mm detector aperture.

## 4. Renaming "Fringe Extrapolation" (Scientific Nomenclature)
"Fringe Extrapolation" is mathematically descriptive but physically vague. If we are tracking the intensity mapped over an axis, it needs a proper scientific name:

- If tracking continuous intensity over time dynamically: **"Time-Domain Homodyne Trace"** or **"Temporal Interferogram Superposition"**.
- If mapping the fast electric field beat: **"Heterodyne Beat Signal Envelope"**.
- If unfolding the spatial fringe pattern (Option 2 below): **"Spatiotemporal Fringogram"**.

**Suggested Name:** `Time-Domain Homodyne Trace` (or simply `Interferogram Trace`). It is precise, standard optics terminology lacking any "bullshit". 

---

## 5. The Solution: How to get the Sweeping Sine Wave Continuously
To mathematically generate the continuous sine sweep dynamically as requested—without faking the physics or using cosmetic placeholders—we must implement one of these two physics-accurate models:

### Fix Option A: Electric Field Superposition (heterodyne-style envelope mapping)
Instead of plotting the slow, time-averaged Intensity ($I = |E|^2$), we plot a computationally slowed-down superposition of the **Electric Field waves (E-fields)** arriving at the detector.
- Beams are electromagnetic waves: $E_1(t) = \cos(\omega t)$ and $E_2(t) = \cos(\omega t + \Delta\phi)$
- The plotted sweep is $E_{total}(t) = E_1(t) + E_2(t)$.
- As time progresses, this will draw a continuous, sweeping, fast-moving sine wave. The *amplitude* of this sweeping envelope is governed exactly by the static phase $\Delta\phi$. This perfectly matches the "Phasor and Wave" visual from your Equation Academy reference, using 100% real data.

### Fix Option B: The Spatiotemporal (Fringe) Scanner
Instead of tracking *time* at the exact center of the detector, the graph continuously sweeps *space* ($x$) across the detector face.
- We simulate a "camera scanner" reading pixels from $x = -R$ to $x = +R$. 
- The equation becomes $I(x) = 0.5 \cdot (1 + V \cos(k \cdot OPD + \text{tilt} \cdot x))$.
- Even if the mirror is stationary, scanning across the space explicitly maps out the spatial sine-wave fringes into a sweeping plot.

**Let me know if you would like me to rewrite the Time-Domain Homodyne Trace widget using Option A or Option B.**
