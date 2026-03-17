import React from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { fringeVisibility } from '../physics/coherenceModel.js';
import { photonCount, phaseSNR } from '../physics/quantumModel.js';

/**
 * Bottom detector bar matching the V3 unified_main_research_view design:
 * 3 panels: Detector Image | Intensity Profile | System Health
 */
const BottomBar = () => {
  const state = useSimulationStore();
  const opd = 2 * ((state.armLengthX + state.mirrorTranslationX) - (state.armLengthY + state.mirrorTranslationY));
  const visibility = fringeVisibility(opd, state.laserLinewidth);
  const N = photonCount(state.laserPower, state.wavelength, 0.001);
  const snr = N > 0 ? (10 * Math.log10(phaseSNR(Math.abs(opd * 2 * Math.PI / state.wavelength), N, state.squeezingParam))).toFixed(1) : '0';

  const waveBars = [
    { h: '30%', o: 0.2, d: '0s' }, { h: '50%', o: 0.4, d: '0.2s' },
    { h: '75%', o: 0.6, d: '0.4s' }, { h: '95%', o: 0.8, d: '0.6s' },
    { h: '100%', o: 1, d: '0.8s' }, { h: '80%', o: 0.8, d: '1.0s' },
    { h: '55%', o: 0.6, d: '1.2s' }, { h: '40%', o: 0.4, d: '1.4s' },
    { h: '25%', o: 0.2, d: '1.6s' },
    { h: '45%', o: 0.4, d: '0.3s' }, { h: '70%', o: 0.6, d: '0.5s' },
    { h: '90%', o: 0.8, d: '0.7s' }, { h: '98%', o: 1, d: '0.9s' },
    { h: '85%', o: 0.8, d: '1.1s' }, { h: '60%', o: 0.6, d: '1.3s' },
    { h: '35%', o: 0.4, d: '1.5s' }, { h: '20%', o: 0.2, d: '1.7s' },
    { h: '65%', o: 0.6, d: '0.2s' }, { h: '88%', o: 0.8, d: '0.4s' },
    { h: '95%', o: 1, d: '0.6s' }, { h: '75%', o: 0.8, d: '0.8s' },
    { h: '50%', o: 0.6, d: '1.0s' }, { h: '30%', o: 0.4, d: '1.2s' },
  ];

  return (
    <footer className="app-bottom-bar">
      {/* Detector Image */}
      <div className="glass-card" style={{ width: 288, borderRadius: 'var(--radius-high)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h4 style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-slate)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
          Detector Image
        </h4>
        <div style={{
          flex: 1, borderRadius: 16, background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {/* SVG concentric fringe rings */}
          <svg width="128" height="128" viewBox="0 0 100 100" style={{ opacity: 0.8 }}>
            <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="0.5"
              strokeDasharray="2 2" style={{ animation: 'ping 3s infinite' }} />
            <circle cx="50" cy="50" r="35" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="25" fill="none" stroke="#94a3b8" strokeWidth="2.5" />
            <circle cx="50" cy="50" r="15" fill="none" stroke="#64748b" strokeWidth="4" />
            <circle cx="50" cy="50" r="4" fill="white" />
          </svg>
        </div>
      </div>

      {/* Intensity Profile */}
      <div className="glass-card" style={{ flex: 1, borderRadius: 'var(--radius-high)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 4 }}>
          <h4 style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-slate)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            Intensity Profile
          </h4>
          <div style={{ display: 'flex', gap: 24, fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em' }}>
            <span style={{ color: '#f1f5f9' }}>PEAK: {(visibility).toFixed(2)} AU</span>
            <span style={{ color: '#94a3b8' }}>OPD: {(Math.abs(opd) * 1e9).toFixed(1)} nm</span>
          </div>
        </div>
        <div style={{
          flex: 1, borderRadius: 16, background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.05)',
          position: 'relative', display: 'flex', alignItems: 'flex-end',
          padding: '0 24px 16px', gap: 6, overflow: 'hidden',
        }}>
          {waveBars.map((bar, i) => (
            <div key={i} className="wave-bar" style={{
              width: 6, height: bar.h,
              background: `rgba(255, 255, 255, ${bar.o * 0.4})`,
              borderRadius: 2,
              animationDelay: bar.d,
            }} />
          ))}
          {/* Grid lines */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 24, pointerEvents: 'none', opacity: 0.2 }}>
            <div style={{ borderTop: '1px solid white', width: '100%' }} />
            <div style={{ borderTop: '1px solid white', width: '100%' }} />
            <div style={{ borderTop: '1px solid white', width: '100%' }} />
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="glass-card" style={{ width: 288, borderRadius: 'var(--radius-high)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h4 style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-slate)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
          System Health
        </h4>
        <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="metric-card">
            <span className="metric-label">COHERENCE:</span>
            <span className="metric-value">{(visibility * 100).toFixed(1)}%</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">PHASE ERR:</span>
            <span className="metric-value">&lt; 0.01π</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">S/N RATIO:</span>
            <span className="metric-value">{snr} dB</span>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <button className="btn-primary" style={{ width: '100%', padding: '10px 0' }}>
              CALIBRATE_AUTO
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default BottomBar;
