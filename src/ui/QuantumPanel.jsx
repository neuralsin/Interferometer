import React from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { photonCount, shotNoiseLimit, squeezedSensitivity, phaseSNR } from '../physics/quantumModel.js';
import { SliderControl } from './BeginnerPanel.jsx';

/**
 * Quantum Panel — maps to:
 *   subatomic_quantum_configuration (V3 reference)
 *
 * Surfaces backend engines:
 *   - quantumModel.js (photon count, SQL, squeezed sensitivity, SNR)
 *   - polarization.js (Jones vector type)
 *   - detectorModel.js (QE readout)
 */
const QuantumPanel = () => {
  const state = useSimulationStore();
  const { setParam } = state;

  // Live backend calculations
  const N = photonCount(state.laserPower, state.wavelength, 0.001);
  const sql = shotNoiseLimit(N);
  const sqzSens = squeezedSensitivity(N, state.squeezingParam);
  const opd = 2 * ((state.armLengthX + state.mirrorTranslationX) - (state.armLengthY + state.mirrorTranslationY));
  const snr = phaseSNR(Math.abs(opd * 2 * Math.PI / state.wavelength), N, state.squeezingParam);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
      {/* Dashboard Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }} className="silver-gradient-text">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--text-silver-200)', boxShadow: '0 0 12px rgba(226,232,240,0.6)' }} />
              Subatomic Quantum Panel
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-silver-400)', opacity: 0.5, marginLeft: 8 }}>v.Ω-9</span>
            </span>
          </h1>
          <p style={{ color: 'var(--text-slate)', fontSize: 14, marginTop: 4, fontWeight: 500 }}>
            Unified Interface for Non-Classical Light & Vacuum Fluctuations
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-ghost" onClick={() => useSimulationStore.getState().resetToDefaults()}>System Reset</button>
          <button className="btn-primary">Initiate Sequence</button>
        </div>
      </header>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 32, marginBottom: 32 }}>

        {/* Squeezed Vacuum States */}
        <section className="glass-card" style={{ borderRadius: 'var(--radius-high)', padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-silver-400)' }}>Squeezed Vacuum States</h2>
            <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-silver-300)', fontFamily: 'var(--font-mono)' }}>STABLE_COHERENCE</span>
          </div>

          {/* 3D-ish Squeezed Ellipse */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32, perspective: '1000px' }}>
            <div style={{ position: 'relative', width: 192, height: 192, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotateX(20deg) rotateY(-20deg)', transition: 'transform 500ms ease' }}>
              <div style={{ position: 'absolute', inset: 0, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%' }} />
              <div style={{ position: 'absolute', inset: 16, border: '1px solid rgba(255,255,255,0.05)', borderRadius: '50%' }} />
              <div style={{
                width: 160, height: 40,
                border: '2px solid var(--text-silver-200)',
                background: 'rgba(226,232,240,0.1)',
                borderRadius: '50%',
                filter: 'blur(1px)',
                boxShadow: '0 0 25px rgba(226,232,240,0.2)',
                transform: `rotate(${state.polarizerAngle * 180 / Math.PI}deg) scaleY(${Math.max(0.2, 1 - state.squeezingParam * 0.3)})`,
                transition: 'all 300ms ease',
              }} />
              <div style={{ position: 'absolute', width: '100%', height: 1, background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ position: 'absolute', height: '100%', width: 1, background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ position: 'absolute', top: 0, right: 0, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-slate)' }}>
                Re[α]<br />Im[α]
              </div>
            </div>
          </div>

          <SliderControl label="Squeezing Factor (r)" unit="ζ"
            value={state.squeezingParam} min={0} max={3} step={0.01}
            onChange={(v) => setParam('squeezingParam', v)}
            formatValue={(v) => (v * 2).toFixed(2)} />
          <SliderControl label="Angle (θ)" unit="°"
            value={state.polarizerAngle * 180 / Math.PI} min={0} max={360} step={1}
            onChange={(deg) => setParam('polarizerAngle', deg * Math.PI / 180)}
            formatValue={(v) => v.toFixed(1)} />
        </section>

        {/* Shot Noise Fluctuations */}
        <section className="glass-card" style={{ borderRadius: 'var(--radius-high)', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-silver-400)' }}>Shot Noise Fluctuations</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ height: 4, width: 48, background: 'linear-gradient(to right, transparent, var(--text-silver-400), transparent)', opacity: 0.3 }} />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-slate)' }}>REALTIME_TELEMETRY</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Noise wave graph */}
              <div style={{ height: 180, background: 'rgba(0,0,0,0.4)', borderRadius: 'var(--radius-high)', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 400 100" style={{ width: '100%', height: '100%', padding: 16 }}>
                  <path d="M0,50 Q10,40 20,55 T40,45 T60,60 T80,42 T100,52 T120,48 T140,57 T160,40 T180,50 T200,45 T220,55 T240,42 T260,52 T280,48 T300,57 T320,40 T340,50 T360,45 T380,55 T400,50"
                    fill="none" stroke="rgba(226,232,240,0.4)" strokeWidth="1.5" />
                  <path d="M0,50 L400,50" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: 16, left: 24, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-silver-400)' }}>
                  Δf = {(state.laserLinewidth * 1e-9).toFixed(1)} GHz
                </div>
                <div style={{ position: 'absolute', bottom: 16, right: 24, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-silver-400)' }}>
                  SQL = {sql.toExponential(2)} rad
                </div>
              </div>

              {/* QE + Photon Flux cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-high)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-slate)', display: 'block', marginBottom: 12, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Quantum Efficiency (η)</label>
                  <span style={{ fontSize: 20, fontFamily: 'var(--font-mono)', color: 'var(--text-silver-200)' }}>{(state.quantumEfficiency * 100).toFixed(1)}%</span>
                </div>
                <div style={{ padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-high)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-slate)', display: 'block', marginBottom: 12, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Photon Flux (Φ)</label>
                  <span style={{ fontSize: 20, fontFamily: 'var(--font-mono)', color: 'var(--text-silver-200)' }}>
                    {N.toExponential(1)} <span style={{ fontSize: 10, opacity: 0.5 }}>s⁻¹</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Flux tuning bar + sync */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="glass-card" style={{ flex: 1, borderRadius: 'var(--radius-high)', padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-slate)', marginBottom: 16, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block' }}>
                  Squeezed Sensitivity
                </label>
                <div style={{ fontSize: 18, fontFamily: 'var(--font-mono)', color: '#fff', marginBottom: 8 }}>
                  {sqzSens.toExponential(2)}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-mercury)', opacity: 0.6 }}>
                  rad (shot noise limited)
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-silver-200)', marginTop: 16 }}>
                  SNR: {snr.toFixed(1)}
                </div>
              </div>
              <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
                Sync Matrix
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Subatomic Metrics Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
        <MetricTile accent label="Planck Interval" value="5.39e-44 s" />
        <MetricTile label="Field Topology" value="NON-EUCLIDEAN" />
        <MetricTile label="Bose-Einstein Cond." value="12.4 nK" />
        <MetricTile highlight label="State Purity" value={`${(1 - sqzSens).toFixed(4)}`} pulse />
      </div>
    </div>
  );
};

const MetricTile = ({ label, value, accent, highlight, pulse }) => (
  <div className="glass-card" style={{
    borderRadius: 'var(--radius-high)', padding: 20,
    borderLeft: accent ? '4px solid var(--text-silver-300)' : 'none',
    background: highlight ? 'rgba(226,232,240,0.05)' : undefined,
  }}>
    <div style={{ fontSize: 10, color: 'var(--text-slate)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontFamily: 'var(--font-mono)', color: 'var(--text-silver-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>{value}</span>
      {pulse && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-silver-200)', animation: 'ping 1.5s infinite' }} />}
    </div>
  </div>
);

export default QuantumPanel;
