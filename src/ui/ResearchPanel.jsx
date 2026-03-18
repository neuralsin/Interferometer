import React, { useState } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { SliderControl } from './BeginnerPanel.jsx';

const MOUNT_MATERIALS = [
  { value: 'invar', label: 'INVAR (α≈1.2e-6/K)' },
  { value: 'aluminum', label: 'ALUMINUM (α≈23e-6/K)' },
  { value: 'steel', label: 'STEEL (α≈17e-6/K)' },
  { value: 'zerodur', label: 'ZERODUR (α≈0.05e-6/K)' },
  { value: 'fused_silica', label: 'FUSED SILICA (α≈0.55e-6/K)' },
];

const POLARIZATIONS = [
  { value: 'horizontal', label: 'H (Linear)' },
  { value: 'vertical', label: 'V (Linear)' },
  { value: 'diagonal', label: 'D (+45°)' },
  { value: 'circular', label: 'R (Circular)' },
];

const Section = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 8 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0',
        color: 'var(--text-silver-200)',
      }}>
        <span className="section-dot" />
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', flex: 1, textAlign: 'left' }}>{title}</span>
        <span style={{ fontSize: 10, color: 'var(--text-mercury)', opacity: 0.5 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && <div style={{ paddingLeft: 14 }}>{children}</div>}
    </div>
  );
};

const Toggle = ({ label, paramKey }) => {
  const value = useSimulationStore((s) => s[paramKey]);
  const setParam = useSimulationStore((s) => s.setParam);
  return (
    <div className="toggle-row">
      <span className="toggle-row-label">{label}</span>
      <button className="toggle-track" data-active={value}
        onClick={() => setParam(paramKey, !value)} />
    </div>
  );
};

const NumberRow = ({ label, unit, value, paramKey, convert = 1, precision = 3 }) => {
  const setParam = useSimulationStore((s) => s.setParam);
  return (
    <div className="number-input-row" style={{ marginBottom: 6 }}>
      <label>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input type="number" step="any" value={(value / convert).toFixed(precision)}
          onChange={(e) => setParam(paramKey, parseFloat(e.target.value) * convert)}
          style={{ width: 80 }} />
        {unit && <span style={{ fontSize: 8, color: 'var(--text-mercury)', opacity: 0.6 }}>{unit}</span>}
      </div>
    </div>
  );
};

/**
 * Research Panel — ALL 60+ simulation variables
 * Every slider/input directly writes to simulationStore → drives physics engines in real-time
 */
const ResearchPanel = () => {
  const store = useSimulationStore();
  const { setParam } = store;
  const armX = Math.sqrt(store.mirror1PosX ** 2 + store.mirror1PosZ ** 2);
  const armY = Math.sqrt(store.mirror2PosX ** 2 + store.mirror2PosZ ** 2);

  return (
    <>
      {/* ===== MICHELSON GAS CELL (appears for Michelson type) ===== */}
      {store.interferometerType === 'michelson' && (
        <Section title="Gas Cell">
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {[['air', 'Air'], ['he', 'Helium'], ['ar', 'Argon']].map(([val, label]) => (
              <button key={val} onClick={() => setParam('gasCellGas', val)} style={{
                flex: 1, padding: '5px 8px', fontSize: 9, fontWeight: 600,
                borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 150ms',
                border: store.gasCellGas === val ? 'none' : '1px solid rgba(255,255,255,0.1)',
                background: store.gasCellGas === val
                  ? (val === 'air' ? 'rgba(55,138,221,0.2)' : val === 'he' ? 'rgba(29,158,117,0.2)' : 'rgba(216,90,48,0.2)')
                  : 'rgba(255,255,255,0.03)',
                color: store.gasCellGas === val
                  ? (val === 'air' ? '#4f9cf9' : val === 'he' ? '#2dd4a8' : '#f5a623')
                  : 'var(--text-mercury)',
              }}>{label}</button>
            ))}
          </div>
          <SliderControl label="Pressure (P)" unit="atm"
            value={store.gasCellPressure} min={0.1} max={10} step={0.1}
            onChange={(v) => setParam('gasCellPressure', v)} formatValue={(v) => v.toFixed(1)} />
          <SliderControl label="Cell Length (Lc)" unit="cm"
            value={store.gasCellLength * 100} min={1} max={30} step={0.5}
            onChange={(v) => setParam('gasCellLength', v / 100)} formatValue={(v) => v.toFixed(1)} />
          <SliderControl label="Mirror Tilt (θ)" unit="mrad"
            value={store.mirrorTilt} min={0} max={5} step={0.01}
            onChange={(v) => setParam('mirrorTilt', v)} formatValue={(v) => v.toFixed(2)} />
          <SliderControl label="M2 Offset (Δd)" unit="μm"
            value={store.mirrorDisplacement} min={-50} max={50} step={0.1}
            onChange={(v) => setParam('mirrorDisplacement', v)} formatValue={(v) => v.toFixed(1)} />
          <SliderControl label="Curvature Factor" unit=""
            value={store.curvatureFactor} min={0.05} max={2} step={0.05}
            onChange={(v) => setParam('curvatureFactor', v)} formatValue={(v) => v.toFixed(2)} />
          <SliderControl label="Wave Speed" unit="×"
            value={store.waveAnimSpeed} min={0.1} max={5} step={0.05}
            onChange={(v) => setParam('waveAnimSpeed', v)} formatValue={(v) => v.toFixed(2)} />
          <SliderControl label="Wave Amplitude" unit="px"
            value={store.waveAnimAmplitude} min={3} max={20} step={0.5}
            onChange={(v) => setParam('waveAnimAmplitude', v)} formatValue={(v) => v.toFixed(0)} />
        </Section>
      )}

      {/* ===== SAGNAC LOOP (appears for Sagnac type) ===== */}
      {store.interferometerType === 'sagnac' && (
        <Section title="Sagnac Loop">
          <SliderControl label="Loop Length" unit="m"
            value={store.sagnacLoopLength} min={1} max={5000} step={1}
            onChange={(v) => setParam('sagnacLoopLength', v)} formatValue={(v) => v.toFixed(0)} />
          <SliderControl label="Loop Radius" unit="m"
            value={store.sagnacLoopRadius} min={0.01} max={10} step={0.01}
            onChange={(v) => setParam('sagnacLoopRadius', v)} formatValue={(v) => v.toFixed(2)} />
          <SliderControl label="Num Loops" unit=""
            value={store.sagnacNumLoops} min={1} max={1000} step={1}
            onChange={(v) => setParam('sagnacNumLoops', v)} formatValue={(v) => v.toFixed(0)} />
          <SliderControl label="Rot. Velocity (Ω)" unit="rad/s"
            value={store.sagnacOmega} min={-10} max={10} step={0.01}
            onChange={(v) => setParam('sagnacOmega', v)} formatValue={(v) => v.toFixed(2)} />
          {/* Derived readouts */}
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mercury)', opacity: 0.6, marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span>Area:</span><span>{(store.sagnacNumLoops * Math.PI * store.sagnacLoopRadius ** 2).toFixed(2)} m²</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span>v (tangential):</span><span>{(Math.abs(store.sagnacOmega) * store.sagnacLoopRadius).toFixed(4)} m/s</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>ΔFringe:</span><span>{((4 * store.sagnacNumLoops * Math.PI * store.sagnacLoopRadius ** 2 * Math.abs(store.sagnacOmega)) / (299792458 * store.wavelength)).toExponential(3)}</span>
            </div>
          </div>
        </Section>
      )}

      {/* ===== LASER SOURCE ===== */}
      <Section title="Laser Engine">
        <SliderControl label="Wavelength" unit="nm"
          value={store.wavelength * 1e9} min={380} max={1550} step={0.1}
          onChange={(v) => setParam('wavelength', v * 1e-9)} formatValue={(v) => v.toFixed(1)} />
        <SliderControl label="Power" unit="mW"
          value={store.laserPower * 1e3} min={0.01} max={100} step={0.01}
          onChange={(v) => setParam('laserPower', v * 1e-3)} formatValue={(v) => v.toFixed(2)} />
        <SliderControl label="Beam Waist (w₀)" unit="mm"
          value={store.beamWaist * 1e3} min={0.05} max={5} step={0.01}
          onChange={(v) => setParam('beamWaist', v * 1e-3)} formatValue={(v) => v.toFixed(2)} />
        <NumberRow label="Linewidth" unit="MHz" value={store.laserLinewidth} paramKey="laserLinewidth" convert={1e6} precision={1} />
        <div style={{ marginBottom: 8 }}>
          <label className="label-nano" style={{ display: 'block', marginBottom: 6 }}>Polarization</label>
          <select value={store.polarizationInput} onChange={(e) => setParam('polarizationInput', e.target.value)} style={{ width: '100%' }}>
            {POLARIZATIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        {/* Derived readouts */}
        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mercury)', opacity: 0.6, marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span>ν_source:</span><span>{(3e8 / store.wavelength / 1e12).toFixed(2)} THz</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span>Lc (coherence):</span><span>{(3e8 / store.laserLinewidth * 100).toFixed(1)} cm</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Φ (photon flux):</span><span>{((store.laserPower * store.wavelength) / (6.626e-34 * 3e8)).toExponential(2)} /s</span>
          </div>
        </div>
      </Section>

      {/* ===== ARM GEOMETRIES ===== */}
      <Section title="Arm Geometries">
        <div style={{ background: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 8 }}>
          <p style={{ fontSize: 8, color: 'var(--text-slate)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Primary Path (S1)</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fff' }}>
            <span style={{ color: 'var(--text-mercury)', opacity: 0.5 }}>L_fixed:</span>
            <span>{(armX * 1e3).toFixed(5)} mm</span>
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 8 }}>
          <p style={{ fontSize: 8, color: 'var(--text-slate)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Secondary Path (S2)</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8 }}>
            <span style={{ color: 'var(--text-mercury)', opacity: 0.5 }}>δ_drift:</span>
            <span style={{ color: '#fff' }}>{((store.mirror2PosZ + 0.175) * 1e12).toFixed(4)} pm</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button className="btn-ghost" style={{ fontSize: 8, padding: '6px 8px' }}
              onClick={() => setParam('mirror2PosZ', store.mirror2PosZ - 10e-12)}>Coarse-</button>
            <button className="btn-ghost" style={{ fontSize: 8, padding: '6px 8px' }}
              onClick={() => setParam('mirror2PosZ', store.mirror2PosZ + 10e-12)}>Fine+</button>
          </div>
        </div>
        <SliderControl label="Mirror1 Tip" unit="mrad"
          value={store.mirror1Tip * 1e3} min={-2} max={2} step={0.01}
          onChange={(v) => setParam('mirror1Tip', v * 1e-3)} formatValue={(v) => v.toFixed(2)} />
        <SliderControl label="Mirror2 Tip" unit="mrad"
          value={store.mirror2Tip * 1e3} min={-2} max={2} step={0.01}
          onChange={(v) => setParam('mirror2Tip', v * 1e-3)} formatValue={(v) => v.toFixed(2)} />
        <NumberRow label="M1 Reflectivity" unit="" value={store.mirror1Reflectivity} paramKey="mirror1Reflectivity" precision={4} />
        <NumberRow label="M2 Reflectivity" unit="" value={store.mirror2Reflectivity} paramKey="mirror2Reflectivity" precision={4} />
      </Section>

      {/* ===== BEAM SPLITTER ===== */}
      <Section title="Beam Splitter" defaultOpen={false}>
        <SliderControl label="BS Reflectivity" unit=""
          value={store.bsReflectivity} min={0} max={1} step={0.01}
          onChange={(v) => { setParam('bsReflectivity', v); setParam('bsTransmissivity', 1 - v); }}
          formatValue={(v) => v.toFixed(2)} />
        <NumberRow label="Thickness" unit="mm" value={store.bsThickness} paramKey="bsThickness" convert={1e-3} precision={2} />
        <NumberRow label="n (refractive)" unit="" value={store.bsRefractiveIndex} paramKey="bsRefractiveIndex" precision={4} />
        <NumberRow label="Wedge Angle" unit="mrad" value={store.bsWedgeAngle} paramKey="bsWedgeAngle" convert={1e-3} precision={2} />
        <NumberRow label="Phase Shift" unit="rad" value={store.bsCoatingPhaseShift} paramKey="bsCoatingPhaseShift" precision={3} />
      </Section>

      {/* ===== COMPENSATOR ===== */}
      <Section title="Compensator Plate" defaultOpen={false}>
        <Toggle label="Compensator" paramKey="compensatorEnabled" />
        <NumberRow label="Thickness" unit="mm" value={store.compensatorThickness} paramKey="compensatorThickness" convert={1e-3} precision={2} />
        <NumberRow label="n (refractive)" unit="" value={store.compensatorRefractiveIndex} paramKey="compensatorRefractiveIndex" precision={4} />
        <NumberRow label="Tilt" unit="mrad" value={store.compensatorTiltAngle} paramKey="compensatorTiltAngle" convert={1e-3} precision={2} />
      </Section>

      {/* ===== ENVIRONMENT ===== */}
      <Section title="Environment">
        <SliderControl label="Temperature" unit="°C"
          value={store.envTemperature - 273.15} min={-20} max={80} step={0.1}
          onChange={(v) => setParam('envTemperature', v + 273.15)} formatValue={(v) => v.toFixed(1)} />
        <NumberRow label="Pressure" unit="kPa" value={store.envPressure} paramKey="envPressure" convert={1e3} precision={1} />
        <SliderControl label="Humidity" unit="%"
          value={store.envHumidity * 100} min={0} max={100} step={1}
          onChange={(v) => setParam('envHumidity', v / 100)} formatValue={(v) => v.toFixed(0)} />
        <NumberRow label="n (medium)" unit="" value={store.envRefractiveIndex} paramKey="envRefractiveIndex" precision={6} />
        <div style={{ marginBottom: 8 }}>
          <label className="label-nano" style={{ display: 'block', marginBottom: 6 }}>Mount Material</label>
          <select value={store.mountMaterial} onChange={(e) => setParam('mountMaterial', e.target.value)} style={{ width: '100%' }}>
            {MOUNT_MATERIALS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <Toggle label="Thermal Drift" paramKey="thermalDriftEnabled" />
      </Section>

      {/* ===== NOISE / VIBRATION ===== */}
      <Section title="Noise Sources" defaultOpen={false}>
        <Toggle label="Phase Noise" paramKey="phaseNoiseEnabled" />
        <Toggle label="Seismic Vibration" paramKey="seismicNoiseEnabled" />
        <Toggle label="Shot Noise" paramKey="shotNoiseEnabled" />
        <SliderControl label="Seismic Amp" unit="nm"
          value={store.seismicAmplitude * 1e9} min={0} max={100} step={0.1}
          onChange={(v) => setParam('seismicAmplitude', v * 1e-9)} formatValue={(v) => v.toFixed(1)} />
        <SliderControl label="Seismic Freq" unit="Hz"
          value={store.seismicFrequency} min={0.1} max={100} step={0.1}
          onChange={(v) => setParam('seismicFrequency', v)} formatValue={(v) => v.toFixed(1)} />
        <NumberRow label="Acoustic Noise" unit="μPa/√Hz" value={store.acousticNoiseDensity} paramKey="acousticNoiseDensity" convert={1e-6} precision={2} />
      </Section>

      {/* ===== DETECTOR ===== */}
      <Section title="Detector" defaultOpen={false}>
        <SliderControl label="QE (η)" unit="%"
          value={store.detectorQE * 100} min={0} max={100} step={0.1}
          onChange={(v) => setParam('detectorQE', v / 100)} formatValue={(v) => v.toFixed(1)} />
        <NumberRow label="Dark Current" unit="e⁻/px/s" value={store.detectorDarkCurrent} paramKey="detectorDarkCurrent" precision={2} />
        <NumberRow label="Read Noise" unit="e⁻ RMS" value={store.detectorReadNoise} paramKey="detectorReadNoise" precision={1} />
        <NumberRow label="Pixel Pitch" unit="μm" value={store.detectorPixelPitch} paramKey="detectorPixelPitch" convert={1e-6} precision={1} />
        <SliderControl label="Exposure" unit="ms"
          value={store.detectorExposureTime * 1e3} min={0.1} max={1000} step={0.1}
          onChange={(v) => setParam('detectorExposureTime', v * 1e-3)} formatValue={(v) => v.toFixed(1)} />
        <div style={{ marginBottom: 8 }}>
          <label className="label-nano" style={{ display: 'block', marginBottom: 6 }}>Array Size</label>
          <select value={store.detectorArrayWidth} onChange={(e) => { setParam('detectorArrayWidth', parseInt(e.target.value)); setParam('detectorArrayHeight', parseInt(e.target.value)); }} style={{ width: '100%' }}>
            <option value={64}>64×64</option>
            <option value={128}>128×128</option>
            <option value={256}>256×256</option>
            <option value={512}>512×512</option>
          </select>
        </div>
      </Section>

      {/* ===== QUANTUM ===== */}
      <Section title="Quantum Effects" defaultOpen={false}>
        <SliderControl label="Squeezing (r)" unit=""
          value={store.squeezingParam} min={0} max={3} step={0.01}
          onChange={(v) => setParam('squeezingParam', v)} formatValue={(v) => v.toFixed(2)} />
        <SliderControl label="Squeeze Angle" unit="°"
          value={store.squeezingAngle * 180 / Math.PI} min={0} max={360} step={1}
          onChange={(v) => setParam('squeezingAngle', v * Math.PI / 180)} formatValue={(v) => v.toFixed(0)} />
      </Section>

      {/* ===== GRAVITATIONAL WAVES ===== */}
      <Section title="Gravitational Waves" defaultOpen={false}>
        <Toggle label="GW Injection" paramKey="gwEnabled" />
        <SliderControl label="Strain h₀" unit=""
          value={Math.log10(store.gwStrain)} min={-25} max={-15} step={0.1}
          onChange={(v) => setParam('gwStrain', Math.pow(10, v))} formatValue={(v) => `10^${v.toFixed(1)}`} />
        <SliderControl label="Frequency" unit="Hz"
          value={store.gwFrequency} min={10} max={5000} step={1}
          onChange={(v) => setParam('gwFrequency', v)} formatValue={(v) => v.toFixed(0)} />
        <div style={{ marginBottom: 8 }}>
          <label className="label-nano" style={{ display: 'block', marginBottom: 6 }}>Polarization</label>
          <select value={store.gwPolarization} onChange={(e) => setParam('gwPolarization', e.target.value)} style={{ width: '100%' }}>
            <option value="plus">h+ (Plus)</option>
            <option value="cross">h× (Cross)</option>
          </select>
        </div>
      </Section>
    </>
  );
};

export default ResearchPanel;
