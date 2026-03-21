import React, { useRef, useEffect } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { computeOPD } from '../store/simulationStore.js';
import { fringeVisibility } from '../physics/coherenceModel.js';
import { wavelengthToColor } from '../physics/basicInterference.js';

/**
 * Detector Intensity I(t) — Live oscilloscope trace
 *
 * Reads the actual physics state every frame via computeOPD(),
 * and plots the real detector intensity synced to the simulation.
 *
 * Left:  real circular interferogram (pixel-by-pixel from OPD + tilt)
 * Right: scrolling time series of I(t) — exactly what the detector sees
 *
 * The graph is synced to the simulation: it only advances when parameters
 * change (via Animate buttons, slider dragging, or noise perturbations).
 * When nothing changes, the line stays flat — which is physically correct.
 *
 * Zero placeholder data. Every value is computed from real simulation state.
 */

const HISTORY_LEN = 240;

// Exponential moving average for smooth, anti-aliased trace
const EMA_ALPHA = 0.15;

const FringeExtrapolation = () => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const historyRef = useRef(new Float64Array(HISTORY_LEN).fill(0.5));
  const writeIdx = useRef(0);
  const frameCount = useRef(0);
  const lastOPD = useRef(null);
  const smoothedI = useRef(0.5);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let raf;
    let running = true;

    const draw = () => {
      if (!running) return;
      raf = requestAnimationFrame(draw);

      const st = useSimulationStore.getState();
      if (st.simulationPaused) return;

      const W = container.clientWidth;
      const H = container.clientHeight;
      if (W < 20 || H < 20) return;

      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }

      frameCount.current++;
      const ctx = canvas.getContext('2d');

      // ── REAL PHYSICS: compute current detector intensity ──
      const opdResult = computeOPD(st);
      const opd = opdResult.opd;
      const k = (2 * Math.PI) / st.wavelength;
      const V = fringeVisibility(opd, st.laserLinewidth);
      const tiltRad = opdResult.tiltRad || 0;

      // Use the correct phase for each interferometer type
      let totalPhase;
      if (st.interferometerType === 'sagnac' && opdResult.sagnacPhase != null) {
        // Sagnac: rotational phase from the Sagnac effect
        totalPhase = opdResult.sagnacPhase;
      } else if (st.interferometerType === 'mzi') {
        // MZI: include user phase shifters
        totalPhase = k * opd + (st.phaseShift1 || 0) - (st.phaseShift2 || 0);
      } else {
        // Michelson: standard OPD phase
        totalPhase = k * opd;
      }

      // Central intensity: I = ½(1 + V·cos(phase))
      const I_raw = 0.5 * (1 + V * Math.cos(totalPhase));

      // Anti-alias: exponential moving average to sync graph speed
      // to the rate parameters actually change (prevents aliased noise)
      smoothedI.current = EMA_ALPHA * I_raw + (1 - EMA_ALPHA) * smoothedI.current;
      const I_center = smoothedI.current;

      // Initialize on first frame
      if (lastOPD.current === null) {
        lastOPD.current = opd;
        smoothedI.current = I_raw;
        historyRef.current.fill(I_raw);
      }
      lastOPD.current = opd;

      // Push to rolling buffer every 4 frames (~15 Hz — keeps the graph
      // in sync with human-visible simulation speed, not 60fps noise)
      if (frameCount.current % 4 === 0) {
        historyRef.current[writeIdx.current % HISTORY_LEN] = I_center;
        writeIdx.current++;
      }

      // ── LAYOUT ──
      const genSize = Math.min(H - 16, W * 0.28);
      const genCX = 8 + genSize / 2;
      const genCY = H / 2;
      const genR = genSize / 2 - 4;

      const graphL = genSize + 24;
      const graphR = W - 8;
      const graphW = graphR - graphL;
      const graphT = 10;
      const graphB = H - 18;
      const graphH = graphB - graphT;

      // ── CLEAR ──
      ctx.clearRect(0, 0, W, H);

      // ── WAVELENGTH COLOR ──
      // wavelengthToColor takes wavelength in SI meters, returns hex string
      const wlHex = wavelengthToColor(st.wavelength);
      // Parse hex to RGB for canvas operations
      const hexR = parseInt(wlHex.slice(1, 3), 16);
      const hexG = parseInt(wlHex.slice(3, 5), 16);
      const hexB = parseInt(wlHex.slice(5, 7), 16);
      // Use wavelength color for the wave trace; interferogram uses type colors
      const waveR = hexR, waveG = hexG, waveB = hexB;

      // ── 1. GENERATOR: Real circular fringe pattern ──
      ctx.save();
      ctx.beginPath();
      ctx.arc(genCX, genCY, genR, 0, Math.PI * 2);
      ctx.clip();

      const imgSize = Math.ceil(genR * 2);
      if (imgSize > 2) {
        const step = 2;
        const detectorSize = 0.01; // 10 mm detector aperture
        const scale = detectorSize / imgSize;

        for (let py = 0; py < imgSize; py += step) {
          for (let px = 0; px < imgSize; px += step) {
            const dx = px - imgSize / 2;
            const dy = py - imgSize / 2;
            const rPx = Math.sqrt(dx * dx + dy * dy);
            if (rPx > imgSize / 2) continue;

            const xMeters = dx * scale;
            const yMeters = dy * scale;
            const rMeters = Math.sqrt(xMeters * xMeters + yMeters * yMeters);

            const tiltPhase = k * (opdResult.tiltFactor || 0) * tiltRad * xMeters;
            const curvature = st.interferometerType === 'michelson'
              ? k * rMeters * rMeters / (st.mirrorCurvature || 10)
              : 0;

            const pixelPhase = totalPhase + tiltPhase + curvature;
            const pixelI = 0.5 * (1 + V * Math.cos(pixelPhase));

            // Type-specific colors for the interferogram disc
            let r, g, b;
            if (st.interferometerType === 'michelson') {
              r = Math.round(pixelI * 57);
              g = Math.round(pixelI * 255);
              b = Math.round(pixelI * 20);
            } else if (st.interferometerType === 'sagnac') {
              r = Math.round(pixelI * 255);
              g = Math.round(pixelI * 180);
              b = Math.round(pixelI * 50);
            } else {
              r = Math.round(pixelI * 79);
              g = Math.round(pixelI * 200);
              b = Math.round(pixelI * 249);
            }

            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(
              genCX - genR + px,
              genCY - genR + py,
              step, step
            );
          }
        }
      }

      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(genCX, genCY, genR, 0, Math.PI * 2);
      ctx.stroke();

      // ── Connecting line from generator to graph ──
      const currentY = graphB - I_center * graphH;
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.moveTo(genCX + genR + 2, genCY);
      ctx.lineTo(graphL, currentY);
      ctx.stroke();
      ctx.setLineDash([]);

      // ── 2. SWEEPING GRAPH ──

      // Y-axis grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = graphT + (i / 4) * graphH;
        ctx.beginPath();
        ctx.moveTo(graphL, y);
        ctx.lineTo(graphR, y);
        ctx.stroke();
      }

      // Y-axis labels
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '7px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('1.0', graphL - 3, graphT + 3);
      ctx.fillText('0.5', graphL - 3, graphT + graphH / 2 + 3);
      ctx.fillText('0.0', graphL - 3, graphB + 3);

      // X-axis label
      ctx.textAlign = 'center';
      ctx.fillText('t →', graphL + graphW / 2, graphB + 12);

      // Y-axis label
      ctx.save();
      ctx.translate(graphL - 14, graphT + graphH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText('I(t)', 0, 0);
      ctx.restore();

      // Draw filled area under curve
      ctx.beginPath();
      const readStart = writeIdx.current;
      for (let i = 0; i < HISTORY_LEN; i++) {
        const idx = (readStart + i) % HISTORY_LEN;
        const val = historyRef.current[idx];
        const x = graphL + (i / (HISTORY_LEN - 1)) * graphW;
        const y = graphB - val * graphH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(graphR, graphB);
      ctx.lineTo(graphL, graphB);
      ctx.closePath();
      const fillGrad = ctx.createLinearGradient(0, graphT, 0, graphB);
      fillGrad.addColorStop(0, `rgba(${waveR},${waveG},${waveB},0.15)`);
      fillGrad.addColorStop(1, `rgba(${waveR},${waveG},${waveB},0.0)`);
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // Draw the wave line on top
      ctx.beginPath();
      for (let i = 0; i < HISTORY_LEN; i++) {
        const idx = (readStart + i) % HISTORY_LEN;
        const val = historyRef.current[idx];
        const x = graphL + (i / (HISTORY_LEN - 1)) * graphW;
        const y = graphB - val * graphH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${waveR},${waveG},${waveB},0.85)`;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();

      // Glow line
      ctx.beginPath();
      for (let i = 0; i < HISTORY_LEN; i++) {
        const idx = (readStart + i) % HISTORY_LEN;
        const val = historyRef.current[idx];
        const x = graphL + (i / (HISTORY_LEN - 1)) * graphW;
        const y = graphB - val * graphH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${waveR},${waveG},${waveB},0.15)`;
      ctx.lineWidth = 5;
      ctx.stroke();

      // Leading edge dot
      const lastIdx = (readStart + HISTORY_LEN - 1) % HISTORY_LEN;
      const lastVal = historyRef.current[lastIdx];
      const dotX = graphR;
      const dotY = graphB - lastVal * graphH;
      ctx.fillStyle = `rgba(${waveR},${waveG},${waveB},1)`;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${waveR},${waveG},${waveB},0.3)`;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Current value label
      ctx.fillStyle = `rgba(${waveR},${waveG},${waveB},0.9)`;
      ctx.font = '600 8px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`I=${lastVal.toFixed(4)}`, dotX - graphW * 0.18, graphT + 8);
    };

    raf = requestAnimationFrame(draw);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, []);

  // Equation label
  const type = useSimulationStore((s) => s.interferometerType);
  let eq;
  if (type === 'michelson') {
    eq = 'I = ½(1 + V·cos(2k·Δd))  |  Δd = gas OPD + mirror OPD';
  } else if (type === 'sagnac') {
    eq = 'I = ½(1 + V·cos(4πNAΩ / cλ))  |  Sagnac effect';
  } else {
    eq = 'I = ½(1 + V·cos(Δφ₁₂))  |  Δφ = k·OPD + phase shifts';
  }

  return (
    <div className="glass-card" style={{
      flex: 0.85, minWidth: 300, borderRadius: 'var(--radius-high)',
      padding: '12px 14px 8px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 className="label-micro" style={{ letterSpacing: '0.2em', margin: 0 }}>
          Detector Intensity I(t)
        </h4>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)' }}>
          LIVE
        </span>
      </div>

      <div ref={containerRef} style={{ flex: 1, minHeight: 60, position: 'relative' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      <div style={{
        fontSize: 8, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)',
        textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingTop: 4, lineHeight: 1.4,
      }}>
        {eq}
      </div>
    </div>
  );
};

export default FringeExtrapolation;
