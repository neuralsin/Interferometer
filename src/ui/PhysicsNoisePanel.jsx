import React, { useRef, useEffect } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { rayleighRange, beamRadius, gouyPhase } from '../physics/gaussianBeam.js';
import { coherenceLength as calcCoherenceLength } from '../physics/coherenceModel.js';
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

  // Derived backend values
  const zR = rayleighRange(state.beamWaist, state.wavelength);
  const wz = beamRadius(state.beamWaist, state.armLengthX * 2, zR);
  const gouy = gouyPhase(state.armLengthX * 2, zR);
  const cohLength = calcCoherenceLength(state.laserLinewidth);

  // Draw Gaussian beam profile (matching V3 canvas)
  useEffect(() => {
    const canvas = beamCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      draw();
    };
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      // Axis
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Beam profile (diverging Gaussian)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const midH = h / 2;
      const waistX = w / 2;
      for (let x = 0; x <= w; x++) {
        const z = (x - waistX) / (w / 4);
        const waist = 10 * Math.sqrt(1 + z * z);
        if (x === 0) ctx.moveTo(x, midH - waist);
        else ctx.lineTo(x, midH - waist);
      }
      for (let x = w; x >= 0; x--) {
        const z = (x - waistX) / (w / 4);
        const waist = 10 * Math.sqrt(1 + z * z);
        ctx.lineTo(x, midH + waist);
      }
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0.05)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
      grad.addColorStop(1, 'rgba(255,255,255,0.05)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.stroke();
    };
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, [state.beamWaist, state.wavelength]);

  // Animated noise bars
  const noiseBars = Array.from({ length: 15 }, (_, i) => ({
    h: 20 + Math.random() * 80,
    o: 0.1 + Math.random() * 0.9,
    delay: (i * 0.1).toFixed(1),
  }));

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
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
          <button className="btn-primary">APPLY_CONSTANTS</button>
        </div>
      </div>

      {/* Main Grid — 12 col */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, flex: 1 }}>

        {/* Wave Optics (Left) */}
        <section className="glass-card" style={{ borderRadius: 'var(--radius-md)', padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
            <h2 className="label-section">Wave Optics</h2>
            <span style={{ fontSize: 8, border: '1px solid rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 'var(--radius-full)', color: 'var(--text-mercury)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              Propagation_Active
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
            {/* PSD Graph */}
            <div className="glass-card" style={{ borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
              <div className="viewport-grid" style={{ position: 'absolute', inset: 0, opacity: 0.1 }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 40px 48px', gap: 6 }}>
                {noiseBars.map((bar, i) => (
                  <div key={i} className="wave-bar" style={{
                    width: 4, height: `${bar.h}%`,
                    background: `rgba(255,255,255,${bar.o * 0.5})`,
                    borderRadius: 2, animationDelay: `${bar.delay}s`,
                  }} />
                ))}
              </div>
              <div style={{ position: 'absolute', bottom: 12, left: 32, right: 32, display: 'flex', justifyContent: 'space-between', fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)' }}>
                <span>0.1 Hz</span><span>100 Hz</span><span>10 kHz</span>
              </div>
              <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'rotate(-90deg) translateX(-50%)', transformOrigin: 'left', fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)' }}>
                DENSITY (dB/Hz)
              </div>
            </div>

            {/* Side Metrics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <MetricTile label="Seismic Injection" value="1.42e-12" unit="m/√Hz" progress={68} />
              <MetricTile label="Phase Noise Integral" value="0.084" unit="rad RMS" progress={24} />
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
                value={state.polarizerAngle * 180 / Math.PI} min={0} max={360} step={1}
                onChange={(deg) => setParam('polarizerAngle', deg * Math.PI / 180)}
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
                  transform: `rotate(${state.polarizerAngle * 180 / Math.PI}deg)`,
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
                <input className="input-field" type="text" value={state.quantumEfficiency.toFixed(2)}
                  onChange={(e) => setParam('quantumEfficiency', Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)))} />
                <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mercury)' }}>
                  {(state.quantumEfficiency * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-mercury)', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: 12 }}>
                Dark Current (i_d)
              </label>
              <div style={{ position: 'relative' }}>
                <input className="input-field" type="text" value={state.darkCurrent.toFixed(1)}
                  onChange={(e) => setParam('darkCurrent', parseFloat(e.target.value) || 0)} />
                <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-mercury)', textTransform: 'uppercase' }}>
                  nA/cm²
                </span>
              </div>
            </div>
          </div>

          {/* Grid Res + Cooling */}
          <DetectorRow icon={<GridSvg />} label="Grid Resolution" sublabel={`${state.detectorResolution} x ${state.detectorResolution} PX`}
            right={
              <select value={state.detectorResolution} onChange={(e) => setParam('detectorResolution', parseInt(e.target.value))}>
                <option value={128}>128×128</option>
                <option value={256}>UHD-256</option>
                <option value={512}>HD-512</option>
              </select>
            } />
          <DetectorRow icon={<BoltSvg />} label="Cooling Target" sublabel="CRYO_STATE: 4.2K"
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff', letterSpacing: '0.15em' }}>STABLE</span>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'ping 1.5s infinite' }} />
              </div>
            } />
        </section>
      </div>

      {/* Footer Activity Feed */}
      <div style={{ paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em' }}>
          <StatusDot label="ENGINE: COMPUTING" opacity={0.4} />
          <StatusDot label="LAST SYNC: 2m AGO" opacity={0.2} />
          <span>KERNEL: v18.4.3-STOCHASTIC</span>
        </div>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.15em' }}>
          CID: 0x2A88F4...119D
        </span>
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
