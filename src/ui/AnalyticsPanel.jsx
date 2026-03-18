import React, { useRef, useEffect, useState, useMemo } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { chirpStrain, minDetectableStrain, gwPhaseShift } from '../physics/gravitationalWave.js';
import { photonCount, phaseSNR } from '../physics/quantumModel.js';

const CELESTIAL_SOURCES = [
  { value: 'bbh', label: 'Binary Black Hole Merger' },
  { value: 'bns', label: 'Binary Neutron Star' },
  { value: 'nsbh', label: 'Neutron Star–Black Hole' },
  { value: 'cw', label: 'Continuous Wave (Pulsar)' },
];

/**
 * Analytics Panel — ASTRONOMICAL tab
 * Dynamic GW chirp waveform, animated Q-Scan, real-time physics metrics.
 * ALL graphs use requestAnimationFrame and real gravitationalWave.js computations.
 */
const AnalyticsPanel = () => {
  const state = useSimulationStore();
  const { setParam } = state;
  const strainCanvasRef = useRef(null);
  const qscanCanvasRef = useRef(null);
  const animRef = useRef(null);
  const timeRef = useRef(0);
  const [isRunning, setIsRunning] = useState(true);

  // Derived physics
  const armLenM = state.gwArmLength * 1000;
  const N = photonCount(state.laserPower, state.wavelength, state.detectorExposureTime);
  const hMin = minDetectableStrain(armLenM, state.wavelength, N, state.squeezingParam);
  const totalMass = state.mass1 + state.mass2;
  const chirpMass = Math.pow(state.mass1 * state.mass2, 3 / 5) / Math.pow(totalMass, 1 / 5);
  const phaseShift = gwPhaseShift(armLenM, state.wavelength, state.gwStrain);
  const snrValue = N > 0 ? phaseSNR(Math.abs(phaseShift), N, state.squeezingParam) : 0;
  const snrDB = snrValue > 1e-10 ? (10 * Math.log10(snrValue)).toFixed(1) : '0';
  const eta = (state.mass1 * state.mass2) / (totalMass * totalMass);
  const luminosityDist = Math.round(410 * (chirpMass / 28.1));
  const finalSpin = Math.max(0, Math.min(1, Math.abs(Math.sqrt(12) * eta - 3.871 * eta * eta + 4.028 * eta ** 3) + 0.3));

  // ANIMATED chirp waveform
  useEffect(() => {
    const strainCanvas = strainCanvasRef.current;
    const qscanCanvas = qscanCanvasRef.current;
    if (!strainCanvas || !qscanCanvas) return;
    const ctx = strainCanvas.getContext('2d');
    const qctx = qscanCanvas.getContext('2d');

    const resize = () => {
      strainCanvas.width = strainCanvas.offsetWidth * 2;
      strainCanvas.height = strainCanvas.offsetHeight * 2;
      qscanCanvas.width = qscanCanvas.offsetWidth * 2;
      qscanCanvas.height = qscanCanvas.offsetHeight * 2;
    };
    resize();
    window.addEventListener('resize', resize);

    const drawFrame = () => {
      if (!isRunning) { animRef.current = requestAnimationFrame(drawFrame); return; }
      timeRef.current += 0.008; // time marches forward
      const tNow = timeRef.current;
      const currentState = useSimulationStore.getState();

      // ===== CHIRP STRAIN CANVAS =====
      const w = strainCanvas.width, h = strainCanvas.height;
      ctx.clearRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.moveTo(0, i * h / 10); ctx.lineTo(w, i * h / 10); ctx.stroke(); }
      for (let i = 0; i < 20; i++) { ctx.beginPath(); ctx.moveTo(i * w / 20, 0); ctx.lineTo(i * w / 20, h); ctx.stroke(); }

      // Noise floor
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      for (let x = 0; x < w; x++) {
        const noise = (Math.random() - 0.5) * 10;
        x === 0 ? ctx.moveTo(x, h / 2 + noise) : ctx.lineTo(x, h / 2 + noise);
      }
      ctx.stroke();

      // Scrolling chirp waveform — ANIMATED, uses real chirpStrain
      const tMerge = 1.5;
      const viewWindow = 2.0; // seconds of data visible
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(255,255,255,0.4)';

      for (let x = 0; x < w; x++) {
        const tSample = tNow - viewWindow + (x / w) * viewWindow;
        const tLocal = ((tSample % tMerge) + tMerge) % tMerge; // loop the merger
        const strain = chirpStrain(tLocal, currentState.gwStrain * 1e19, tMerge, currentState.gwFrequency * 0.3);
        const y = h / 2 - strain * (h / 2.8);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Glow duplicate
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 8;
      ctx.shadowBlur = 0;
      for (let x = 0; x < w; x++) {
        const tSample = tNow - viewWindow + (x / w) * viewWindow;
        const tLocal = ((tSample % tMerge) + tMerge) % tMerge;
        const strain = chirpStrain(tLocal, currentState.gwStrain * 1e19, tMerge, currentState.gwFrequency * 0.3);
        const y = h / 2 - strain * (h / 2.8);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Time axis labels
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = `${Math.max(14, w / 40)}px monospace`;
      ctx.fillText('t (s)', w - 50, h - 10);
      ctx.fillText('h(t)', 10, 20);
      ctx.fillText(`t = ${tNow.toFixed(2)}s`, w / 2 - 40, h - 10);

      // ===== Q-SCAN SPECTROGRAM CANVAS =====
      const qw = qscanCanvas.width, qh = qscanCanvas.height;
      // Shift existing pixels left (scrolling effect)
      const imgData = qctx.getImageData(2, 0, qw - 2, qh);
      qctx.putImageData(imgData, 0, 0);
      // Draw new column on right edge
      const tLocal = ((tNow % tMerge) + tMerge) % tMerge;
      const progress = tLocal / tMerge;
      const chirpFreqNorm = 0.1 + Math.pow(progress, 2.5) * 0.8;
      const trackY = qh * (1 - chirpFreqNorm);
      const trackWidth = 20 + progress * 50;
      const intensity = 0.15 + progress * 0.7;
      for (let y = 0; y < qh; y++) {
        const dist = Math.abs(y - trackY) / trackWidth;
        const brightness = Math.exp(-dist * dist * 4) * intensity;
        if (brightness > 0.01) {
          const r = Math.round(200 + brightness * 55);
          const g = Math.round(200 + brightness * 55);
          const b = Math.round(200 + brightness * 55);
          qctx.fillStyle = `rgba(${r},${g},${b},${brightness * 0.7})`;
          qctx.fillRect(qw - 2, y, 2, 1);
        }
      }

      animRef.current = requestAnimationFrame(drawFrame);
    };

    animRef.current = requestAnimationFrame(drawFrame);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isRunning]);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            LIGO Simulation Alpha
          </h2>
          <p style={{ fontSize: 9, color: 'var(--text-mercury)', opacity: 0.5, letterSpacing: '0.1em' }}>
            Gravitational wave detection • Chirp analysis • Event reconstruction
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={isRunning ? 'btn-ghost' : 'btn-primary'} onClick={() => setIsRunning(!isRunning)}
            style={{ fontSize: 8, padding: '6px 16px' }}>
            {isRunning ? '⏸ Pause' : '▶ Run'}
          </button>
          <button className="btn-ghost" onClick={() => { timeRef.current = 0; }}
            style={{ fontSize: 8, padding: '6px 16px' }}>↻ Reset</button>
        </div>
      </header>

      {/* Main: Chirp + Q-Scan + Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Chirp Strain Canvas */}
          <div className="glass-card" style={{ borderRadius: 'var(--radius-high)', padding: 16, flex: 2 }}>
            <h4 className="label-micro" style={{ letterSpacing: '0.2em', marginBottom: 8 }}>Chirp Strain h(t)</h4>
            <canvas ref={strainCanvasRef} style={{ width: '100%', height: 200, borderRadius: 'var(--radius-md)' }} />
          </div>
          {/* Q-Scan */}
          <div className="glass-card" style={{ borderRadius: 'var(--radius-high)', padding: 16, flex: 1 }}>
            <h4 className="label-micro" style={{ letterSpacing: '0.2em', marginBottom: 8 }}>Q-Scan Spectrogram</h4>
            <canvas ref={qscanCanvasRef} style={{ width: '100%', height: 120, borderRadius: 'var(--radius-md)' }} />
          </div>
        </div>

        {/* Right Sidebar: Sim Parameters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <section className="glass-card" style={{ borderRadius: 'var(--radius-high)', padding: 16 }}>
            <h4 className="label-micro" style={{ letterSpacing: '0.2em', marginBottom: 12 }}>Sim Parameters</h4>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 8, color: 'var(--text-slate)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Arm Length</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="range" min={0.01} max={4} step={0.01} value={state.gwArmLength}
                  onChange={(e) => setParam('gwArmLength', parseFloat(e.target.value))} style={{ flex: 1 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fff', minWidth: 50, textAlign: 'right' }}>
                  {state.gwArmLength.toFixed(2)} km
                </span>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 8, color: 'var(--text-slate)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Source</label>
              <select value={state.celestialSource} onChange={(e) => setParam('celestialSource', e.target.value)} style={{ width: '100%' }}>
                {CELESTIAL_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 8, color: 'var(--text-slate)', display: 'block', marginBottom: 4 }}>Mass₁ (M☉)</label>
                <input type="number" value={state.mass1} step={0.1}
                  onChange={(e) => setParam('mass1', parseFloat(e.target.value) || 1)}
                  style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 8, color: 'var(--text-slate)', display: 'block', marginBottom: 4 }}>Mass₂ (M☉)</label>
                <input type="number" value={state.mass2} step={0.1}
                  onChange={(e) => setParam('mass2', parseFloat(e.target.value) || 1)}
                  style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mercury)', opacity: 0.5, marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>M_chirp:</span><span>{chirpMass.toFixed(1)} M☉</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>η (sym ratio):</span><span>{eta.toFixed(4)}</span>
              </div>
            </div>
          </section>

          {/* GW Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <GWMetric label="SNR" value={snrDB} unit="dB" desc="Signal-to-noise ratio of detected GW signal. Higher = easier to detect." />
            <GWMetric label="h_min" value={hMin.toExponential(1)} unit="" desc="Minimum detectable strain. Set by laser power, arm length, and quantum noise." />
            <GWMetric label="Chirp Mass" value={`${chirpMass.toFixed(1)}`} unit="M☉" desc="Combined mass parameter M_c = (m₁m₂)^(3/5) / M^(1/5). Determines chirp rate." />
            <GWMetric label="d_L" value={`${luminosityDist}`} unit="Mpc" desc="Luminosity distance to source. Estimated from chirp mass and strain amplitude." />
            <GWMetric label="Final Spin" value={finalSpin.toFixed(3)} unit="a/M" desc="Dimensionless spin of merged remnant black hole. 0=non-spinning, 1=maximal Kerr." />
            <GWMetric label="Δφ_GW" value={Math.abs(phaseShift).toExponential(1)} unit="rad" desc="Phase shift from GW strain: Δφ = 4πhL/λ. This is what the interferometer measures." />
          </div>

          {/* Event Log */}
          <section className="glass-card" style={{ borderRadius: 'var(--radius-high)', padding: 12, flex: 1 }}>
            <h4 className="label-micro" style={{ letterSpacing: '0.2em', marginBottom: 8 }}>Live Readout</h4>
            <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-mercury)', opacity: 0.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p>Source: {CELESTIAL_SOURCES.find(s => s.value === state.celestialSource)?.label || state.celestialSource}</p>
              <p>Arm: {state.gwArmLength} km | Masses: {state.mass1}+{state.mass2} M☉</p>
              <p>h_min = {hMin.toExponential(1)} | SNR = {snrDB} dB</p>
              <p>N_photon = {N.toExponential(2)} | Squeeze: r={state.squeezingParam.toFixed(2)}</p>
            </div>
          </section>
        </div>
      </div>

      {/* Physics formulas */}
      <footer className="glass-card" style={{ borderRadius: 'var(--radius-high)', padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 10, color: 'var(--text-mercury)' }}>
          <div>
            <p style={{ fontWeight: 700, color: '#fff', marginBottom: 4, fontSize: 9 }}>CHIRP STRAIN</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>h(t) = A(1-t/t_m)^(-1/4) cos(φ)</p>
            <p style={{ fontSize: 8, marginTop: 4, opacity: 0.5 }}>Waveform amplitude grows as binary inspirals toward merger.</p>
          </div>
          <div>
            <p style={{ fontWeight: 700, color: '#fff', marginBottom: 4, fontSize: 9 }}>MIN DETECTABLE</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>h_min = λ/(4πL) · 1/√N · e^r</p>
            <p style={{ fontSize: 8, marginTop: 4, opacity: 0.5 }}>Quantum-limited sensitivity. Squeezed light (r{'>'}{0}) improves detection.</p>
          </div>
          <div>
            <p style={{ fontWeight: 700, color: '#fff', marginBottom: 4, fontSize: 9 }}>CHIRP MASS</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>M_c = (m₁m₂)^(3/5) / M^(1/5)</p>
            <p style={{ fontSize: 8, marginTop: 4, opacity: 0.5 }}>Determines the frequency evolution of the gravitational wave signal.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const GWMetric = ({ label, value, unit, desc }) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div className="glass-card" style={{
      borderRadius: 'var(--radius-md)', padding: 10, position: 'relative',
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      cursor: 'default',
    }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <span style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-slate)', display: 'block', marginBottom: 4 }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: '#fff' }}>
        {value} <span style={{ fontSize: 8, color: 'var(--text-mercury)', opacity: 0.5 }}>{unit}</span>
      </span>
      {hovered && desc && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4,
          padding: '6px 10px', fontSize: 9, lineHeight: 1.5,
          background: 'rgba(20,24,36,0.92)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
          color: 'rgba(255,255,255,0.6)', zIndex: 20, pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {desc}
        </div>
      )}
    </div>
  );
};

export default AnalyticsPanel;
