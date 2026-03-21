import React, { useRef, useEffect } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { computeOPD } from '../store/simulationStore.js';
import { fringeVisibility } from '../physics/coherenceModel.js';
import { wavelengthToColor } from '../physics/basicInterference.js';

/**
 * Detector Intensity I(t) — Live oscilloscope trace
 *
 * Reads physics state every frame and plots the real detector intensity.
 * For Michelson: reads 60fps animation values via window._michelsonAnim
 * for perfectly smooth traces (no staircase aliasing).
 * For MZI: also tracks photon detection ratios from simD1/simD2.
 * For Sagnac: reads sagnacPhase for exact rotational mapping.
 *
 * Left:  wavelength-colored circular interferogram
 * Right: scrolling time series of I(t)
 */

const HISTORY_LEN = 240;

const FringeExtrapolation = () => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const historyRef = useRef(new Float64Array(HISTORY_LEN).fill(0.5));
  const writeIdx = useRef(0);
  const frameCount = useRef(0);
  const initialised = useRef(false);
  const lastSimFired = useRef(0); // track MZI photon events

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

      // ── BUILD A LOCAL COPY OF STATE WITH LIVE ANIMATION VALUES ──
      // This lets us compute physics at 60fps without waiting for the
      // 10Hz React store push, eliminating the staircase pattern.
      let localState = st;
      const anim = window._michelsonAnim;
      if (anim && st.interferometerType === 'michelson') {
        // Override the animated parameter with the live 60fps value
        const override = {};
        if (anim.mode === 'p') override.gasCellPressure = anim.val;
        else if (anim.mode === 't') override.mirrorTilt = anim.val;
        else if (anim.mode === 'm') override.mirrorDisplacement = anim.val;
        localState = { ...st, ...override };
      }

      // ── REAL PHYSICS ──
      const opdResult = computeOPD(localState);
      const opd = opdResult.opd;
      const k = (2 * Math.PI) / localState.wavelength;
      const V = fringeVisibility(opd, localState.laserLinewidth);
      const tiltRad = opdResult.tiltRad || 0;

      // Correct phase per interferometer type
      let totalPhase;
      if (st.interferometerType === 'sagnac' && opdResult.sagnacPhase != null) {
        totalPhase = opdResult.sagnacPhase;
      } else if (st.interferometerType === 'mzi') {
        totalPhase = k * opd + (st.phaseShift1 || 0) - (st.phaseShift2 || 0);
      } else {
        totalPhase = k * opd;
      }

      // Central intensity
      const I_center = 0.5 * (1 + V * Math.cos(totalPhase));

      // Init buffer on first frame
      if (!initialised.current) {
        initialised.current = true;
        historyRef.current.fill(I_center);
      }

      // ── PUSH TO HISTORY ──
      // For MZI: also push when photons are fired (detected)
      let shouldPush = (frameCount.current % 2 === 0); // 30Hz baseline

      if (st.interferometerType === 'mzi' && st.simFired > lastSimFired.current) {
        // New photons were detected — push the measured ratio
        shouldPush = true;
        lastSimFired.current = st.simFired;
      }

      if (shouldPush) {
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
      const wlHex = wavelengthToColor(st.wavelength);
      const hexR = parseInt(wlHex.slice(1, 3), 16);
      const hexG = parseInt(wlHex.slice(3, 5), 16);
      const hexB = parseInt(wlHex.slice(5, 7), 16);

      // ── 1. INTERFEROGRAM DISC — wavelength-colored ──
      ctx.save();
      ctx.beginPath();
      ctx.arc(genCX, genCY, genR, 0, Math.PI * 2);
      ctx.clip();

      const imgSize = Math.ceil(genR * 2);
      if (imgSize > 2) {
        const step = 2;
        const detectorSize = 0.01;
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

            // Wavelength-synced: bright fringe = laser color, dark = black
            const r = Math.round(pixelI * hexR);
            const g = Math.round(pixelI * hexG);
            const b = Math.round(pixelI * hexB);

            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(genCX - genR + px, genCY - genR + py, step, step);
          }
        }
      }

      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(genCX, genCY, genR, 0, Math.PI * 2);
      ctx.stroke();

      // ── Connecting line ──
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

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = graphT + (i / 4) * graphH;
        ctx.beginPath();
        ctx.moveTo(graphL, y);
        ctx.lineTo(graphR, y);
        ctx.stroke();
      }

      // Y labels
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '7px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('1.0', graphL - 3, graphT + 3);
      ctx.fillText('0.5', graphL - 3, graphT + graphH / 2 + 3);
      ctx.fillText('0.0', graphL - 3, graphB + 3);

      ctx.textAlign = 'center';
      ctx.fillText('t →', graphL + graphW / 2, graphB + 12);

      ctx.save();
      ctx.translate(graphL - 14, graphT + graphH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText('I(t)', 0, 0);
      ctx.restore();

      // Wave trace — wavelength color
      const wR = hexR, wG = hexG, wB = hexB;

      // Filled area
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
      fillGrad.addColorStop(0, `rgba(${wR},${wG},${wB},0.15)`);
      fillGrad.addColorStop(1, `rgba(${wR},${wG},${wB},0.0)`);
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // Line
      ctx.beginPath();
      for (let i = 0; i < HISTORY_LEN; i++) {
        const idx = (readStart + i) % HISTORY_LEN;
        const val = historyRef.current[idx];
        const x = graphL + (i / (HISTORY_LEN - 1)) * graphW;
        const y = graphB - val * graphH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${wR},${wG},${wB},0.85)`;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();

      // Glow
      ctx.beginPath();
      for (let i = 0; i < HISTORY_LEN; i++) {
        const idx = (readStart + i) % HISTORY_LEN;
        const val = historyRef.current[idx];
        const x = graphL + (i / (HISTORY_LEN - 1)) * graphW;
        const y = graphB - val * graphH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${wR},${wG},${wB},0.15)`;
      ctx.lineWidth = 5;
      ctx.stroke();

      // Leading dot
      const lastIdx = (readStart + HISTORY_LEN - 1) % HISTORY_LEN;
      const lastVal = historyRef.current[lastIdx];
      const dotX = graphR;
      const dotY = graphB - lastVal * graphH;
      ctx.fillStyle = `rgba(${wR},${wG},${wB},1)`;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${wR},${wG},${wB},0.3)`;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Value label
      ctx.fillStyle = `rgba(${wR},${wG},${wB},0.9)`;
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
