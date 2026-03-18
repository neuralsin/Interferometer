import React, { useRef, useEffect } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { generateFringePattern, wavelengthToColor } from '../physics/basicInterference.js';

/** Reusable V3-styled slider row */
export const SliderControl = ({ label, unit, value, min, max, step, onChange, formatValue }) => {
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

/**
 * Beginner Panel — V3 unified_beginner_mode right sidebar
 * Interferogram canvas (real fringes from basicInterference.js) + Simulation Analysis
 */
const BeginnerPanel = () => {
  const wavelength = useSimulationStore((s) => s.wavelength);
  const mirror1PosX = useSimulationStore((s) => s.mirror1PosX);
  const mirror2PosZ = useSimulationStore((s) => s.mirror2PosZ);
  const mirror1Tip = useSimulationStore((s) => s.mirror1Tip);
  const mirror2Tip = useSimulationStore((s) => s.mirror2Tip);
  const laserLinewidth = useSimulationStore((s) => s.laserLinewidth);
  const interferometerType = useSimulationStore((s) => s.interferometerType);
  const canvasRef = useRef(null);

  const armX = Math.sqrt(mirror1PosX ** 2);
  const armY = Math.abs(mirror2PosZ);
  const opd = 2 * (armX - armY);

  // Render real fringe pattern from physics engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      const size = Math.min(canvas.offsetWidth, canvas.offsetHeight);
      canvas.width = size * 2;
      canvas.height = size * 2;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Real physics: generate fringe data
      const resolution = 128;
      const fringeData = generateFringePattern({
        wavelength,
        opdCenter: opd,
        tiltX: mirror1Tip,
        tiltY: mirror2Tip,
        resolution,
        detectorSize: 0.01,
        linewidth: laserLinewidth,
      });

      // Color from wavelength
      const color = wavelengthToColor(wavelength);
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      // Draw as circular clipped pattern
      const radius = Math.min(cx, cy) * 0.85;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      const pixelSize = (radius * 2) / resolution;
      for (let j = 0; j < resolution; j++) {
        for (let i = 0; i < resolution; i++) {
          const intensity = fringeData[j * resolution + i];
          const alpha = intensity * 0.9 + 0.1;
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          const px = cx - radius + i * pixelSize;
          const py = cy - radius + j * pixelSize;
          ctx.fillRect(px, py, pixelSize + 0.5, pixelSize + 0.5);
        }
      }

      // Subtle ring guides
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;
      for (let ri = 0.25; ri <= 1; ri += 0.25) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * ri, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Dashed border ring
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    draw();
    const obs = new ResizeObserver(draw);
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [wavelength, opd, mirror1Tip, mirror2Tip]);

  return (
    <>
      {/* Interferogram */}
      <div>
        <h3 className="label-section" style={{ marginBottom: 16, letterSpacing: '0.2em' }}>
          Interferogram
        </h3>
        <div style={{
          borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.05)', padding: 16,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <canvas ref={canvasRef} style={{ width: '100%', aspectRatio: '1/1', maxWidth: 280, borderRadius: '50%' }} />
          <p style={{
            fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 16, textAlign: 'center',
          }}>
            Detector Output Stream
          </p>
        </div>
      </div>

      {/* Simulation Analysis — type-aware */}
      <div>
        <h3 className="label-section" style={{ marginBottom: 16, letterSpacing: '0.2em' }}>
          Simulation Analysis
        </h3>
        <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-mercury)' }}>
          {interferometerType === 'michelson' ? (
            <>
              <p style={{ marginBottom: 12, textAlign: 'justify', opacity: 0.8 }}>
                In a <strong style={{ color: '#fff' }}>Michelson interferometer</strong>, a beam
                splitter divides the laser into two perpendicular arms.
                One arm passes through a gas cell with refractive index <strong style={{ color: '#fff' }}>n</strong>,
                modifying the optical path before recombination at the detector.
              </p>
              <div style={{
                fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.03)',
                padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)',
                textAlign: 'center', color: '#fff', marginBottom: 12,
              }}>
                I = I₀cos²(πΔ/λ)
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.03)',
                padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)',
                textAlign: 'center', color: '#fff', marginBottom: 16,
              }}>
                Δ = 2(n-1)Lc + 2Δd
              </div>
            </>
          ) : interferometerType === 'sagnac' ? (
            <>
              <p style={{ marginBottom: 12, textAlign: 'justify', opacity: 0.8 }}>
                The <strong style={{ color: '#fff' }}>Sagnac interferometer</strong> detects rotation
                by splitting light into CW and CCW beams traversing a loop.
                Rotation causes a <strong style={{ color: '#fff' }}>fringe shift</strong> proportional
                to the angular velocity and enclosed area.
              </p>
              <div style={{
                fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.03)',
                padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)',
                textAlign: 'center', color: '#fff', marginBottom: 12,
              }}>
                Δt = 4AΩ/c²
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.03)',
                padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)',
                textAlign: 'center', color: '#fff', marginBottom: 16,
              }}>
                ΔN = 4AΩ/(cλ)
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
          <div style={{ fontSize: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', marginTop: 4, flexShrink: 0 }} />
              <p><span style={{ color: '#fff', fontWeight: 700, textTransform: 'uppercase' }}>Constructive:</span> Maximum intensity when path differential is a multiple of λ.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.4)', marginTop: 4, flexShrink: 0 }} />
              <p><span style={{ color: '#fff', fontWeight: 700, textTransform: 'uppercase' }}>Destructive:</span> Phase cancellation at half-multiples of λ.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recalibrate */}
      <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: '14px 0', marginTop: 'auto' }}
        onClick={() => useSimulationStore.getState().resetToDefaults()}>
        Recalibrate System
      </button>
    </>
  );
};

export default BeginnerPanel;
