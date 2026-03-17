import React, { useRef, useEffect, useMemo } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { photonCount, shotNoiseLimit, squeezedSensitivity, phaseSNR } from '../physics/quantumModel.js';
import { SliderControl } from './BeginnerPanel.jsx';

/**
 * Quantum Panel — SUBATOMIC tab
 * Real-time graphs driven by quantumModel.js
 * All values update instantly when store parameters change.
 */
const QuantumPanel = () => {
  const state = useSimulationStore();
  const { setParam } = state;

  // Live backend calculations
  const N = photonCount(state.laserPower, state.wavelength, state.detectorExposureTime);
  const sql = shotNoiseLimit(N);
  const sqzSens = squeezedSensitivity(N, state.squeezingParam);
  const armX = Math.sqrt(state.mirror1PosX ** 2 + state.mirror1PosZ ** 2);
  const armY = Math.sqrt(state.mirror2PosX ** 2 + state.mirror2PosZ ** 2);
  const opd = 2 * (armX - armY);
  const phase = Math.abs(opd * 2 * Math.PI / state.wavelength);
  const snr = phaseSNR(phase, N, state.squeezingParam);
  const snrDB = snr > 1e-10 ? 10 * Math.log10(snr) : 0;
  const heisenbergLimit = 1 / N;
  const photonFlux = (state.laserPower * state.wavelength) / (6.626e-34 * 3e8);

  // Compute squeeze ellipse data for live graph
  const squeezeCurve = useMemo(() => {
    const points = [];
    const r = state.squeezingParam;
    const theta = state.squeezingAngle;
    for (let t = 0; t <= 2 * Math.PI; t += 0.05) {
      const x0 = Math.exp(-r) * Math.cos(t);
      const y0 = Math.exp(r) * Math.sin(t);
      const x = x0 * Math.cos(theta) - y0 * Math.sin(theta);
      const y = x0 * Math.sin(theta) + y0 * Math.cos(theta);
      points.push({ x, y });
    }
    return points;
  }, [state.squeezingParam, state.squeezingAngle]);

  // Compute sensitivity vs squeezing curve
  const sensitivityCurve = useMemo(() => {
    const pts = [];
    for (let r = 0; r <= 3; r += 0.05) {
      pts.push({
        r,
        sql: 1 / Math.sqrt(N),
        sqz: Math.exp(-r) / Math.sqrt(N),
        heisenberg: 1 / N,
      });
    }
    return pts;
  }, [N]);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Subatomic Configuration
          </h2>
          <p style={{ fontSize: 10, color: 'var(--text-mercury)', opacity: 0.5, letterSpacing: '0.1em', marginTop: 4 }}>
            Quantum noise limits • Squeezed states • Detection statistics
          </p>
        </div>
        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mercury)', opacity: 0.4 }}>
          N_photon: {N.toExponential(2)}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* LEFT COLUMN: Wigner/Phase Space + Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Phase Space (Squeeze Ellipse) — LIVE UPDATING CANVAS */}
          <section className="glass-card" style={{ borderRadius: 'var(--radius-high)', padding: 20 }}>
            <h3 style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-silver-200)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>
              Wigner Phase Space
            </h3>
            <PhaseSpaceCanvas squeezeCurve={squeezeCurve} r={state.squeezingParam} theta={state.squeezingAngle} />
          </section>

          {/* Squeezing Controls */}
          <section className="glass-card" style={{ borderRadius: 'var(--radius-high)', padding: 20 }}>
            <h3 style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-silver-200)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>
              Squeeze State Control
            </h3>
            <SliderControl label="Squeezing (dB)" unit="dB"
              value={state.squeezingParam * 2 * 4.343} min={0} max={26} step={0.1}
              onChange={(dB) => setParam('squeezingParam', dB / (2 * 4.343))}
              formatValue={(v) => v.toFixed(1)} />
            <SliderControl label="Angle (θ)" unit="°"
              value={state.squeezingAngle * 180 / Math.PI} min={0} max={360} step={1}
              onChange={(deg) => setParam('squeezingAngle', deg * Math.PI / 180)}
              formatValue={(v) => v.toFixed(0)} />
          </section>
        </div>

        {/* RIGHT COLUMN: Sensitivity Curve + Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Sensitivity vs Squeezing — LIVE UPDATING GRAPH */}
          <section className="glass-card" style={{ borderRadius: 'var(--radius-high)', padding: 20 }}>
            <h3 style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-silver-200)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>
              Phase Sensitivity vs Squeezing
            </h3>
            <SensitivityCanvas data={sensitivityCurve} currentR={state.squeezingParam} />
          </section>

          {/* Live Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <MetricBox label="Shot Noise Limit" value={sql.toExponential(2)} unit="rad" />
            <MetricBox label="Squeezed Limit" value={sqzSens.toExponential(2)} unit="rad" />
            <MetricBox label="Heisenberg Limit" value={heisenbergLimit.toExponential(2)} unit="rad" />
            <MetricBox label="SNR" value={snrDB.toFixed(1)} unit="dB" />
            <MetricBox label="QE (η)" value={`${(state.detectorQE * 100).toFixed(1)}%`} unit="" />
            <MetricBox label="Photon Flux" value={photonFlux.toExponential(2)} unit="/s" />
            <MetricBox label="Dark Current" value={state.detectorDarkCurrent.toFixed(2)} unit="e⁻/px/s" />
            <MetricBox label="Read Noise" value={state.detectorReadNoise.toFixed(1)} unit="e⁻ RMS" />
          </div>
        </div>
      </div>

      {/* EXPLANATION SECTION */}
      <section className="glass-card" style={{ borderRadius: 'var(--radius-high)', padding: 20, marginTop: 24 }}>
        <h3 style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-silver-200)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>
          Physics Reference
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, fontSize: 11, color: 'var(--text-mercury)' }}>
          <FormulaCard title="Photon Count" formula="N = P·λ·t / (h·c)" desc="Detector-collected photon statistics from source parameters." />
          <FormulaCard title="Shot Noise" formula="Δφ_SQL = 1/√N" desc="Standard quantum limit — minimum detectable phase for coherent light." />
          <FormulaCard title="Squeezed State" formula="Δφ_sqz = e^(-r)/√N" desc="Below-SQL sensitivity via squeezed vacuum injection at parameter r." />
        </div>
      </section>
    </div>
  );
};

/** Phase Space Canvas — draws squeeze ellipse in real-time */
const PhaseSpaceCanvas = ({ squeezeCurve, r, theta }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.offsetWidth;
    canvas.width = size * 2;
    canvas.height = size * 2;
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const scale = w / 5;

    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(cx + i * scale, 0); ctx.lineTo(cx + i * scale, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy + i * scale); ctx.lineTo(w, cy + i * scale); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `${Math.max(16, w / 20)}px monospace`;
    ctx.fillText('X₁', w - 30, cy - 8);
    ctx.fillText('X₂', cx + 8, 24);

    // Vacuum circle (r=0 reference)
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Squeeze ellipse
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(255,255,255,0.3)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    squeezeCurve.forEach((p, i) => {
      const px = cx + p.x * scale;
      const py = cy - p.y * scale;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();

    // Fill with slight glow
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [squeezeCurve, r, theta]);

  return <canvas ref={canvasRef} style={{ width: '100%', aspectRatio: '1/1', borderRadius: 'var(--radius-md)' }} />;
};

/** Sensitivity Canvas — plots Δφ vs r with live cursor */
const SensitivityCanvas = ({ data, currentR }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.offsetWidth * 2;
    const h = 300;
    canvas.width = w;
    canvas.height = h;

    const pad = { l: 60, r: 20, t: 20, b: 40 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;

    ctx.clearRect(0, 0, w, h);

    if (data.length === 0) return;

    // Determine Y range (log scale)
    const allVals = data.flatMap(d => [d.sql, d.sqz, d.heisenberg]).filter(v => v > 0);
    const yMin = Math.log10(Math.min(...allVals)) - 0.5;
    const yMax = Math.log10(Math.max(...allVals)) + 0.5;
    const xMax = data[data.length - 1].r;

    const toX = (r) => pad.l + (r / xMax) * pw;
    const toY = (v) => {
      const logV = Math.log10(Math.max(1e-30, v));
      return pad.t + ph - ((logV - yMin) / (yMax - yMin)) * ph;
    };

    // Y axis grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `${Math.max(14, w / 40)}px monospace`;
    ctx.lineWidth = 1;
    for (let e = Math.ceil(yMin); e <= Math.floor(yMax); e++) {
      const y = toY(Math.pow(10, e));
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillText(`10^${e}`, 4, y + 4);
    }

    // X axis label
    ctx.fillText('Squeezing (r)', pad.l + pw / 2 - 30, h - 5);

    // SQL line (dashed)
    ctx.strokeStyle = 'rgba(255,200,100,0.4)';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = toX(d.r), y = toY(d.sql);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Heisenberg line (dashed, faint)
    ctx.strokeStyle = 'rgba(100,200,255,0.3)';
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = toX(d.r), y = toY(d.heisenberg);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Squeezed sensitivity curve (solid white)
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255,255,255,0.3)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = toX(d.r), y = toY(d.sqz);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Current position marker
    const curIdx = data.findIndex(d => d.r >= currentR);
    if (curIdx >= 0) {
      const d = data[curIdx];
      const x = toX(d.r);
      const y = toY(d.sqz);
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, h - pad.b);
      ctx.stroke();
    }

    // Legend
    ctx.font = `${Math.max(12, w / 50)}px monospace`;
    ctx.fillStyle = 'rgba(255,200,100,0.6)'; ctx.fillText('— SQL', w - pad.r - 80, pad.t + 15);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText('— Squeezed', w - pad.r - 80, pad.t + 30);
    ctx.fillStyle = 'rgba(100,200,255,0.5)'; ctx.fillText('— Heisenberg', w - pad.r - 80, pad.t + 45);
  }, [data, currentR]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: 150, borderRadius: 'var(--radius-md)' }} />;
};

const MetricBox = ({ label, value, unit }) => (
  <div className="glass-card" style={{
    borderRadius: 'var(--radius-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 6,
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  }}>
    <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-slate)' }}>
      {label}
    </span>
    <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)', color: '#fff' }}>
      {value} <span style={{ fontSize: 9, color: 'var(--text-mercury)', opacity: 0.5 }}>{unit}</span>
    </span>
  </div>
);

const FormulaCard = ({ title, formula, desc }) => (
  <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
    <p style={{ fontSize: 9, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{title}</p>
    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#fff', marginBottom: 6 }}>{formula}</p>
    <p style={{ fontSize: 9, color: 'var(--text-mercury)', opacity: 0.6, lineHeight: 1.4 }}>{desc}</p>
  </div>
);

export default QuantumPanel;
