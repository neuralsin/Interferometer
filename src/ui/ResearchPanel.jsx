import React from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { SliderControl } from './BeginnerPanel.jsx';

const MOUNT_MATERIALS = [
  { value: 'invar', label: 'INVAR (α≈1.2e-6)' },
  { value: 'aluminum', label: 'ALUMINUM (α≈23e-6)' },
  { value: 'steel', label: 'STEEL (α≈17e-6)' },
];

const ToggleRow = ({ label, paramKey }) => {
  const value = useSimulationStore((s) => s[paramKey]);
  const setParam = useSimulationStore((s) => s.setParam);
  return (
    <div className="toggle-row">
      <span className="toggle-row-label">{label}</span>
      <button className="toggle-track" data-active={value}
        onClick={() => setParam(paramKey, !value)} aria-label={`Toggle ${label}`} />
    </div>
  );
};

const ResearchPanel = () => {
  const store = useSimulationStore();
  const { setParam } = store;

  return (
    <>
      {/* Laser Source */}
      <div>
        <h3 className="section-header" style={{ marginBottom: 20 }}>
          <span className="section-dot" /> Laser Source
        </h3>
        <SliderControl label="Wavelength" unit="nm"
          value={store.wavelength * 1e9} min={380} max={1550} step={0.1}
          onChange={(nm) => setParam('wavelength', nm * 1e-9)}
          formatValue={(v) => v.toFixed(1)} />
        <SliderControl label="Power" unit="mW"
          value={store.laserPower * 1e3} min={0.001} max={100} step={0.001}
          onChange={(mw) => setParam('laserPower', mw * 1e-3)}
          formatValue={(v) => v.toFixed(3)} />
        <div className="number-input-row">
          <label>Linewidth (MHz)</label>
          <input type="number" value={(store.laserLinewidth * 1e-6).toFixed(1)}
            onChange={(e) => setParam('laserLinewidth', parseFloat(e.target.value) * 1e6)} />
        </div>
      </div>

      {/* Arm Configuration */}
      <div>
        <h3 className="section-header" style={{ marginBottom: 20 }}>
          <span className="section-dot" /> Arm Geometries
        </h3>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 }}>
          <p style={{ fontSize: 9, color: 'var(--text-slate)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Arm 1 (Static)</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--text-slate)', opacity: 0.6 }}>Length:</span>
            <span style={{ color: '#fff' }}>{(store.armLengthX * 1e3).toFixed(3)} mm</span>
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 }}>
          <p style={{ fontSize: 9, color: 'var(--text-slate)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Arm 2 (Piezo)</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: 'var(--font-mono)', marginBottom: 12 }}>
            <span style={{ color: 'var(--text-slate)', opacity: 0.6 }}>Pos:</span>
            <span className="value-readout-sm">{(store.mirrorTranslationX * 1e12).toFixed(2)} pm</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button className="btn-ghost" style={{ fontSize: 9, padding: '8px 12px' }}
              onClick={() => setParam('mirrorTranslationX', store.mirrorTranslationX - 1e-12)}>- Δx</button>
            <button className="btn-ghost" style={{ fontSize: 9, padding: '8px 12px' }}
              onClick={() => setParam('mirrorTranslationX', store.mirrorTranslationX + 1e-12)}>+ Δx</button>
          </div>
        </div>
        <SliderControl label="Tip/Tilt X" unit="μrad"
          value={store.mirrorTiltX * 1e6} min={-100} max={100} step={0.1}
          onChange={(urad) => setParam('mirrorTiltX', urad * 1e-6)}
          formatValue={(v) => v.toFixed(1)} />
        <SliderControl label="Tip/Tilt Y" unit="μrad"
          value={store.mirrorTiltY * 1e6} min={-100} max={100} step={0.1}
          onChange={(urad) => setParam('mirrorTiltY', urad * 1e-6)}
          formatValue={(v) => v.toFixed(1)} />
      </div>

      {/* Environmental */}
      <div>
        <h3 className="section-header" style={{ marginBottom: 20 }}>
          <span className="section-dot" /> Environmental
        </h3>
        <ToggleRow label="Vibration Iso" paramKey="seismicNoiseEnabled" />
        <ToggleRow label="Thermal Drift" paramKey="thermalDriftEnabled" />
        <ToggleRow label="Phase Noise" paramKey="phaseNoiseEnabled" />
        <SliderControl label="Amb. Temp" unit="°C"
          value={store.temperature - 273.15} min={-10} max={60} step={0.1}
          onChange={(c) => setParam('temperature', c + 273.15)}
          formatValue={(v) => v.toFixed(1)} />
        <div style={{ marginBottom: 12 }}>
          <label className="label-micro" style={{ display: 'block', marginBottom: 8 }}>Mount Material</label>
          <select value={store.mountMaterial}
            onChange={(e) => setParam('mountMaterial', e.target.value)}
            style={{ width: '100%' }}>
            {MOUNT_MATERIALS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {/* Quantum */}
      <div>
        <h3 className="section-header" style={{ marginBottom: 20 }}>
          <span className="section-dot" /> Quantum Effects
        </h3>
        <ToggleRow label="Shot Noise" paramKey="shotNoiseEnabled" />
        <SliderControl label="Squeezing (r)" unit=""
          value={store.squeezingParam} min={0} max={3} step={0.01}
          onChange={(v) => setParam('squeezingParam', v)}
          formatValue={(v) => v.toFixed(2)} />
      </div>

      {/* GW */}
      <div>
        <h3 className="section-header" style={{ marginBottom: 20 }}>
          <span className="section-dot" /> Gravitational Waves
        </h3>
        <ToggleRow label="GW Injection" paramKey="gwEnabled" />
        <SliderControl label="Strain h" unit=""
          value={Math.log10(store.gwStrain)} min={-25} max={-15} step={0.1}
          onChange={(logH) => setParam('gwStrain', Math.pow(10, logH))}
          formatValue={(v) => `10^${v.toFixed(1)}`} />
        <SliderControl label="GW Freq" unit="Hz"
          value={store.gwFrequency} min={10} max={5000} step={1}
          onChange={(v) => setParam('gwFrequency', v)}
          formatValue={(v) => v.toFixed(0)} />
      </div>

      {/* Emergency Shutoff */}
      <button className="btn-danger">Emergency Shutoff</button>
    </>
  );
};

export default ResearchPanel;
