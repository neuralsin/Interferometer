import React, { useState } from 'react';
import SceneManager from './scene/SceneManager.jsx';
import Sidebar from './ui/Sidebar.jsx';
import BottomBar from './ui/BottomBar.jsx';
import PhysicsNoisePanel from './ui/PhysicsNoisePanel.jsx';
import QuantumPanel from './ui/QuantumPanel.jsx';
import AnalyticsPanel from './ui/AnalyticsPanel.jsx';
import useSimulationStore from './store/simulationStore.js';
import { exportCSV, exportImage, exportJSON } from './physics/dataExport.js';

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

/** Beginner Bottom Bar with wavelength + geometry sliders */
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
      <div className="glass-card" style={{ flex: 1, borderRadius: 'var(--radius-high)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-silver-200)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Laser Engine λ</h4>
          <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: '#fff', fontWeight: 700 }}>{(wavelength * 1e9).toFixed(2)} nm</span>
        </div>
        <input type="range" min={380} max={780} step={0.1} value={wavelength * 1e9}
          onChange={(e) => setParam('wavelength', parseFloat(e.target.value) * 1e-9)} />
        <p style={{ fontSize: 9, color: 'var(--text-mercury)', opacity: 0.5, fontStyle: 'italic' }}>Adjust subatomic source wavelength.</p>
      </div>
      <div className="glass-card" style={{ flex: 1, borderRadius: 'var(--radius-high)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-silver-200)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Geometry Offset Δd</h4>
          <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: '#fff', fontWeight: 700 }}>{(opd * 1e6).toFixed(2)} μm</span>
        </div>
        <input type="range" min={50} max={500} step={0.001} value={Math.abs(mirror2PosZ) * 1e3}
          onChange={(e) => setParam('mirror2PosZ', -parseFloat(e.target.value) * 1e-3)} />
        <p style={{ fontSize: 9, color: 'var(--text-mercury)', opacity: 0.5, fontStyle: 'italic' }}>Actuate primary arm micro-adjustment.</p>
      </div>
    </footer>
  );
};

const App = () => {
  const isResearchMode = useSimulationStore((s) => s.isResearchMode);
  const simulationPaused = useSimulationStore((s) => s.simulationPaused);
  const toggleResearchMode = useSimulationStore((s) => s.toggleResearchMode);
  const setParam = useSimulationStore((s) => s.setParam);
  const wavelength = useSimulationStore((s) => s.wavelength);
  const [activeTab, setActiveTab] = useState('sim');

  const handleExport = () => exportCSV(useSimulationStore.getState());

  return (
    <div className="app-layout">
      {/* ===== HEADER ===== */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 36, height: 36, border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 'var(--radius-high)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.05)', boxShadow: '0 0 15px rgba(226,232,240,0.2)',
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

          {/* Tab navigation (research mode only) */}
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
          {/* Play/Pause toggle (replaces static "LIVE SIMULATION ACTIVE") */}
          {isResearchMode && (
            <>
              <button onClick={() => setParam('simulationPaused', !simulationPaused)} className="status-pill" style={{
                cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
              }}>
                <span className="status-dot" style={{ opacity: simulationPaused ? 0.3 : 1 }} />
                {simulationPaused ? 'SIMULATION PAUSED' : 'STABLE_OSCILLATION'}
              </button>
              <button className="btn-primary" onClick={handleExport} style={{ fontSize: 8, padding: '6px 16px', gap: 6 }}>
                <DownloadIcon /> Export Data
              </button>
            </>
          )}

          {/* Mode switch button */}
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
        /* BEGINNER MODE */
        <>
          <div className="app-main">
            <section className="app-viewport glass-card" style={{ borderRadius: 'var(--radius-high)' }}>
              <div className="viewport-grid" style={{ position: 'absolute', inset: 0, opacity: 0.2 }} />
              <SceneManager />
              <div className="viewport-overlay">
                <p style={{ color: '#fff', fontWeight: 700, marginBottom: 4, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>System_Telemetry</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
                  <span>VECTOR:</span><span style={{ color: '#fff' }}>XYZ_AXIS</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
                  <span>SOURCE:</span><span style={{ color: '#fff' }}>{(wavelength * 1e9).toFixed(0)} NM</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
                  <span>SAMPLING:</span><span style={{ color: '#fff' }}>12.5 GS/s</span>
                </div>
              </div>
            </section>
            <aside className="app-sidebar">
              <div className="app-sidebar-inner glass-card">
                <Sidebar />
              </div>
            </aside>
          </div>
          <BeginnerBottomBar />
        </>
      ) : (
        /* RESEARCH MODE */
        <>
          {activeTab === 'sim' && (
            <>
              <div className="app-main">
                <section className="app-viewport glass-card" style={{ borderRadius: 'var(--radius-high)' }}>
                  <div className="viewport-grid" style={{ position: 'absolute', inset: 0, opacity: 0.2 }} />
                  <SceneManager />
                  <div className="viewport-overlay">
                    <p style={{ color: '#fff', fontWeight: 700, marginBottom: 4, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>System_Telemetry</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
                      <span>VECTOR:</span><span style={{ color: '#fff' }}>XYZ_AXIS</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
                      <span>SAMPLING:</span><span style={{ color: '#fff' }}>12.5 GS/s</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
                      <span>LATENCY:</span><span style={{ color: '#fff' }}>0.04 ms</span>
                    </div>
                  </div>
                  <button className="btn-ghost" style={{
                    position: 'absolute', bottom: 24, right: 24, padding: 10,
                    borderRadius: 'var(--radius-full)',
                  }}>
                    <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                        strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </button>
                </section>
                <aside className="app-sidebar">
                  <div className="app-sidebar-inner glass-card">
                    <Sidebar />
                  </div>
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
          <span>Kernel: v18.4.3-Stochastic</span>
          <span>GPU_Accel: True</span>
        </div>
        <span>CID: 0x2A88F4...119D</span>
      </footer>
    </div>
  );
};

export default App;
