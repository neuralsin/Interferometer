import React, { useState } from 'react';
import SceneManager from './scene/SceneManager.jsx';
import Sidebar from './ui/Sidebar.jsx';
import ModeToggle from './ui/ModeToggle.jsx';
import BottomBar from './ui/BottomBar.jsx';
import PhysicsNoisePanel from './ui/PhysicsNoisePanel.jsx';
import QuantumPanel from './ui/QuantumPanel.jsx';
import AnalyticsPanel from './ui/AnalyticsPanel.jsx';
import useSimulationStore from './store/simulationStore.js';
import { exportCSV, exportImage, exportJSON } from './physics/dataExport.js';

const TABS = [
  { id: 'sim', label: 'SIMULATION' },
  { id: 'physics', label: 'WAVE OPTICS & NOISE' },
  { id: 'quantum', label: 'QUANTUM' },
  { id: 'analytics', label: 'ANALYTICS & EXPORT' },
];

const FlaskIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
      strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
  </svg>
);

const DownloadIcon = () => (
  <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

const App = () => {
  const isResearchMode = useSimulationStore((s) => s.isResearchMode);
  const [activeTab, setActiveTab] = useState('sim');

  const handleExport = () => {
    const state = useSimulationStore.getState();
    exportCSV(state);
  };

  return (
    <div className="app-layout">
      {/* ---- Header ---- */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: 36, height: 36,
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 'var(--radius-high)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.05)',
            boxShadow: '0 0 15px rgba(226,232,240,0.4)',
          }}>
            <FlaskIcon />
          </div>
          <div>
            <h1 style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.2em', color: '#fff', textTransform: 'uppercase' }}>
              Simulab Research
            </h1>
            <p style={{ fontSize: 9, color: 'var(--text-mercury)', textTransform: 'uppercase', letterSpacing: '0.3em', fontWeight: 500, opacity: 0.7 }}>
              Michelson Interferometer v4.2
            </p>
          </div>

          {/* Tab Navigation */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 32, background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-high)', padding: '3px', border: '1px solid rgba(255,255,255,0.06)' }}>
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                padding: '6px 16px',
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: activeTab === tab.id ? '#000' : 'var(--text-mercury)',
                background: activeTab === tab.id ? '#fff' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-high)',
                cursor: 'pointer',
                transition: 'all 200ms ease',
              }}>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="status-pill">
            <span className="status-dot" />
            LIVE SIMULATION ACTIVE
          </div>
          <ModeToggle />
          <button className="btn-primary" onClick={handleExport}>
            <DownloadIcon /> Export Data
          </button>
        </div>
      </header>

      {/* ---- Tab Content ---- */}
      {activeTab === 'sim' && (
        <>
          <div className="app-main">
            <section className="app-viewport glass-card" style={{ borderRadius: 'var(--radius-high)' }}>
              <div className="viewport-grid" style={{ position: 'absolute', inset: 0, opacity: 0.2 }} />
              <SceneManager />
              <div className="viewport-overlay">
                <p style={{ color: '#fff', fontWeight: 700, marginBottom: 8, letterSpacing: '0.15em', textTransform: 'uppercase', fontSize: 9 }}>
                  Optical Geometry
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32 }}>
                  <span>CAM:</span> <span style={{ color: '#fff' }}>PERSPECTIVE</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32 }}>
                  <span>FPS:</span> <span style={{ color: '#fff' }}>60.0</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32 }}>
                  <span>RENDER:</span> <span style={{ color: '#fff' }}>WebGL2_ULTRA</span>
                </div>
              </div>
              <button className="btn-ghost" style={{
                position: 'absolute', bottom: 24, right: 24,
                padding: 12, borderRadius: 'var(--radius-full)',
              }}>
                <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* ---- Footer (always visible) ---- */}
      <footer style={{
        height: 40,
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)',
        letterSpacing: '0.2em', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 40 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
            ENGINE: COMPUTING
          </span>
          <span>KERNEL: v18.4.3-STOCHASTIC</span>
          <span>GPU_ACCEL: TRUE</span>
        </div>
        <span>CID: 0x2A88F4...119D</span>
      </footer>
    </div>
  );
};

export default App;
