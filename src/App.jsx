import React, { useState, useCallback, useRef } from 'react';
import SceneManager from './scene/SceneManager.jsx';
import Sidebar from './ui/Sidebar.jsx';
import BottomBar from './ui/BottomBar.jsx';
import PhysicsNoisePanel from './ui/PhysicsNoisePanel.jsx';
import QuantumPanel from './ui/QuantumPanel.jsx';
import AnalyticsPanel from './ui/AnalyticsPanel.jsx';
import useSimulationStore from './store/simulationStore.js';
import { exportCSV, exportJSON } from './physics/dataExport.js';
import { detectionProbabilities } from './physics/basicInterference.js';
import { fringeVisibility } from './physics/coherenceModel.js';

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

/** Detection Stats Overlay — replaces System Telemetry */
const DetectionOverlay = ({ isResearch }) => {
  const state = useSimulationStore();
  const armX = Math.sqrt(state.mirror1PosX ** 2 + state.mirror1PosZ ** 2);
  const armY = Math.sqrt(state.mirror2PosX ** 2 + state.mirror2PosZ ** 2);
  const opd = 2 * (armX - armY);
  const { p1, p2 } = detectionProbabilities(state.wavelength, opd);
  const vis = fringeVisibility(opd, state.laserLinewidth);
  // Read LIVE sim counts from SceneManager particle sim
  const n1 = state.simD1;
  const n2 = state.simD2;
  const total = state.simFired;
  const actualP1 = total > 0 ? (n1 / total * 100).toFixed(1) : '—';
  const actualP2 = total > 0 ? (n2 / total * 100).toFixed(1) : '—';
  const delta = total > 0 ? ((n1 / total - p1) * 100).toFixed(2) : '0.00';

  return (
    <div className="viewport-overlay" style={{ maxWidth: isResearch ? 220 : 180 }}>
      <p style={{ color: '#fff', fontWeight: 700, marginBottom: 6, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        Detected Counts
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ color: '#2dd4a8' }}>D₁:</span><span style={{ color: '#fff', fontWeight: 700 }}>{n1}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ color: '#4f9cf9' }}>D₂:</span><span style={{ color: '#fff', fontWeight: 700 }}>{n2}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 4, paddingTop: 4 }}>
        <span>Total:</span><span style={{ color: '#fff' }}>{total}</span>
      </div>
      {total > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <div style={{ flex: n1, height: 4, background: '#2dd4a8', borderRadius: 2 }} />
            <div style={{ flex: Math.max(1, n2), height: 4, background: '#4f9cf9', borderRadius: 2 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8 }}>
            <span style={{ color: '#2dd4a8' }}>{actualP1}%</span>
            <span style={{ color: '#4f9cf9' }}>{actualP2}%</span>
          </div>
        </div>
      )}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 6, paddingTop: 6, fontSize: 8 }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Theory</p>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>P₁ (cos²δ/2):</span><span style={{ color: '#fff' }}>{(p1 * 100).toFixed(1)}%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>P₂ (sin²δ/2):</span><span style={{ color: '#fff' }}>{(p2 * 100).toFixed(1)}%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Visibility:</span><span style={{ color: '#fff' }}>{(vis * 100).toFixed(1)}%</span>
        </div>
      </div>
      {isResearch && total > 10 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 6, paddingTop: 6, fontSize: 8 }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Δ(sim − theory)
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>D₁:</span>
            <span style={{ color: Math.abs(parseFloat(delta)) < 5 ? '#4f4' : '#f84' }}>
              {delta}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/** Beginner Bottom Bar */
const BeginnerBottomBar = () => {
  const wavelength = useSimulationStore((s) => s.wavelength);
  const mirror2PosZ = useSimulationStore((s) => s.mirror2PosZ);
  const mirror1PosX = useSimulationStore((s) => s.mirror1PosX);
  const setParam = useSimulationStore((s) => s.setParam);
  const armX = Math.abs(mirror1PosX);
  const armY = Math.abs(mirror2PosZ);
  const opd = 2 * (armX - armY);

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
          <h4 style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-silver-200)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Geometry Offset Δd</h4>
          <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: '#fff', fontWeight: 700 }}>{(opd * 1e6).toFixed(2)} μm</span>
        </div>
        <input type="range" min={50} max={500} step={0.001} value={Math.abs(mirror2PosZ) * 1e3}
          onChange={(e) => setParam('mirror2PosZ', -parseFloat(e.target.value) * 1e-3)} />
      </div>
    </footer>
  );
};

const TOOLBAR_ITEMS = [
  { label: 'M1', desc: 'Mirror 1 — Toggle tip angle (3×10⁻⁴ rad). Changes fringe tilt on detector.', paramKey: 'mirror1Tip', toggle: [0, 3e-4] },
  { label: 'M2', desc: 'Mirror 2 — Toggle tip angle (2×10⁻⁴ rad). Creates asymmetric fringe pattern.', paramKey: 'mirror2Tip', toggle: [0, 2e-4] },
  { label: 'CP', desc: 'Compensator Plate — Equalizes optical path through BS glass. Essential for white-light fringes.', paramKey: 'compensatorEnabled', isToggle: true },
  { label: 'GW', desc: 'Gravitational Wave — Inject h₀=10⁻²¹ strain signal. Simulates LIGO-like detection.', paramKey: 'gwEnabled', isToggle: true },
  { label: '🔊', desc: 'Seismic Noise — Ground vibration coupling at ~15 Hz. Adds position jitter to mirrors.', paramKey: 'seismicNoiseEnabled', isToggle: true },
  { label: '🌡', desc: 'Thermal Drift — Temperature-driven path changes via CTE of mirror substrates.', paramKey: 'thermalDriftEnabled', isToggle: true },
];

const ComponentToolbar = () => {
  const setParam = useSimulationStore((s) => s.setParam);
  return (
    <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 6 }}>
      {TOOLBAR_ITEMS.map(item => (
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
  const [activeTab, setActiveTab] = useState('sim');
  const viewportRef = useRef(null);

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
              {isResearchMode ? 'Quantum Interferometry Suite v4.2' : 'Michelson Interferometer v4.2'}
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
          {isResearchMode && (
            <>
              <button onClick={() => setParam('simulationPaused', !simulationPaused)} className="status-pill" style={{
                cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
              }}>
                <span className="status-dot" style={{ opacity: simulationPaused ? 0.3 : 1 }} />
                {simulationPaused ? 'PAUSED' : 'STABLE_OSCILLATION'}
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
        </div>
      </header>

      {/* ===== CONTENT ===== */}
      {!isResearchMode ? (
        <>
          <div className="app-main">
            <section ref={viewportRef} className="app-viewport glass-card" style={{ borderRadius: 'var(--radius-high)' }}>
              <div className="viewport-grid" style={{ position: 'absolute', inset: 0, opacity: 0.2 }} />
              <SceneManager />
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
                  <SceneManager />
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
