import React, { useMemo } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { generateFringePattern, wavelengthToColor } from '../physics/basicInterference.js';
import { fringeVisibility, coherenceLength } from '../physics/coherenceModel.js';
import { photonCount, phaseSNR } from '../physics/quantumModel.js';

/**
 * BottomBar (Research Mode)
 * - Interferogram thumbnail (real fringes)
 * - Phase Density Profile with legend, axis, responds to ALL params
 * - Quantum State metrics
 */
const BottomBar = () => {
  const state = useSimulationStore();

  const armX = Math.sqrt(state.mirror1PosX ** 2 + state.mirror1PosZ ** 2);
  const armY = Math.sqrt(state.mirror2PosX ** 2 + state.mirror2PosZ ** 2);
  const opd = 2 * (armX - armY);
  const visibility = fringeVisibility(opd, state.laserLinewidth);
  const cohLen = coherenceLength(state.laserLinewidth);
  const N = photonCount(state.laserPower, state.wavelength, state.detectorExposureTime);
  const k = (2 * Math.PI) / state.wavelength;
  const snr = N > 0 ? phaseSNR(k * Math.abs(opd), N, state.squeezingParam) : 0;
  const snrDB = snr > 1e-10 ? (10 * Math.log10(snr)).toFixed(1) : '0';

  // Phase Density Profile — intensity cross-section from FULL physics
  // Responds to: wavelength, OPD, mirror tips, linewidth, BS reflectivity, visibility, compensator
  const profileData = useMemo(() => {
    const resolution = 64;
    const bsR = state.bsReflectivity;
    const bsT = state.bsTransmissivity;
    const compensatorOPD = state.compensatorEnabled
      ? 0
      : (state.bsRefractiveIndex - 1) * state.bsThickness;
    const effectiveOPD = opd + compensatorOPD;

    const fringeData = generateFringePattern({
      wavelength: state.wavelength,
      opdCenter: effectiveOPD,
      tiltX: state.mirror1Tip,
      tiltY: state.mirror2Tip,
      resolution,
      detectorSize: 0.01,
      linewidth: state.laserLinewidth,
    });

    // Extract central row as 1D cross-section, sample 32 bars
    const centerRow = Math.floor(resolution / 2);
    const numBars = 32;
    const step = Math.floor(resolution / numBars);
    const bars = [];
    let maxVal = 0;
    for (let i = 0; i < numBars; i++) {
      const idx = centerRow * resolution + i * step;
      // Scale by BS contrast: I_max = (R+T)², I_min = (R-T)²
      // For ideal 50:50 this is 1.0; for non-50:50 the contrast reduces
      const bsContrast = 2 * Math.sqrt(bsR * bsT);
      const raw = fringeData[idx] || 0;
      const val = raw * bsContrast;
      bars.push(val);
      if (val > maxVal) maxVal = val;
    }
    return { bars, maxVal, bsContrast: 2 * Math.sqrt(bsR * bsT), vis: visibility };
  }, [
    state.wavelength, opd, state.mirror1Tip, state.mirror2Tip,
    state.laserLinewidth, state.bsReflectivity, state.bsTransmissivity,
    state.bsRefractiveIndex, state.bsThickness, state.compensatorEnabled,
    visibility,
  ]);

  // Peak intensity from profile
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
          <span>Peak: <b style={{ color: '#fff' }}>{peakIntensity.toFixed(4)}</b> AU</span>
          <span>OPD: <b style={{ color: '#fff' }}>{Math.abs(opd) < 1e-6 ? `${(opd * 1e9).toFixed(1)} nm` : `${(opd * 1e6).toFixed(3)} μm`}</b></span>
          <span>BS: <b style={{ color: '#fff' }}>{(state.bsReflectivity * 100).toFixed(0)}:{(state.bsTransmissivity * 100).toFixed(0)}</b></span>
          <span>Contrast: <b style={{ color: '#fff' }}>{(profileData.bsContrast * 100).toFixed(1)}%</b></span>
        </div>

        {/* Bar chart with Y-axis */}
        <div style={{ flex: 1, display: 'flex', gap: 0 }}>
          {/* Y-axis labels */}
          <div style={{ width: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: 4, fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)', textAlign: 'right' }}>
            <span>1.0</span>
            <span>0.5</span>
            <span>0.0</span>
          </div>
          {/* Bars */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 1, position: 'relative' }}>
            {/* Visibility line (dashed horizontal) */}
            <div style={{
              position: 'absolute', left: 0, right: 0,
              bottom: `${profileData.vis * 100}%`,
              borderTop: '1px dashed rgba(255,255,255,0.2)',
              zIndex: 1,
            }} />
            {profileData.bars.map((val, i) => (
              <div key={i} style={{
                flex: 1,
                height: `${Math.max(2, val * 100)}%`,
                background: `linear-gradient(to top, ${wlColor}33, ${wlColor}aa)`,
                borderRadius: '2px 2px 0 0',
                transition: 'height 150ms ease',
                minWidth: 2,
              }} />
            ))}
          </div>
        </div>

        {/* X-axis labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 24, marginTop: 4, fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)' }}>
          <span>-5mm</span>
          <span>0</span>
          <span>+5mm</span>
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
