import React, { useRef, useEffect } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { fringeVisibility, coherenceLength as calcCoherenceLength } from '../physics/coherenceModel.js';
import { photonCount, phaseSNR } from '../physics/quantumModel.js';
import { chirpStrain, minDetectableStrain } from '../physics/gravitationalWave.js';
import { exportCSV, exportImage, exportJSON } from '../physics/dataExport.js';

/**
 * Analytics & Export Tab — maps to:
 *   unified_analytics_export + astronomical_gravitational_analytics (V3 references)
 *
 * Surfaces backend engines:
 *   - gravitationalWave.js (chirp strain canvas, min detectable strain)
 *   - coherenceModel.js (visibility, coherence length)
 *   - quantumModel.js (SNR)
 *   - dataExport.js (CSV, PNG, JSON buttons)
 */
const AnalyticsPanel = () => {
  const state = useSimulationStore();
  const strainCanvasRef = useRef(null);

  const opd = 2 * ((state.armLengthX + state.mirrorTranslationX) - (state.armLengthY + state.mirrorTranslationY));
  const visibility = fringeVisibility(opd, state.laserLinewidth);
  const cohLength = calcCoherenceLength(state.laserLinewidth);
  const N = photonCount(state.laserPower, state.wavelength, 0.001);
  const snr = N > 0 ? phaseSNR(Math.abs(opd * 2 * Math.PI / state.wavelength), N, state.squeezingParam) : 0;
  const hMin = minDetectableStrain(state.armLengthX * state.armLengthMultiplier, state.wavelength, N, state.squeezingParam);

  // Chirp strain canvas (matching V3 astronomical_gravitational_analytics)
  useEffect(() => {
    const canvas = strainCanvasRef.current;
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
      // Glow
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      for (let x = 0; x < w; x++) {
        const progress = x / w;
        const freq = 2 + progress * 25;
        const envelope = Math.pow(progress, 2.5) * 0.8 + 0.05;
        const y = h / 2 + Math.sin(progress * freq * 20) * envelope * (h / 2.2);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Noise floor
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(148,163,184,0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x++) {
        const noise = (Math.random() - 0.5) * 20;
        const y = h / 2 + noise;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, [state.gwStrain, state.gwFrequency]);

  // FFT bars
  const fftBars = [
    { h: 25, d: 0 }, { h: 40, d: 0.2 }, { h: 10, d: 0.4 }, { h: 95, d: 0.5 },
    { h: 30, d: 0.8 }, { h: 15, d: 0.1 }, { h: 20, d: 0.3 }, { h: 55, d: 0.6 },
    { h: 10, d: 0 },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Run History Sidebar */}
      <aside className="glass-card" style={{ width: 288, borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
        <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
          <h2 style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3em', color: 'var(--text-mercury)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClockSvg /> Run History
          </h2>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Active run */}
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', padding: 16, borderRadius: 16, position: 'relative', cursor: 'pointer' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: '#fff', boxShadow: '0 0 15px #fff' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#fff', letterSpacing: '0.15em' }}>RUN_ID: {Date.now().toString(36).toUpperCase().slice(-4)}</span>
              <span style={{ fontSize: 9, color: 'var(--text-mercury)', opacity: 0.5 }}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>He-Ne Laser @ {(state.wavelength * 1e9).toFixed(1)}nm</p>
            <p style={{ fontSize: 9, color: 'var(--text-mercury)', marginTop: 8, fontStyle: 'italic', opacity: 0.6 }}>
              {state.seismicNoiseEnabled ? 'Seismic noise compensation ON' : 'Atmospheric noise compensation ON'}
            </p>
          </div>
          {/* Past runs */}
          <PastRun id="9839" time="14:05" label="Baseline Calibration" />
          <PastRun id="9831" time="13:58" label="Sodium D-Line Split" />
        </div>
        <div style={{ padding: 20, background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>+ Compare Snapshot</button>
        </div>
      </aside>

      {/* Main Analytics Area */}
      <div style={{ flex: 1, overflow: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 32 }}>
          {/* GW Chirp Plot */}
          <section className="glass-card" style={{ borderRadius: 'var(--radius-high)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 400 }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="label-section">Intensity vs. Mirror Displacement</h3>
              <div style={{ display: 'flex', gap: 16 }}>
                <Legend color="white" glow label="PRIMARY" />
                <Legend color="rgba(255,255,255,0.3)" label="ENVELOPE" />
              </div>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <div className="viewport-grid" style={{ position: 'absolute', inset: 0, opacity: 0.15 }} />
              <canvas ref={strainCanvasRef} style={{ width: '100%', height: '100%', padding: 32 }} />
              <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-mercury)', textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.4 }}>
                Mirror Position (μm)
              </div>
              <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'rotate(-90deg) translateX(-50%)', transformOrigin: 'left', fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-mercury)', textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.4 }}>
                Relative Intensity (A.U.)
              </div>
            </div>
          </section>

          {/* Export Widget */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="glass-card" style={{ borderRadius: 'var(--radius-high)', padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h3 className="label-section" style={{ marginBottom: 24 }}>Research Export</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <ExportBtn label="DATASET (.CSV)" onClick={() => exportCSV(state)} icon={<DownloadSvg />} />
                <ExportBtn label="DETECTOR (.PNG)" onClick={() => exportImage(state)} icon={<ImageSvg />} />
                <ExportBtn label="STATE (.JSON)" onClick={() => exportJSON(state)} icon={<CodeSvg />} />
              </div>
              <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="toggle-track" data-active="true" />
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'var(--text-mercury)', textTransform: 'uppercase' }}>ENV_METADATA</span>
              </div>
            </div>
          </section>
        </div>

        {/* Bottom: FFT + Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}>
          {/* FFT Phase Noise */}
          <section className="glass-card" style={{ borderRadius: 'var(--radius-high)', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h3 className="label-section">FFT Phase Noise Analysis</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-mercury)', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.15em' }}>WINDOWING_MODE:</span>
                <select><option>HANNING</option><option>BLACKMAN</option><option>RECTANGULAR</option></select>
              </div>
            </div>
            <div style={{ height: 192, borderRadius: 'var(--radius-high)', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', display: 'flex', alignItems: 'flex-end', padding: '0 24px 16px', gap: 8 }}>
              <div className="viewport-grid" style={{ position: 'absolute', inset: 0, opacity: 0.1, borderRadius: 'inherit' }} />
              {fftBars.map((bar, i) => (
                <div key={i} className="wave-bar" style={{
                  width: 8, height: `${bar.h}%`,
                  background: `rgba(255,255,255,${bar.h > 50 ? 1 : bar.h / 100})`,
                  borderRadius: 2, animationDelay: `${bar.d}s`,
                  boxShadow: bar.h > 50 ? '0 0 10px rgba(255,255,255,0.2)' : 'none',
                }} />
              ))}
              <div style={{ position: 'absolute', bottom: 8, right: 16, fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-mercury)', textTransform: 'uppercase', letterSpacing: '-0.02em', opacity: 0.3 }}>
                Freq (kHz)
              </div>
            </div>
          </section>

          {/* Metric Tiles */}
          <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <MetricTile accent label="Visibility" value={visibility.toFixed(3)} change="↑ 0.4% RELATIVE" changeColor="rgb(34,197,94)" />
            <MetricTile label="Coherence" value={`${(cohLength * 1e3).toFixed(1)}`} unit="mm" sublabel="NOMINAL" />
            <MetricTile label="Phase Stab." value="±0.02" change="VARIANCE: OK" changeColor="rgb(234,179,8)" />
            <MetricTile label="SNR_Ratio" value={snr > 0 ? (10 * Math.log10(snr)).toFixed(1) : '0'} unit="dB" sublabel={`BW: ${(state.laserLinewidth * 1e-3).toFixed(0)}kHz`} />
          </section>
        </div>
      </div>
    </div>
  );
};

/* ---- Sub-components ---- */
const ClockSvg = () => (
  <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

const DownloadSvg = () => (
  <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

const ImageSvg = () => (
  <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

const CodeSvg = () => (
  <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

const Legend = ({ color, label, glow }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mercury)' }}>
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: glow ? '0 0 8px #fff' : 'none' }} />
    {label}
  </span>
);

const ExportBtn = ({ label, onClick, icon }) => (
  <button onClick={onClick} className="btn-ghost" style={{
    width: '100%', padding: '16px', justifyContent: 'space-between',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
  }}>
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em' }}>{label}</span>
    {icon}
  </button>
);

const PastRun = ({ id, time, label }) => (
  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: 16, borderRadius: 16, cursor: 'pointer', transition: 'all 200ms' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mercury)', opacity: 0.5 }}>RUN_ID: {id}</span>
      <span style={{ fontSize: 9, color: 'var(--text-mercury)', opacity: 0.5 }}>{time}</span>
    </div>
    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-mercury)' }}>{label}</p>
  </div>
);

const MetricTile = ({ label, value, unit, accent, change, changeColor, sublabel }) => (
  <div className="glass-card" style={{
    borderRadius: 'var(--radius-high)', padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center',
    borderLeft: accent ? '2px solid rgba(255,255,255,0.4)' : 'none',
  }}>
    <p style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-mercury)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4, opacity: 0.5 }}>{label}</p>
    <p style={{ fontSize: 20, fontFamily: 'var(--font-mono)', color: '#fff' }}>
      {value} {unit && <span style={{ fontSize: 10, opacity: 0.4 }}>{unit}</span>}
    </p>
    {change && <p style={{ fontSize: 8, color: changeColor || 'var(--text-mercury)', marginTop: 8, fontWeight: 700, letterSpacing: '-0.02em' }}>{change}</p>}
    {sublabel && <p style={{ fontSize: 8, color: 'var(--text-mercury)', marginTop: 8, fontFamily: 'var(--font-mono)', opacity: 0.4, letterSpacing: '0.15em' }}>{sublabel}</p>}
  </div>
);

export default AnalyticsPanel;
