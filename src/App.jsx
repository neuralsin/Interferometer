import React, { useState, useCallback, useRef, useEffect } from 'react';
import SceneManager from './scene/SceneManager.jsx';
import MichelsonScene from './scene/MichelsonScene.jsx';
import SagnacScene from './scene/SagnacScene.jsx';
import Sidebar from './ui/Sidebar.jsx';
import BottomBar from './ui/BottomBar.jsx';
import PhysicsNoisePanel from './ui/PhysicsNoisePanel.jsx';
import QuantumPanel from './ui/QuantumPanel.jsx';
import AnalyticsPanel from './ui/AnalyticsPanel.jsx';
import useSimulationStore from './store/simulationStore.js';
import { computeOPD, computeTiltAveragedProbability } from './store/simulationStore.js';
import { exportCSV, exportJSON } from './physics/dataExport.js';

const TABS = [
  { id: 'sim', label: 'SIMULATION' },
  { id: 'physics', label: 'WAVE OPTICS & NOISE' },
  { id: 'quantum', label: 'SUBATOMIC' },
  { id: 'analytics', label: 'ASTRONOMICAL' },
];

const FlaskIcon = () => (
  <svg style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
      strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
  </svg>
);

const DownloadIcon = () => (
  <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

/** Detection Stats Overlay — type-aware real physics */
const DetectionOverlay = ({ isResearch }) => {
  const state = useSimulationStore();
  const iType = state.interferometerType;

  // Central physics engine — topology-aware
  const opdResult = computeOPD(state);
  const { p1, p2, visibility } = computeTiltAveragedProbability(state);
  const n1 = state.simD1, n2 = state.simD2, total = state.simFired;

  // === Michelson-specific derived values ===
  const GAS = { air: { n0: 293e-6 }, he: { n0: 35e-6 }, ar: { n0: 281e-6 } };
  const gasN = 1 + (GAS[state.gasCellGas]?.n0 || 293e-6) * state.gasCellPressure;
  const mGasOPD = 2 * (gasN - 1) * state.gasCellLength;
  const mMirOPD = 2 * (state.mirrorDisplacement || 0) * 1e-6;
  const mFringes = opdResult.opd / state.wavelength;
  const mRegime = (state.mirrorTilt || 0) < 0.05 ? 'Circular' : (state.mirrorTilt || 0) < 0.5 ? 'Curved' : (state.mirrorTilt || 0) < 2 ? 'Straight' : 'Dense';

  // === Sagnac-specific ===
  const sArea = state.sagnacNumLoops * Math.PI * state.sagnacLoopRadius ** 2;
  const c = 299792458;
  const sDt = (4 * sArea * Math.abs(state.sagnacOmega)) / (c * c);
  const sDFringe = (4 * sArea * Math.abs(state.sagnacOmega)) / (c * state.wavelength);
  const v = Math.abs(state.sagnacOmega) * state.sagnacLoopRadius;
  const sCW = c - v, sCCW = c + v;

  // Empirical ratio bar (shared)
  const empBar = total > 0 && (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
        <div style={{ flex: Math.max(1, n1), height: 4, background: '#2dd4a8', borderRadius: 2 }} />
        <div style={{ flex: Math.max(1, n2), height: 4, background: '#4f9cf9', borderRadius: 2 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, opacity: 0.5 }}>
        <span>D₁: {n1} ({(n1/total*100).toFixed(1)}%)</span>
        <span>D₂: {n2} ({(n2/total*100).toFixed(1)}%)</span>
      </div>
    </div>
  );

  if (iType === 'michelson') {
    return (
      <div className="viewport-overlay" style={{ maxWidth: isResearch ? 220 : 180 }}>
        <p style={{ color: '#fff', fontWeight: 700, marginBottom: 6, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Michelson Data</p>
        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gas OPD:</span><span style={{ color: '#fff' }}>{(mGasOPD * 1e9).toFixed(2)} nm</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Mirror OPD:</span><span style={{ color: '#fff' }}>{(mMirOPD * 1e9).toFixed(1)} nm</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total OPD:</span><span style={{ color: '#fff' }}>{(opdResult.opd * 1e9).toFixed(1)} nm</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Fringes:</span><span style={{ color: '#fff' }}>{mFringes.toFixed(3)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>n(gas):</span><span style={{ color: '#fff' }}>{gasN.toFixed(6)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Regime:</span><span style={{ color: '#fff' }}>{mRegime}</span></div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 6, paddingTop: 6, fontSize: 9, fontFamily: 'var(--font-mono)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>P(constr):</span><span style={{ color: '#2dd4a8' }}>{(p1 * 100).toFixed(1)}%</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>P(destr):</span><span style={{ color: '#f5a623' }}>{(p2 * 100).toFixed(1)}%</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Visibility:</span><span style={{ color: '#fff' }}>{(visibility * 100).toFixed(1)}%</span></div>
        </div>
      </div>
    );
  }

  if (iType === 'sagnac') {
    return (
      <div className="viewport-overlay" style={{ maxWidth: isResearch ? 220 : 180 }}>
        <p style={{ color: '#fff', fontWeight: 700, marginBottom: 6, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Sagnac Data</p>
        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Area:</span><span style={{ color: '#fff' }}>{sArea.toFixed(2)} m²</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>ΔFringe:</span><span style={{ color: '#fff' }}>{sDFringe.toExponential(3)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Δt:</span><span style={{ color: '#fff' }}>{sDt.toExponential(3)} s</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>CW speed:</span><span style={{ color: '#4fa0ff' }}>{sCW.toFixed(2)} m/s</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>CCW speed:</span><span style={{ color: '#ff6464' }}>{sCCW.toFixed(2)} m/s</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>v(tang):</span><span style={{ color: '#fff' }}>{v.toFixed(4)} m/s</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ω:</span><span style={{ color: '#fff' }}>{state.sagnacOmega.toFixed(3)} rad/s</span></div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 6, paddingTop: 6, fontSize: 9, fontFamily: 'var(--font-mono)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>P(constr):</span><span style={{ color: '#2dd4a8' }}>{(p1 * 100).toFixed(1)}%</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>P(destr):</span><span style={{ color: '#f5a623' }}>{(p2 * 100).toFixed(1)}%</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Phase:</span><span style={{ color: '#fff' }}>{((opdResult.sagnacPhase || 0) / (2 * Math.PI)).toFixed(4)}λ</span></div>
        </div>
        {/* Sagnac Effect Formula — theoretical traceability */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 6, paddingTop: 6 }}>
          <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 4, letterSpacing: '0.05em' }}>
            Δφ = 8π A Ω / (λ c)
          </div>
          <div style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)', display: 'flex', justifyContent: 'space-between' }}>
            <span>A = {sArea.toFixed(2)} m²</span>
            <span>Ω = {state.sagnacOmega.toFixed(3)}</span>
          </div>
        </div>
      </div>
    );
  }

  // MZI (default)
  return (
    <div className="viewport-overlay" style={{ maxWidth: isResearch ? 220 : 180 }}>
      <p style={{ color: '#fff', fontWeight: 700, marginBottom: 6, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Detected Counts</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ color: '#2dd4a8' }}>D₁:</span><span style={{ color: '#fff', fontWeight: 700 }}>{n1}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ color: '#4f9cf9' }}>D₂:</span><span style={{ color: '#fff', fontWeight: 700 }}>{n2}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 4, paddingTop: 4 }}>
        <span>Total:</span><span style={{ color: '#fff' }}>{total}</span>
      </div>
      {empBar}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 6, paddingTop: 6, fontSize: 8 }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Theory</p>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>P₁ (cos²δ/2):</span><span style={{ color: '#fff' }}>{(p1 * 100).toFixed(1)}%</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>P₂ (sin²δ/2):</span><span style={{ color: '#fff' }}>{(p2 * 100).toFixed(1)}%</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Visibility:</span><span style={{ color: '#fff' }}>{(visibility * 100).toFixed(1)}%</span></div>
      </div>
    </div>
  );
};

/** Beginner Bottom Bar — topology-aware second slider */
const BeginnerBottomBar = () => {
  const wavelength = useSimulationStore((s) => s.wavelength);
  const iType = useSimulationStore((s) => s.interferometerType);
  const mirror2PosZ = useSimulationStore((s) => s.mirror2PosZ);
  const mirrorDisplacement = useSimulationStore((s) => s.mirrorDisplacement);
  const sagnacOmega = useSimulationStore((s) => s.sagnacOmega);
  const setParam = useSimulationStore((s) => s.setParam);

  // Topology-aware second slider config
  let sliderLabel, sliderValue, sliderDisplay, sliderMin, sliderMax, sliderStep, sliderOnChange;

  if (iType === 'sagnac') {
    sliderLabel = 'Angular Velocity Ω';
    sliderValue = sagnacOmega;
    sliderDisplay = `${sagnacOmega.toFixed(2)} rad/s`;
    sliderMin = -10; sliderMax = 10; sliderStep = 0.01;
    sliderOnChange = (e) => setParam('sagnacOmega', parseFloat(e.target.value));
  } else if (iType === 'michelson') {
    sliderLabel = 'Mirror Offset Δd';
    sliderValue = mirrorDisplacement;
    sliderDisplay = `${mirrorDisplacement.toFixed(1)} μm`;
    sliderMin = -50; sliderMax = 50; sliderStep = 0.1;
    sliderOnChange = (e) => setParam('mirrorDisplacement', parseFloat(e.target.value));
  } else {
    // MZI — nanometer step to avoid aliasing
    sliderLabel = 'Geometry Offset Δd';
    const opdNm = (Math.abs(useSimulationStore.getState().mirror1PosX) - Math.abs(mirror2PosZ)) * 1e9;
    sliderDisplay = `${opdNm.toFixed(1)} nm`;
    sliderValue = Math.abs(mirror2PosZ) * 1e6; // in μm for slider range
    sliderMin = 50000; sliderMax = 500000; sliderStep = 0.001; // 0.001 μm = 1 nm steps
    sliderOnChange = (e) => setParam('mirror2PosZ', -parseFloat(e.target.value) * 1e-6);
  }

  return (
    <footer style={{ padding: '0 24px 24px', display: 'flex', gap: 24, flexShrink: 0 }}>
      <div className="glass-card" style={{ flex: 1, borderRadius: 'var(--radius-high)', padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h4 style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-silver-200)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Laser Engine λ</h4>
          <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: '#fff', fontWeight: 700 }}>{(wavelength * 1e9).toFixed(2)} nm</span>
        </div>
        <input type="range" min={380} max={780} step={0.1} value={wavelength * 1e9}
          onChange={(e) => setParam('wavelength', parseFloat(e.target.value) * 1e-9)} />
      </div>
      <div className="glass-card" style={{ flex: 1, borderRadius: 'var(--radius-high)', padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h4 style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-silver-200)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>{sliderLabel}</h4>
          <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: '#fff', fontWeight: 700 }}>{sliderDisplay}</span>
        </div>
        <input type="range" min={sliderMin} max={sliderMax} step={sliderStep} value={sliderValue}
          onChange={sliderOnChange} />
      </div>
    </footer>
  );
};

const MZI_TOOLBAR = [
  { label: 'M1', desc: 'Mirror 1 — Toggle ON/OFF.', paramKey: 'm1Enabled', isToggle: true },
  { label: 'M2', desc: 'Mirror 2 — Toggle ON/OFF.', paramKey: 'm2Enabled', isToggle: true },
  { label: 'BS₂', desc: 'Beam Splitter 2 — Toggle ON/OFF.', paramKey: 'bs2Enabled', isToggle: true },
  { label: 'CP', desc: 'Compensator Plate — Equalizes path.', paramKey: 'compensatorEnabled', isToggle: true },
];
const SHARED_TOOLBAR = [
  { label: 'GW', desc: 'Gravitational Wave strain signal.', paramKey: 'gwEnabled', isToggle: true },
  { label: '🔊', desc: 'Seismic Noise coupling.', paramKey: 'seismicNoiseEnabled', isToggle: true },
  { label: '🌡', desc: 'Thermal Drift.', paramKey: 'thermalDriftEnabled', isToggle: true },
];

const ComponentToolbar = () => {
  const setParam = useSimulationStore((s) => s.setParam);
  const iType = useSimulationStore((s) => s.interferometerType);
  const items = iType === 'mzi' ? [...MZI_TOOLBAR, ...SHARED_TOOLBAR] : SHARED_TOOLBAR;
  return (
    <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', gap: 6 }}>
      {items.map(item => (
        <ToolbarBtn key={item.label} {...item} setParam={setParam} />
      ))}
    </div>
  );
};

const ToolbarBtn = ({ label, desc, paramKey, toggle, isToggle, setParam }) => {
  const [hovered, setHovered] = useState(false);
  const active = useSimulationStore((s) => isToggle ? s[paramKey] : (toggle ? s[paramKey] !== toggle[0] : false));

  const handleClick = () => {
    if (isToggle) {
      setParam(paramKey, !useSimulationStore.getState()[paramKey]);
    } else if (toggle) {
      const cur = useSimulationStore.getState()[paramKey];
      setParam(paramKey, cur === toggle[0] ? toggle[1] : toggle[0]);
    }
  };

  return (
    <div style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button onClick={handleClick} style={{
        padding: '5px 10px', fontSize: 9, fontWeight: 700,
        background: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
        border: `1px solid rgba(255,255,255,${active ? 0.4 : 0.1})`,
        borderRadius: 6, cursor: 'pointer', color: '#fff',
        fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
        transition: 'all 150ms',
      }}>
        {label}
      </button>
      {hovered && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          width: 220, padding: '10px 12px',
          background: 'rgba(20,24,36,0.85)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8, zIndex: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 4, letterSpacing: '0.05em' }}>
            {label} — {active ? 'ACTIVE' : 'OFF'}
          </p>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
            {desc}
          </p>
        </div>
      )}
    </div>
  );
};

const App = () => {
  const isResearchMode = useSimulationStore((s) => s.isResearchMode);
  const simulationPaused = useSimulationStore((s) => s.simulationPaused);
  const toggleResearchMode = useSimulationStore((s) => s.toggleResearchMode);
  const setParam = useSimulationStore((s) => s.setParam);
  const interferometerType = useSimulationStore((s) => s.interferometerType);
  const [activeTab, setActiveTab] = useState('sim');
  const [darkMode, setDarkMode] = useState(true);
  const viewportRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  const handleFullscreen = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  const handleExport = () => exportJSON(useSimulationStore.getState());

  return (
    <div className="app-layout">
      {/* ===== HEADER ===== */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 36, height: 36, border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 'var(--radius-high)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.05)',
          }}>
            <FlaskIcon />
          </div>
          <div>
            <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', color: '#fff', textTransform: 'uppercase' }}>
              Simulab Research
            </h1>
            <p style={{ fontSize: 8, color: 'var(--text-mercury)', textTransform: 'uppercase', letterSpacing: '0.25em', opacity: 0.6 }}>
              {isResearchMode ? 'Quantum Interferometry Suite v4.2' : (
                interferometerType === 'michelson' ? 'Michelson Interferometer v4.2' :
                interferometerType === 'sagnac' ? 'Sagnac Interferometer v4.2' :
                'Mach-Zehnder Interferometer v4.2'
              )}
            </p>
          </div>
          {isResearchMode && (
            <nav style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-high)', padding: 3, border: '1px solid rgba(255,255,255,0.06)' }}>
              {TABS.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                  padding: '6px 14px', fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.12em', color: activeTab === tab.id ? '#000' : 'var(--text-mercury)',
                  background: activeTab === tab.id ? '#fff' : 'transparent',
                  border: 'none', borderRadius: 'var(--radius-high)', cursor: 'pointer', transition: 'all 200ms',
                }}>
                  {tab.label}
                </button>
              ))}
            </nav>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Interferometer type selector */}
          <select value={interferometerType} onChange={e => setParam('interferometerType', e.target.value)} style={{
            padding: '6px 12px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', cursor: 'pointer', borderRadius: 'var(--radius-high)',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', fontFamily: 'inherit',
          }}>
            <option value="mzi" style={{ background: '#111' }}>Mach-Zehnder</option>
            <option value="michelson" style={{ background: '#111' }}>Michelson</option>
            <option value="sagnac" style={{ background: '#111' }}>Sagnac</option>
          </select>
          {isResearchMode && (
            <>
              <button onClick={() => setParam('simulationPaused', !simulationPaused)} className="status-pill" style={{
                cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
              }}>
                <span className="status-dot" style={{ opacity: simulationPaused ? 0.3 : 1 }} />
                {simulationPaused ? 'PAUSED' : 'Running'}
              </button>
              <button className="btn-primary" onClick={handleExport} style={{ fontSize: 8, padding: '6px 16px', gap: 6 }}>
                <DownloadIcon /> Export Data
              </button>
            </>
          )}
          <button onClick={toggleResearchMode} style={{
            padding: '8px 20px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.12em', cursor: 'pointer', borderRadius: 'var(--radius-high)',
            transition: 'all 300ms ease',
            ...(isResearchMode
              ? { background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }
              : { background: '#fff', border: '1px solid #fff', color: '#000' }),
          }}>
            {isResearchMode ? 'Switch to Guided' : 'Switch to Research'}
          </button>
          <button onClick={() => setDarkMode(d => !d)} title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'} style={{
            padding: '8px 12px', fontSize: 14, cursor: 'pointer', borderRadius: 'var(--radius-high)',
            background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`,
            color: darkMode ? '#fff' : '#111', transition: 'all 200ms', lineHeight: 1,
          }}>
            {darkMode ? '☀' : '☾'}
          </button>
        </div>
      </header>

      {/* ===== CONTENT ===== */}
      {!isResearchMode ? (
        <>
          <div className="app-main">
            <section ref={viewportRef} className="app-viewport glass-card" style={{ borderRadius: 'var(--radius-high)' }}>
              <div className="viewport-grid" style={{ position: 'absolute', inset: 0, opacity: 0.2 }} />
              {interferometerType === 'michelson' ? <MichelsonScene /> : interferometerType === 'sagnac' ? <SagnacScene /> : <SceneManager />}
              <DetectionOverlay isResearch={false} />
              <button className="btn-ghost" onClick={handleFullscreen} style={{
                position: 'absolute', bottom: 16, right: 16, padding: 8, borderRadius: 'var(--radius-full)', zIndex: 5,
              }}>
                <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
            </section>
            <aside className="app-sidebar">
              <div className="app-sidebar-inner glass-card"><Sidebar /></div>
            </aside>
          </div>
          <BeginnerBottomBar />
        </>
      ) : (
        <>
          {activeTab === 'sim' && (
            <>
              <div className="app-main">
                <section ref={viewportRef} className="app-viewport glass-card" style={{ borderRadius: 'var(--radius-high)', position: 'relative' }}>
                  <div className="viewport-grid" style={{ position: 'absolute', inset: 0, opacity: 0.2 }} />
                  {interferometerType === 'michelson' ? <MichelsonScene /> : interferometerType === 'sagnac' ? <SagnacScene /> : <SceneManager />}
                  <DetectionOverlay isResearch={true} />
                  <ComponentToolbar />
                  <button className="btn-ghost" onClick={handleFullscreen} style={{
                    position: 'absolute', bottom: 16, right: 16, padding: 8, borderRadius: 'var(--radius-full)', zIndex: 5,
                  }}>
                    <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                        strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </button>
                </section>
                <aside className="app-sidebar">
                  <div className="app-sidebar-inner glass-card"><Sidebar /></div>
                </aside>
              </div>
              <BottomBar />
            </>
          )}
          {activeTab === 'physics' && <PhysicsNoisePanel />}
          {activeTab === 'quantum' && <QuantumPanel />}
          {activeTab === 'analytics' && <AnalyticsPanel />}
        </>
      )}

      {/* ===== FOOTER ===== */}
      <footer style={{
        height: 32, borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.2)',
        letterSpacing: '0.15em', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: simulationPaused ? 'rgba(255,200,0,0.6)' : 'rgba(100,255,100,0.6)' }} />
            Engine: {simulationPaused ? 'Paused' : 'Computing'}
          </span>
          <span>Mode: {isResearchMode ? 'Research' : 'Beginner'}</span>
          <span>Panels: {isResearchMode ? 4 : 2}</span>
        </div>
        <a href="https://github.com/neuralsin" target="_blank" rel="noopener noreferrer"
          style={{ color: 'rgba(255,255,255,0.15)', textDecoration: 'none', fontSize: 8, letterSpacing: '0.2em' }}>
          github.com/neuralsin
        </a>
      </footer>
    </div>
  );
};

export default App;
