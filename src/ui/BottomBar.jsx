import React, { useMemo, useRef, useEffect } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { generateFringePattern, wavelengthToColor } from '../physics/basicInterference.js';
import { fringeVisibility, coherenceLength } from '../physics/coherenceModel.js';
import { photonCount, phaseSNR } from '../physics/quantumModel.js';
import { computeSagnac } from '../physics/sagnacModel.js';

/**
 * BottomBar (Research Mode)
 * - Interferogram thumbnail (real fringes)
 * - Phase Density Profile — WAVE GRAPH with labeled axes
 * - Quantum State metrics
 */
const BottomBar = () => {
  const state = useSimulationStore();
  const waveCanvasRef = useRef(null);

  const armX = Math.sqrt(state.mirror1PosX ** 2 + state.mirror1PosZ ** 2);
  const armY = Math.sqrt(state.mirror2PosX ** 2 + state.mirror2PosZ ** 2);
  // OPD matching SceneManager formula (base + tip + compensator)
  const tipOPD = (state.mirror1Tip - state.mirror2Tip) * armX;
  const compensatorOPD = state.compensatorEnabled
    ? ((state.compensatorRefractiveIndex || 1.5168) - 1) * (state.compensatorThickness || 0.00635)
    : 0;
  const opd = 2 * (armX - armY) + tipOPD - compensatorOPD;
  const visibility = fringeVisibility(opd, state.laserLinewidth);
  const cohLen = coherenceLength(state.laserLinewidth);
  const N = photonCount(state.laserPower, state.wavelength, state.detectorExposureTime);
  const k = (2 * Math.PI) / state.wavelength;
  const snr = N > 0 ? phaseSNR(k * Math.abs(opd), N, state.squeezingParam) : 0;
  const snrDB = snr > 1e-10 ? (10 * Math.log10(snr)).toFixed(1) : '0';

  // Michelson-specific calculations
  const GAS_DATA = { air: { n0: 293e-6 }, he: { n0: 35e-6 }, ar: { n0: 281e-6 } };
  const gasNm1 = (GAS_DATA[state.gasCellGas]?.n0 || 293e-6) * state.gasCellPressure;
  const nGas = 1 + gasNm1;
  const michelsonGasOPD = 2 * (nGas - 1) * state.gasCellLength;
  const michelsonMirOPD = 2 * state.mirrorDisplacement * 1e-6;
  const michelsonTotalOPD = michelsonGasOPD + michelsonMirOPD;
  const michelsonFringes = michelsonTotalOPD / state.wavelength;
  const michelsonRegime = state.mirrorTilt < 0.05 ? 'Circular' : state.mirrorTilt < 0.5 ? 'Curved' : state.mirrorTilt < 2 ? 'Straight' : 'Dense';

  // Sagnac calculations
  const sagnac = computeSagnac({
    loopLength: state.sagnacLoopLength,
    loopRadius: state.sagnacLoopRadius,
    numLoops: state.sagnacNumLoops,
    omega: state.sagnacOmega,
    wavelength: state.wavelength,
  });

  const interferometerType = state.interferometerType;

  // Phase Density Profile data — smooth wave
  const profileData = useMemo(() => {
    const numPoints = 128;
    const bsR = state.bsReflectivity;
    const bsT = state.bsTransmissivity;
    const bsContrast = 2 * Math.sqrt(bsR * bsT);
    const vis = visibility;
    const detSize = 0.01; // 10mm detector
    const points = [];
    let maxVal = 0;

    for (let i = 0; i < numPoints; i++) {
      const x = (i / (numPoints - 1) - 0.5) * detSize; // position in meters
      const tiltPhase = k * (state.mirror1Tip + state.mirror2Tip) * x;
      const opdPhase = k * opd;
      const intensity = 0.5 * (1 + vis * bsContrast * Math.cos(opdPhase + tiltPhase));
      points.push({ x: x * 1000, y: intensity }); // x in mm
      if (intensity > maxVal) maxVal = intensity;
    }
    return { points, maxVal, bsContrast, vis };
  }, [
    state.wavelength, opd, state.mirror1Tip, state.mirror2Tip,
    state.laserLinewidth, state.bsReflectivity, state.bsTransmissivity,
    visibility, k,
  ]);

  // Draw wave graph on canvas
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const pad = { top: 8, right: 10, bottom: 22, left: 30 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    const wlColor = wavelengthToColor(state.wavelength);

    // Background
    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const gy = pad.top + plotH * (1 - i / 4);
      ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(w - pad.right, gy); ctx.stroke();
    }

    // Draw wave curve
    const pts = profileData.points;
    if (pts.length > 0) {
      const xMin = pts[0].x, xMax = pts[pts.length - 1].x;
      const yMax = Math.max(profileData.maxVal, 0.01);

      const toX = (xVal) => pad.left + ((xVal - xMin) / (xMax - xMin)) * plotW;
      const toY = (yVal) => pad.top + plotH * (1 - yVal / yMax);

      // Filled area
      ctx.beginPath();
      ctx.moveTo(toX(pts[0].x), toY(0));
      pts.forEach(p => ctx.lineTo(toX(p.x), toY(p.y)));
      ctx.lineTo(toX(pts[pts.length - 1].x), toY(0));
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
      grad.addColorStop(0, wlColor + '44');
      grad.addColorStop(1, wlColor + '08');
      ctx.fillStyle = grad;
      ctx.fill();

      // Stroke line
      ctx.beginPath();
      pts.forEach((p, i) => {
        if (i === 0) ctx.moveTo(toX(p.x), toY(p.y));
        else ctx.lineTo(toX(p.x), toY(p.y));
      });
      ctx.strokeStyle = wlColor;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Visibility dashed line
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      const visY = toY(profileData.vis * yMax);
      ctx.moveTo(pad.left, visY);
      ctx.lineTo(w - pad.right, visY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '7px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`V=${(profileData.vis * 100).toFixed(0)}%`, w - pad.right - 40, visY - 3);

      // Y-axis labels
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '7px monospace'; ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const val = (yMax * i / 4);
        ctx.fillText(val.toFixed(2), pad.left - 3, pad.top + plotH * (1 - i / 4) + 3);
      }
      ctx.save();
      ctx.translate(8, pad.top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Intensity (AU)', 0, 0);
      ctx.restore();

      // X-axis labels
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
      const xTicks = [-5, -2.5, 0, 2.5, 5];
      xTicks.forEach(xv => {
        const sx = toX(xv);
        if (sx >= pad.left && sx <= w - pad.right) {
          ctx.fillText(xv.toFixed(1), sx, h - 4);
          ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(sx, pad.top + plotH); ctx.lineTo(sx, pad.top + plotH + 3); ctx.stroke();
        }
      });
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Position (mm)', pad.left + plotW / 2, h - 1);
    }
  }, [profileData, state.wavelength]);

  const peakIntensity = profileData.maxVal;
  const wlColor = wavelengthToColor(state.wavelength);

  return (
    <div className="app-bottom-bar">
      {/* Interferogram */}
      <div className="glass-card" style={{ width: 200, borderRadius: 'var(--radius-high)', padding: 16, display: 'flex', flexDirection: 'column' }}>
        <h4 className="label-micro" style={{ marginBottom: 8, letterSpacing: '0.2em' }}>Interferogram</h4>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <InterferogramThumb wavelength={state.wavelength} opd={opd}
            tiltX={state.mirror1Tip} tiltY={state.mirror2Tip} linewidth={state.laserLinewidth} />
        </div>
      </div>

      {/* Phase Density Profile — with legend, axes, all-param responsive */}
      <div className="glass-card" style={{ flex: 1, borderRadius: 'var(--radius-high)', padding: 16, display: 'flex', flexDirection: 'column' }}>
        {/* Header + Legend */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h4 className="label-micro" style={{ letterSpacing: '0.2em' }}>Phase Density Profile</h4>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: wlColor, display: 'inline-block' }} />
              <span style={{ color: 'var(--text-mercury)', fontFamily: 'var(--font-mono)' }}>Intensity</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 2, background: 'rgba(255,255,255,0.3)', display: 'inline-block' }} />
              <span style={{ color: 'var(--text-mercury)', fontFamily: 'var(--font-mono)' }}>V={profileData.vis.toFixed(2)}</span>
            </span>
          </div>
        </div>

        {/* Metrics row */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 6, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-silver-400)' }}>
          {interferometerType === 'michelson' ? (
            <>
              <span>Gas OPD: <b style={{ color: '#fff' }}>{(michelsonGasOPD * 1e9).toFixed(2)} nm</b></span>
              <span>Mirror OPD: <b style={{ color: '#fff' }}>{(michelsonMirOPD * 1e9).toFixed(1)} nm</b></span>
              <span>Fringes: <b style={{ color: '#fff' }}>{michelsonFringes.toFixed(3)}</b></span>
              <span>n: <b style={{ color: '#fff' }}>{nGas.toFixed(6)}</b></span>
              <span>Regime: <b style={{ color: '#fff' }}>{michelsonRegime}</b></span>
            </>
          ) : interferometerType === 'sagnac' ? (
            <>
              <span>ΔFringe: <b style={{ color: '#fff' }}>{sagnac.fringeShiftMethod1.toExponential(3)}</b></span>
              <span>Δt: <b style={{ color: '#fff' }}>{sagnac.dtMethod1.toExponential(3)} s</b></span>
              <span>CW: <b style={{ color: '#4fa0ff' }}>{sagnac.cwSpeed.toFixed(2)} m/s</b></span>
              <span>CCW: <b style={{ color: '#ff6464' }}>{sagnac.ccwSpeed.toFixed(2)} m/s</b></span>
              <span>Ω: <b style={{ color: '#fff' }}>{state.sagnacOmega.toFixed(3)} rad/s</b></span>
            </>
          ) : (
            <>
              <span>Peak: <b style={{ color: '#fff' }}>{peakIntensity.toFixed(4)}</b> AU</span>
              <span>OPD: <b style={{ color: '#fff' }}>{Math.abs(opd) < 1e-6 ? `${(opd * 1e9).toFixed(1)} nm` : `${(opd * 1e6).toFixed(3)} μm`}</b></span>
              <span>BS: <b style={{ color: '#fff' }}>{(state.bsReflectivity * 100).toFixed(0)}:{(state.bsTransmissivity * 100).toFixed(0)}</b></span>
              <span>Contrast: <b style={{ color: '#fff' }}>{(profileData.bsContrast * 100).toFixed(1)}%</b></span>
            </>
          )}
        </div>

        {/* Wave Graph Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <canvas ref={waveCanvasRef} />
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
        <button className="btn-ghost" onClick={() => useSimulationStore.getState().resetToDefaults()}
          style={{ marginTop: 'auto', width: '100%', justifyContent: 'center', fontSize: 8 }}>
          Reset_Defaults
        </button>
      </div>
    </div>
  );
};

/** Tiny canvas interferogram thumbnail — REAL fringes from physics */
const InterferogramThumb = ({ wavelength, opd, tiltX, tiltY, linewidth = 0 }) => {
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
      resolution, detectorSize: 0.01, linewidth,
    });

    const color = wavelengthToColor(wavelength);
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    const cx = canvas.width / 2, cy = canvas.height / 2;
    const radius = cx * 0.85;
    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const scale = canvas.width / resolution;

    for (let j = 0; j < resolution; j++) {
      for (let i = 0; i < resolution; i++) {
        const val = data[j * resolution + i];
        const px = Math.round(i * scale);
        const py = Math.round(j * scale);
        const endX = Math.round((i + 1) * scale);
        const endY = Math.round((j + 1) * scale);
        for (let y = py; y < endY && y < canvas.height; y++) {
          for (let x = px; x < endX && x < canvas.width; x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy > radius * radius) continue;
            const idx = (y * canvas.width + x) * 4;
            imgData.data[idx] = Math.round(r * val);
            imgData.data[idx + 1] = Math.round(g * val);
            imgData.data[idx + 2] = Math.round(b * val);
            imgData.data[idx + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [wavelength, opd, tiltX, tiltY, linewidth]);

  return <canvas ref={canvasRef} style={{ width: 100, height: 100, borderRadius: '50%' }} />;
};

export default BottomBar;
