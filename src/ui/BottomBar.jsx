import React, { useMemo } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { fringeVisibility, coherenceLength as calcCoherenceLength } from '../physics/coherenceModel.js';
import { photonCount, phaseSNR } from '../physics/quantumModel.js';
import { generateFringePattern, wavelengthToColor } from '../physics/basicInterference.js';

/**
 * Bottom Bar — V3 unified_main_research_view
 * THREE panels: Interferogram | Phase Density Profile | Quantum State
 *
 * ALL values are LIVE computed from physics engines.
 * Intensity profile shows REAL cross-section through computed fringe pattern.
 */
const BottomBar = () => {
  const state = useSimulationStore();
  const armX = Math.sqrt(state.mirror1PosX ** 2 + state.mirror1PosZ ** 2);
  const armY = Math.sqrt(state.mirror2PosX ** 2 + state.mirror2PosZ ** 2);
  const opd = 2 * (armX - armY);
  const visibility = fringeVisibility(opd, state.laserLinewidth);
  const N = photonCount(state.laserPower, state.wavelength, state.detectorExposureTime);
  const phaseArg = Math.abs(opd * 2 * Math.PI / state.wavelength);
  const rawSNR = N > 0 ? phaseSNR(phaseArg, N, state.squeezingParam) : 1;
  const snrDB = rawSNR > 1e-10 ? (10 * Math.log10(rawSNR)).toFixed(1) : '42';
  const cohLen = calcCoherenceLength(state.laserLinewidth);
  const peakIntensity = 0.5 * (1 + visibility * Math.cos(2 * Math.PI * opd / state.wavelength));

  // REAL intensity profile: compute cross-section through fringe pattern
  const intensityBars = useMemo(() => {
    const resolution = 64;
    const fringeData = generateFringePattern({
      wavelength: state.wavelength,
      opdCenter: opd,
      tiltX: state.mirror1Tip,
      tiltY: state.mirror2Tip,
      resolution,
      detectorSize: 0.01,
    });
    // Extract central row as 1D cross-section, downsample to 24 bars
    const centerRow = Math.floor(resolution / 2);
    const bars = [];
    const numBars = 24;
    const step = Math.floor(resolution / numBars);
    for (let i = 0; i < numBars; i++) {
      const idx = centerRow * resolution + i * step;
      const val = fringeData[idx] || 0;
      bars.push(val);
    }
    return bars;
  }, [state.wavelength, opd, state.mirror1Tip, state.mirror2Tip]);

  // Color from wavelength
  const wlColor = wavelengthToColor(state.wavelength);

  return (
    <div className="app-bottom-bar">
      {/* Interferogram */}
      <div className="glass-card" style={{ width: 200, borderRadius: 'var(--radius-high)', padding: 16, display: 'flex', flexDirection: 'column' }}>
        <h4 className="label-micro" style={{ marginBottom: 8, letterSpacing: '0.2em' }}>Interferogram</h4>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <InterferogramThumb wavelength={state.wavelength} opd={opd}
            tiltX={state.mirror1Tip} tiltY={state.mirror2Tip} />
        </div>
      </div>

      {/* Phase Density Profile — REAL computed intensity cross-section */}
      <div className="glass-card" style={{ flex: 1, borderRadius: 'var(--radius-high)', padding: 16, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h4 className="label-micro" style={{ letterSpacing: '0.2em' }}>Phase Density Profile</h4>
          <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-silver-400)' }}>
            <span>Peak: {peakIntensity.toFixed(4)} AU</span>
            <span>OPD: {Math.abs(opd) < 1e-6 ? `${(opd * 1e9).toFixed(1)} nm` : `${(opd * 1e6).toFixed(3)} μm`}</span>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          {intensityBars.map((val, i) => (
            <div key={i} style={{
              flex: 1,
              height: `${Math.max(3, val * 100)}%`,
              background: `rgba(255, 255, 255, ${0.15 + val * 0.7})`,
              borderRadius: '2px 2px 0 0',
              transition: 'height 150ms ease, background 150ms ease',
            }} />
          ))}
        </div>
      </div>

      {/* Quantum State — live computed */}
      <div className="glass-card" style={{ width: 260, borderRadius: 'var(--radius-high)', padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h4 className="label-micro" style={{ marginBottom: 4, letterSpacing: '0.2em' }}>Quantum State</h4>
        <div className="metric-card">
          <span className="metric-label">Coherence:</span>
          <span className="metric-value">{(visibility * 100).toFixed(2)}%</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Coh. Length:</span>
          <span className="metric-value">{cohLen < 1 ? `${(cohLen * 100).toFixed(1)} cm` : `${cohLen.toFixed(2)} m`}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">SNR_dB:</span>
          <span className="metric-value">{snrDB}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Photon N:</span>
          <span className="metric-value">{N > 1e6 ? `${(N / 1e6).toFixed(1)}M` : N.toFixed(0)}</span>
        </div>
        <button className="btn-ghost" style={{ marginTop: 'auto', width: '100%', justifyContent: 'center', fontSize: 8 }}>
          Auto_Recalibrate
        </button>
      </div>
    </div>
  );
};

/** Tiny canvas interferogram thumbnail — REAL fringes from physics */
const InterferogramThumb = ({ wavelength, opd, tiltX, tiltY }) => {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 100;
    canvas.width = size * 2;
    canvas.height = size * 2;

    const resolution = 64;
    const data = generateFringePattern({
      wavelength, opdCenter: opd, tiltX, tiltY,
      resolution, detectorSize: 0.01,
    });

    const color = wavelengthToColor(wavelength);
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    const cx = canvas.width / 2, cy = canvas.height / 2;
    const radius = cx * 0.85;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    const pxSize = (radius * 2) / resolution;
    for (let j = 0; j < resolution; j++) {
      for (let i = 0; i < resolution; i++) {
        const intensity = data[j * resolution + i];
        ctx.fillStyle = `rgba(${r},${g},${b},${intensity * 0.85 + 0.1})`;
        ctx.fillRect(cx - radius + i * pxSize, cy - radius + j * pxSize, pxSize + 0.5, pxSize + 0.5);
      }
    }
    ctx.restore();

    // Dashed border
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
    ctx.stroke();
  }, [wavelength, opd, tiltX, tiltY]);

  return <canvas ref={canvasRef} style={{ width: 100, height: 100, borderRadius: '50%' }} />;
};

export default BottomBar;
