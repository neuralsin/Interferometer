import React, { useRef, useEffect, useMemo } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { rayleighRange, beamRadius, gouyPhase } from '../physics/gaussianBeam.js';
import { coherenceLength as calcCoherenceLength, lorentzianPSD } from '../physics/coherenceModel.js';
import { seismicNoise, wienerPhaseNoise } from '../physics/noiseGenerator.js';
import { SliderControl } from './BeginnerPanel.jsx';

/**
 * Wave Optics & Noise Configuration tab — maps to:
 *   unified_physics_noise_config (V3 reference)
 *
 * Surfaces backend engines:
 *   - gaussianBeam.js (w0, zR, Gouy phase, beam profile canvas)
 *   - coherenceModel.js (coherence length, PSD)
 *   - noiseGenerator.js (phase noise, seismic, 1/f — toggles + readouts)
 *   - thermalModel.js (CTE, material select, temp)
 *   - detectorModel.js (dark current, QE, resolution)
 */
const PhysicsNoisePanel = () => {
  const state = useSimulationStore();
  const { setParam } = state;
  const beamCanvasRef = useRef(null);
  const psdCanvasRef = useRef(null);

  // Derived backend values
  const armX = Math.sqrt(state.mirror1PosX ** 2 + state.mirror1PosZ ** 2);
  const zR = rayleighRange(state.beamWaist, state.wavelength);
  const wz = beamRadius(state.beamWaist, armX * 2, zR);
  const gouy = gouyPhase(armX * 2, zR);
  const cohLength = calcCoherenceLength(state.laserLinewidth);

  // Draw Gaussian beam profile using REAL physics
  useEffect(() => {
    const canvas = beamCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const draw = () => {
      const w2 = canvas.offsetWidth || 300;
      const h2 = canvas.offsetHeight || 150;
      canvas.width = w2 * 2;
      canvas.height = h2 * 2;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Real physics: zR = π w₀² / λ
      const w0 = state.beamWaist;
      const zRVal = Math.PI * w0 * w0 / state.wavelength;
      // Scale: map ±3*zR to canvas width
      const zRange = 3 * zRVal;
      const waistPixels = Math.max(8, Math.min(h * 0.3, (w0 / (w0 * 4)) * h * 0.3));

      const midH = h / 2;
      const waistX = w / 2;

      // Axis
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(0, midH); ctx.lineTo(w, midH); ctx.stroke();
      ctx.setLineDash([]);
      // Vertical line at waist
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath(); ctx.moveTo(waistX, 0); ctx.lineTo(waistX, h); ctx.stroke();

      // Beam envelope: w(z) = w0 * sqrt(1 + (z/zR)²)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x <= w; x++) {
        const z = ((x - waistX) / (w / 2)) * zRange;
        const wz = w0 * Math.sqrt(1 + (z / zRVal) ** 2);
        const pixelH = (wz / w0) * waistPixels;
        if (x === 0) ctx.moveTo(x, midH - pixelH);
        else ctx.lineTo(x, midH - pixelH);
      }
      for (let x = w; x >= 0; x--) {
        const z = ((x - waistX) / (w / 2)) * zRange;
        const wz = w0 * Math.sqrt(1 + (z / zRVal) ** 2);
        const pixelH = (wz / w0) * waistPixels;
        ctx.lineTo(x, midH + pixelH);
      }
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0.03)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
      grad.addColorStop(1, 'rgba(255,255,255,0.03)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.stroke();

      // Waist indicator
      ctx.strokeStyle = 'rgba(79,156,249,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(waistX, midH - waistPixels); ctx.lineTo(waistX, midH + waistPixels); ctx.stroke();
      ctx.fillStyle = 'rgba(79,156,249,0.5)'; ctx.font = `${Math.max(10, w * 0.02)}px monospace`; ctx.textAlign = 'left';
      ctx.fillText('w₀', waistX + 4, midH - waistPixels - 4);

      // Z axis labels
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = `${Math.max(9, w * 0.015)}px monospace`; ctx.textAlign = 'center';
      ctx.fillText('-z_R', w * 0.25, h - 6);
      ctx.fillText('0', waistX, h - 6);
      ctx.fillText('+z_R', w * 0.75, h - 6);

      // Formula
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = `${Math.max(8, w * 0.013)}px monospace`; ctx.textAlign = 'left';
      ctx.fillText('w(z) = w₀√(1+(z/z_R)²)', 6, 14);
    };
    draw();
    const obs = new ResizeObserver(draw);
    obs.observe(canvas.parentElement);
    return () => obs.disconnect();
  }, [state.beamWaist, state.wavelength]);

  // Draw PSD as continuous wave/line graph on canvas (replaces bar graph)
  useEffect(() => {
    const canvas = psdCanvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const pw = parent.clientWidth;
      const ph = parent.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = pw * dpr; canvas.height = ph * dpr;
      canvas.style.width = pw + 'px'; canvas.style.height = ph + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      const pad = { top: 12, right: 16, bottom: 28, left: 42 };
      const plotW = pw - pad.left - pad.right;
      const plotH = ph - pad.top - pad.bottom;

      ctx.clearRect(0, 0, pw, ph);

      // Compute PSD curve (log frequency axis)
      const numPoints = 200;
      const fMin = 0.1, fMax = 20000;
      const linewidth = state.laserLinewidth;
      const maxPSD = lorentzianPSD(0, linewidth);
      const maxPSDdB = maxPSD > 0 ? 10 * Math.log10(maxPSD) : 0;
      const points = [];

      for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        const freq = fMin * Math.pow(fMax / fMin, t);
        const psd = lorentzianPSD(freq, linewidth);
        const psdDB = psd > 0 ? 10 * Math.log10(psd) : -100;
        points.push({ freq, psdDB });
      }

      const yMin = maxPSDdB - 60;
      const yMax = maxPSDdB + 5;
      const toX = (f) => pad.left + (Math.log10(f / fMin) / Math.log10(fMax / fMin)) * plotW;
      const toY = (db) => pad.top + plotH * (1 - (db - yMin) / (yMax - yMin));

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      [1, 10, 100, 1000, 10000].forEach(f => {
        const x = toX(f);
        ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + plotH); ctx.stroke();
      });
      for (let db = yMin; db <= yMax; db += 10) {
        const y = toY(db);
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + plotW, y); ctx.stroke();
      }

      // Filled area under curve
      ctx.beginPath();
      ctx.moveTo(toX(points[0].freq), toY(yMin));
      points.forEach(p => ctx.lineTo(toX(p.freq), toY(p.psdDB)));
      ctx.lineTo(toX(points[points.length - 1].freq), toY(yMin));
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
      grad.addColorStop(0, 'rgba(255,255,255,0.12)');
      grad.addColorStop(1, 'rgba(255,255,255,0.01)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      points.forEach((p, i) => {
        const x = toX(p.freq), y = toY(p.psdDB);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Seismic noise overlay (if enabled)
      if (state.seismicNoiseEnabled) {
        ctx.beginPath();
        for (let i = 0; i < numPoints; i++) {
          const t = i / (numPoints - 1);
          const freq = fMin * Math.pow(fMax / fMin, t);
          const seismicPSD = 1e-18 / (1 + (freq / state.seismicFrequency) ** 4);
          const db = seismicPSD > 0 ? 10 * Math.log10(seismicPSD) : yMin;
          const clampDB = Math.max(yMin, Math.min(yMax, db));
          const x = toX(freq), y = toY(clampDB);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(79,156,249,0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // X axis labels
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
      [0.1, 1, 10, 100, 1000, 10000].forEach(f => {
        const x = toX(f);
        if (x >= pad.left && x <= pw - pad.right) {
          ctx.fillText(f >= 1000 ? `${f / 1000}k` : f.toString(), x, ph - 6);
        }
      });
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '7px sans-serif';
      ctx.fillText('Frequency (Hz)', pad.left + plotW / 2, ph - 1);

      // Y axis labels
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '7px monospace';
      for (let db = yMin; db <= yMax; db += 15) {
        const y = toY(db);
        if (y >= pad.top && y <= pad.top + plotH) {
          ctx.fillText(db.toFixed(0), pad.left - 3, y + 3);
        }
      }
      ctx.save();
      ctx.translate(8, pad.top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('PSD (dB/Hz)', 0, 0);
      ctx.restore();
    };
    draw();
    const obs = new ResizeObserver(draw);
    obs.observe(canvas.parentElement);
    return () => obs.disconnect();
  }, [state.laserLinewidth, state.seismicNoiseEnabled, state.seismicFrequency]);

  // Compute live seismic injection RMS from noiseGenerator.js
  const seismicRMS = useMemo(() => {
    const data = seismicNoise(256, 1/60, 1e-9);
    let sumSq = 0;
    for (let i = 0; i < data.length; i++) sumSq += data[i] * data[i];
    return Math.sqrt(sumSq / data.length);
  }, [state.seismicNoiseEnabled]);

  // Compute live phase noise integral from noiseGenerator.js
  const phaseNoiseIntegral = useMemo(() => {
    const data = wienerPhaseNoise(256, 1/60, state.laserLinewidth);
    let sumSq = 0;
    for (let i = 0; i < data.length; i++) sumSq += data[i] * data[i];
    return Math.sqrt(sumSq / data.length);
  }, [state.laserLinewidth, state.phaseNoiseEnabled]);

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }}>
            <FlaskSvg />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.2em', color: '#fff', textTransform: 'uppercase' }}>
              Simulation Configuration
            </h1>
            <p style={{ fontSize: 10, color: 'var(--text-mercury)', textTransform: 'uppercase', letterSpacing: '0.3em', opacity: 0.7 }}>
              Engine v4.2.0-Alpha | Quantum Optical Research
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-ghost" onClick={() => useSimulationStore.getState().resetToDefaults()}>RESET_DEFAULTS</button>
          <button className="btn-primary" onClick={() => {
            const s = useSimulationStore.getState();
            const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'physics_constants.json'; a.click();
            URL.revokeObjectURL(url);
          }}>EXPORT_CONSTANTS</button>
        </div>
      </div>

      {/* Main Grid — 12 col */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, flex: 1 }}>

        {/* Wave Optics (Left) */}
        <section className="glass-card" style={{ borderRadius: 'var(--radius-md)', padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
            <h2 className="label-section">Wave Optics</h2>
            <span style={{ fontSize: 8, border: '1px solid rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 'var(--radius-full)', color: 'var(--text-mercury)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              w₀={((state.beamWaist * 1e6)).toFixed(1)}μm
            </span>
          </div>

          <SliderControl label="Beam Waist (w₀)" unit="μm"
            value={state.beamWaist * 1e6} min={0.1} max={500} step={0.1}
            onChange={(um) => setParam('beamWaist', um * 1e-6)}
            formatValue={(v) => v.toFixed(1)} />

          <div className="slider-row">
            <div className="slider-row-label">
              <span>Rayleigh Range (z_R)</span>
              <span className="slider-value">{(zR * 1e3).toFixed(2)} mm</span>
            </div>
          </div>

          <div className="slider-row">
            <div className="slider-row-label">
              <span>Gouy Phase (ψ)</span>
              <span className="slider-value">{(gouy / Math.PI).toFixed(3)}π rad</span>
            </div>
          </div>

          <div className="slider-row">
            <div className="slider-row-label">
              <span>Coherence Length</span>
              <span className="slider-value">{(cohLength * 1e3).toFixed(1)} mm</span>
            </div>
          </div>

          {/* Beam Profile Canvas */}
          <div style={{ flex: 1, marginTop: 16, borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden', minHeight: 150 }}>
            <div className="viewport-grid" style={{ position: 'absolute', inset: 0, opacity: 0.2 }} />
            <canvas ref={beamCanvasRef} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }} />
            <div style={{ position: 'absolute', bottom: 12, left: 16, fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              LONGITUDINAL_PROFILE
            </div>
          </div>
        </section>

        {/* Noise Profiles (Right) */}
        <section className="glass-card" style={{ borderRadius: 'var(--radius-md)', padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
            <h2 className="label-section">Noise Profiles</h2>
            <div style={{ display: 'flex', gap: 16 }}>
              <NoiseLegend color="white" label="Phase PSD" glow />
              <NoiseLegend color="rgba(255,255,255,0.3)" label="Seismic Inj." />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, flex: 1 }}>
            {/* PSD Wave Graph (Canvas) */}
            <div className="glass-card" style={{ borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden', minHeight: 200 }}>
              <canvas ref={psdCanvasRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 1 }} />
            </div>

            {/* Side Metrics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <MetricTile label="Seismic Injection" value={seismicRMS.toExponential(2)} unit="m/√Hz" progress={Math.min(100, seismicRMS * 1e12 * 50)} />
              <MetricTile label="Phase Noise Integral" value={phaseNoiseIntegral.toFixed(3)} unit="rad RMS" progress={Math.min(100, phaseNoiseIntegral * 300)} />
              <button className="btn-ghost" style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}>
                <DownloadSvg /> Export PSD_Data
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Row: Quantum Effects + Detector Physics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Quantum Effects */}
        <section className="glass-card" style={{ borderRadius: 'var(--radius-md)', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
            <h2 className="label-section">Quantum Effects</h2>
            <ToggleInline label="Shot Noise" paramKey="shotNoiseEnabled" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            <div>
              <h3 style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-mercury)', textTransform: 'uppercase', letterSpacing: '0.15em', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8, marginBottom: 20 }}>
                Squeezed Vacuum
              </h3>
              <SliderControl label="Magnitude" unit=""
                value={state.squeezingParam} min={0} max={3} step={0.01}
                onChange={(v) => setParam('squeezingParam', v)}
                formatValue={(v) => v.toFixed(2)} />
              <SliderControl label="Angle" unit="°"
                value={state.squeezingAngle * 180 / Math.PI} min={0} max={360} step={1}
                onChange={(deg) => setParam('squeezingAngle', deg * Math.PI / 180)}
                formatValue={(v) => v.toFixed(0)} />
            </div>
            {/* Phase Space Visualization */}
            <div className="glass-card" style={{ borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: 128, height: 128, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', width: '100%', height: 0.5, background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ position: 'absolute', height: '100%', width: 0.5, background: 'rgba(255,255,255,0.1)' }} />
                <div style={{
                  width: 80, height: 24,
                  border: '1px solid rgba(255,255,255,0.6)',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '50%',
                  transform: `rotate(${state.squeezingAngle * 180 / Math.PI}deg)`,
                  boxShadow: '0 0 15px rgba(255,255,255,0.1)',
                  transition: 'transform 300ms ease',
                }} />
                <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)' }}>
                  ΔX₁ΔX₂ ≥ 1
                </div>
              </div>
              <p style={{ marginTop: 16, fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase', textAlign: 'center' }}>
                Quadrature Representation
              </p>
            </div>
          </div>
        </section>

        {/* Detector Physics */}
        <section className="glass-card" style={{ borderRadius: 'var(--radius-md)', padding: 24 }}>
          <h2 className="label-section" style={{ marginBottom: 32 }}>Detector Physics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-mercury)', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: 12 }}>
                Quantum Efficiency (η)
              </label>
              <div style={{ position: 'relative' }}>
                <input className="input-field" type="text" value={state.detectorQE.toFixed(2)}
                  onChange={(e) => setParam('detectorQE', Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)))} />
                <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mercury)' }}>
                  {(state.detectorQE * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-mercury)', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: 12 }}>
                Dark Current (i_d)
              </label>
              <div style={{ position: 'relative' }}>
                <input className="input-field" type="text" value={state.detectorDarkCurrent.toFixed(1)}
                  onChange={(e) => setParam('detectorDarkCurrent', parseFloat(e.target.value) || 0)} />
                <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-mercury)', textTransform: 'uppercase' }}>
                  nA/cm²
                </span>
              </div>
            </div>
          </div>

          {/* Grid Res + Cooling */}
          <DetectorRow icon={<GridSvg />} label="Grid Resolution" sublabel={`${state.detectorArrayWidth} x ${state.detectorArrayHeight} PX`}
            right={
              <select value={state.detectorArrayWidth} onChange={(e) => setParam('detectorArrayWidth', parseInt(e.target.value))}>
                <option value={128}>128×128</option>
                <option value={256}>UHD-256</option>
                <option value={512}>HD-512</option>
              </select>
            } />
          <DetectorRow icon={<BoltSvg />} label="Thermal State" sublabel={`T_ENV: ${(state.envTemperature - 273.15).toFixed(1)}°C`}
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff', letterSpacing: '0.15em' }}>
                  {state.thermalDriftEnabled ? 'DRIFT_ON' : 'STABLE'}
                </span>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: state.thermalDriftEnabled ? '#f84' : '#fff' }} />
              </div>
            } />
        </section>
      </div>

      {/* Footer Activity Feed */}
      <div style={{ paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em' }}>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.35)' }}>▪ PHYSICS_ENGINE</span>
          <span>OPD: {(2 * (Math.sqrt(state.mirror1PosX**2 + state.mirror1PosZ**2) - Math.sqrt(state.mirror2PosX**2 + state.mirror2PosZ**2)) * 1e9).toFixed(1)} nm</span>
          <span>λ: {(state.wavelength * 1e9).toFixed(1)}nm</span>
          <span>Lc: {(299792458 / state.laserLinewidth).toFixed(2)}m</span>
        </div>
      </div>
    </div>
    </div>
  );
};

/* ---- Micro Sub-components ---- */
const FlaskSvg = () => (
  <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
  </svg>
);

const DownloadSvg = () => (
  <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

const GridSvg = () => (
  <svg style={{ width: 20, height: 20 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M4 7v10c0 1.1.9 2 2 2h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2zM9 17v-4m3 4v-6m3 6v-2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
  </svg>
);

const BoltSvg = () => (
  <svg style={{ width: 20, height: 20 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
  </svg>
);

const NoiseLegend = ({ color, label, glow }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: glow ? '0 0 8px #fff' : 'none' }} />
    <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-mercury)', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>{label}</span>
  </div>
);

const MetricTile = ({ label, value, unit, progress }) => (
  <div style={{ padding: 16, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
    <p style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-mercury)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>{label}</p>
    <div style={{ fontSize: 20, fontFamily: 'var(--font-mono)', color: '#fff', marginBottom: 8 }}>
      {value} <span style={{ fontSize: 9, opacity: 0.4 }}>{unit}</span>
    </div>
    <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
      <div style={{ height: '100%', background: 'rgba(255,255,255,0.4)', width: `${progress}%` }} />
    </div>
  </div>
);

const ToggleInline = ({ label, paramKey }) => {
  const value = useSimulationStore((s) => s[paramKey]);
  const setParam = useSimulationStore((s) => s.setParam);
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
      <button className="toggle-track" data-active={value}
        onClick={() => setParam(paramKey, !value)} />
      <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{label}</span>
    </label>
  );
};

const DetectorRow = ({ icon, label, sublabel, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 40, height: 40, borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-mercury)' }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{label}</p>
        <p style={{ fontSize: 8, color: 'var(--text-mercury)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>{sublabel}</p>
      </div>
    </div>
    {right}
  </div>
);

const StatusDot = ({ label, opacity }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: `rgba(255,255,255,${opacity})` }} />
    <span>{label}</span>
  </div>
);

export default PhysicsNoisePanel;
