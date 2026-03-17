import React from 'react';
import useSimulationStore from '../store/simulationStore.js';

/** Reusable V3-styled slider row */
const SliderControl = ({ label, unit, value, min, max, step, onChange, formatValue }) => {
  const displayValue = formatValue ? formatValue(value) : value;
  return (
    <div className="slider-row">
      <div className="slider-row-label">
        <span>{label}</span>
        <span className="slider-value">{displayValue} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
};

const BeginnerPanel = () => {
  const wavelength = useSimulationStore((s) => s.wavelength);
  const armLengthX = useSimulationStore((s) => s.armLengthX);
  const armLengthY = useSimulationStore((s) => s.armLengthY);
  const mirrorTiltX = useSimulationStore((s) => s.mirrorTiltX);
  const setParam = useSimulationStore((s) => s.setParam);

  const opd = 2 * (armLengthX - armLengthY);

  return (
    <>
      {/* Laser Source */}
      <div>
        <h3 className="section-header" style={{ marginBottom: 16 }}>
          <span className="section-dot" /> Laser Engine λ
        </h3>
        <SliderControl label="Wavelength" unit="nm"
          value={wavelength * 1e9} min={380} max={780} step={0.1}
          onChange={(nm) => setParam('wavelength', nm * 1e-9)}
          formatValue={(v) => v.toFixed(1)} />
        <p style={{ fontSize: 9, color: 'var(--text-mercury)', opacity: 0.5, fontStyle: 'italic', letterSpacing: '0.05em' }}>
          Adjust subatomic source wavelength.
        </p>
      </div>

      {/* Geometry */}
      <div>
        <h3 className="section-header" style={{ marginBottom: 16 }}>
          <span className="section-dot" /> Geometry Offset
        </h3>

        <div className="number-input-row" style={{ marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 9, color: 'var(--text-slate)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Arm 1 (Static)
            </p>
            <span className="value-readout">{(armLengthX * 1e3).toFixed(3)} mm</span>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 }}>
          <p style={{ fontSize: 9, color: 'var(--text-slate)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Arm 2 (Piezo)
          </p>
          <SliderControl label="Position" unit="mm"
            value={armLengthY * 1e3} min={50} max={500} step={0.001}
            onChange={(mm) => setParam('armLengthY', mm * 1e-3)}
            formatValue={(v) => v.toFixed(3)} />
        </div>

        <SliderControl label="Mirror Tilt" unit="mrad"
          value={mirrorTiltX * 1e3} min={-5} max={5} step={0.01}
          onChange={(mrad) => setParam('mirrorTiltX', mrad * 1e-3)}
          formatValue={(v) => v.toFixed(2)} />
      </div>

      {/* Physics Explanation */}
      <div>
        <h3 className="label-section" style={{ marginBottom: 16 }}>Simulation Analysis</h3>
        <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-mercury)' }}>
          <p style={{ marginBottom: 12, textAlign: 'justify', opacity: 0.8 }}>
            The coherent source beams recombine at the semi-reflective interface (BS-1), inducing
            interference proportional to the resultant <strong style={{ color: '#fff' }}>phase differential</strong>.
          </p>
          <div style={{
            fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.03)',
            padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)',
            textAlign: 'center', color: '#fff', marginBottom: 12,
          }}>
            I = 2I₀(1 + cos(δ))
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.03)',
            padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)',
            textAlign: 'center', color: '#fff', marginBottom: 16,
          }}>
            δ = (2π / λ) × 2Δd
          </div>
          <div style={{ fontSize: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', marginTop: 4, flexShrink: 0 }} />
              <p><span style={{ color: '#fff', fontWeight: 700, textTransform: 'uppercase' }}>Constructive:</span> Maximum intensity when Δd = nλ.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.4)', marginTop: 4, flexShrink: 0 }} />
              <p><span style={{ color: '#fff', fontWeight: 700, textTransform: 'uppercase' }}>Destructive:</span> Cancellation at Δd = (n+½)λ.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export { SliderControl };
export default BeginnerPanel;
