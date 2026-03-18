import React, { useRef, useEffect, useState, useCallback } from 'react';
import useSimulationStore from '../store/simulationStore.js';

/**
 * MichelsonScene — Classic Michelson Interferometer
 *
 * Single-canvas layout:
 *   Laser → BS → M1 (top arm, fixed)
 *               → Gas Cell → M2 (right arm, movable)
 *   Recombined → Detector (bottom)
 *
 * ALL values driven by real physics from store.
 * The circular interferogram is rendered in the sidebar (BeginnerPanel).
 * This canvas shows the optical layout with real wave propagation.
 */

const GAS_DATA = {
  air: { n0: 293e-6, color: [55, 138, 221], label: 'Air' },
  he:  { n0: 35e-6,  color: [29, 158, 117], label: 'Helium' },
  ar:  { n0: 281e-6, color: [216, 90, 48],  label: 'Argon' },
};

function lambdaToRGB(nm) {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = (440 - nm) / 60; b = 1; }
  else if (nm >= 440 && nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm >= 490 && nm < 510) { g = 1; b = (510 - nm) / 20; }
  else if (nm >= 510 && nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm >= 580 && nm < 645) { r = 1; g = (645 - nm) / 65; }
  else if (nm >= 645 && nm <= 750) { r = 1; }
  const f = nm < 420 ? 0.3 + 0.7 * (nm - 380) / 40 : nm > 700 ? 0.3 + 0.7 * (750 - nm) / 50 : 1;
  return [Math.round(r * f * 255), Math.round(g * f * 255), Math.round(b * f * 255)];
}

const MichelsonScene = () => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const waveTRef = useRef(0);
  // photon particle: progresses 0→1 along the beam path, then resets
  const photonRef = useRef({ t: 0, arm: 0 }); // arm 0=M1, arm 1=M2
  const paramAnimRef = useRef({ active: false, mode: '', val: 0, dir: 1 });
  const [wavesOn, setWavesOn] = useState(true);
  const [animMode, setAnimMode] = useState('');

  // Slow toggle: step constants are 20x slower than original
  const ANIM_STEP = { p: 0.0006, t: 0.00015, m: 0.005 };

  const toggleParamAnim = useCallback((mode) => {
    const pa = paramAnimRef.current;
    if (pa.active && pa.mode === mode) {
      pa.active = false; pa.mode = '';
      setAnimMode('');
    } else {
      pa.active = true; pa.mode = mode; pa.dir = 1;
      const st = useSimulationStore.getState();
      if (mode === 'p') pa.val = st.gasCellPressure;
      else if (mode === 't') pa.val = st.mirrorTilt;
      else { pa.val = st.mirrorDisplacement; }
      setAnimMode(mode);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    let raf;
    let running = true;
    let lastTs = null;

    const animate = (ts) => {
      if (!running) return;
      raf = requestAnimationFrame(animate);
      if (!lastTs) lastTs = ts;
      const dtMs = Math.min(50, ts - lastTs);
      lastTs = ts;
      const dtS = dtMs / 1000;

      const st = useSimulationStore.getState();
      if (st.simulationPaused) return;

      const W = container.clientWidth;
      const H = container.clientHeight;
      if (W < 10 || H < 10) return;

      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W; canvas.height = H;
      }

      // waveT: moves at waveAnimSpeed * realtime (not per frame!)
      waveTRef.current += dtS * st.waveAnimSpeed * 4;
      const waveT = waveTRef.current;

      // Parameter animation — slow increments each second
      const pa = paramAnimRef.current;
      if (pa.active) {
        if (pa.mode === 'p') {
          pa.val = Math.max(0.1, Math.min(10, pa.val + ANIM_STEP.p * dtMs));
          if (pa.val >= 10) pa.val = 0.1;
          st.setParam('gasCellPressure', parseFloat(pa.val.toFixed(4)));
        } else if (pa.mode === 't') {
          pa.val = Math.max(0, Math.min(5, pa.val + ANIM_STEP.t * dtMs));
          if (pa.val >= 5) pa.val = 0;
          st.setParam('mirrorTilt', parseFloat(pa.val.toFixed(4)));
        } else if (pa.mode === 'm') {
          pa.val += ANIM_STEP.m * dtMs * pa.dir;
          if (pa.val >= 50) { pa.val = 50; pa.dir = -1; }
          if (pa.val <= -50) { pa.val = -50; pa.dir = 1; }
          st.setParam('mirrorDisplacement', parseFloat(pa.val.toFixed(3)));
        }
      }

      const ctx = canvas.getContext('2d');
      const W2 = W, H2 = H;

      // Read physics state
      const gas = GAS_DATA[st.gasCellGas] || GAS_DATA.air;
      const nM = gas.n0 * st.gasCellPressure;
      const nVal = 1 + nM;
      const lamVal = st.wavelength;
      const lamNm = lamVal * 1e9;
      const [clr, clg, clb] = lambdaToRGB(lamNm);
      const [cgr, cgg, cgb] = gas.color;
      const tiltVal = st.mirrorTilt;       // mrad
      const mirPos = st.mirrorDisplacement * 1e-6; // m
      const baseSpeed = st.waveAnimSpeed;
      const gasSpeed = baseSpeed / nVal;
      const AMP = st.waveAnimAmplitude;
      const powerFactor = Math.min(1, st.laserPower / 5e-3);

      // === Real physics OPD ===
      const gOPD = 2 * (nVal - 1) * st.gasCellLength; // gas cell contribution
      const mOPD = 2 * mirPos;                          // mirror displacement
      const tOPD = gOPD + mOPD;
      const phTotal = (2 * Math.PI / lamVal) * tOPD;
      const phMod = ((phTotal % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      // I = I₀cos²(Δφ/2)  — intensity at detector
      const intensity = Math.cos(phMod / 2) ** 2;
      const isC = intensity > 0.5;

      // Component positions (scale with canvas)
      const bsX = Math.round(W2 * 0.38), bsY = Math.round(H2 * 0.50);
      const laserX = 18, laserY = bsY;
      const m1Y = 20, m1X = bsX;
      const m2BaseX = W2 - 56;
      const m2X = Math.round(m2BaseX + Math.min(Math.max(mirPos * 1e6 * 0.4, -30), 30));
      const m2Y = bsY;
      const detX = bsX, detY = H2 - 20;
      const gasBoxX = bsX + 28, gasBoxY = bsY - 12;
      const gasBoxW = Math.max(30, Math.min(90, st.gasCellLength * 700));
      const gEnd = gasBoxX + gasBoxW;
      const phMir = (2 * Math.PI / lamVal) * mOPD; // mirror phase contribution

      // ── Clear canvas ──
      ctx.clearRect(0, 0, W2, H2);
      ctx.fillStyle = 'rgba(5,5,5,0.97)';
      ctx.fillRect(0, 0, W2, H2);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.018)';
      ctx.lineWidth = 0.5;
      for (let gx = 0; gx < W2; gx += 30) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H2); ctx.stroke(); }
      for (let gy = 0; gy < H2; gy += 30) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W2, gy); ctx.stroke(); }

      // ── Gas cell box ──
      ctx.fillStyle = `rgba(${cgr},${cgg},${cgb},0.06)`;
      ctx.strokeStyle = `rgba(${cgr},${cgg},${cgb},0.28)`;
      ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
      ctx.fillRect(gasBoxX, gasBoxY, gasBoxW, 24);
      ctx.strokeRect(gasBoxX, gasBoxY, gasBoxW, 24);
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(${cgr},${cgg},${cgb},0.75)`;
      ctx.font = '500 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(gas.label, gasBoxX + gasBoxW / 2, gasBoxY + 15);
      ctx.font = '7px monospace';
      ctx.fillStyle = `rgba(${cgr},${cgg},${cgb},0.55)`;
      ctx.fillText(`v=c/${nVal.toFixed(4)}`, gasBoxX + gasBoxW / 2, gasBoxY - 4);

      // ── Halo helper ──
      const drawHalo = (x, y, isConst, radius, alpha) => {
        const g2 = ctx.createRadialGradient(x, y, 0, x, y, radius);
        const [hr, hg, hb] = isConst ? [255, 230, 60] : [57, 255, 20];
        g2.addColorStop(0, `rgba(${hr},${hg},${hb},${alpha})`);
        g2.addColorStop(1, `rgba(${hr},${hg},${hb},0)`);
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      };

      // Arm halo intensity
      const m1On = st.m1Enabled !== false;
      const m2On = st.m2Enabled !== false;
      const m1Pulse = (Math.sin(waveT * 1.5 + 3.1 + phMir) + 1) / 2;
      const m2Pulse = (Math.sin(waveT * 1.5 + phMir) + 1) / 2;
      if (m1On) drawHalo(m1X, m1Y + 12, true, 28, 0.12 + m1Pulse * 0.3 * powerFactor);
      if (m2On) drawHalo(m2X, m2Y, isC, 30, 0.1 + m2Pulse * 0.35 * powerFactor);
      // Detector halo — intensity-driven (not per-frame random)
      drawHalo(detX, detY - 8, isC, 28 + intensity * 12, (0.2 + intensity * 0.5) * powerFactor);

      // ── Wave drawing helper ──
      const drawWave = (x1, y1, x2, y2, phOff, wr, wg, wb, alpha, spd, amp) => {
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
        if (len < 2) return;
        const ux = dx / len, uy = dy / len, px = -uy, py = ux;
        const freq = 0.065;
        ctx.beginPath();
        for (let i = 0; i <= len; i += 1.5) {
          const w = Math.sin(i * freq - waveT * spd + phOff) * amp * powerFactor;
          if (i === 0) ctx.moveTo(x1 + ux * i + px * w, y1 + uy * i + py * w);
          else ctx.lineTo(x1 + ux * i + px * w, y1 + uy * i + py * w);
        }
        ctx.strokeStyle = `rgba(${wr},${wg},${wb},${alpha * powerFactor})`;
        ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
      };

      if (wavesOn) {
        // Laser → BS
        drawWave(laserX + 32, laserY, bsX - 8, bsY, 0, clr, clg, clb, 0.9, baseSpeed, AMP);
        // BS → M1 (up arm)
        if (m1On) {
          drawWave(bsX, bsY - 8, bsX, m1Y + 22, 1.1, clr, clg, clb, 0.8, baseSpeed, AMP);
          drawWave(bsX, m1Y + 22, bsX, bsY - 8, 3.1 + phMir * 0.5, clr, clg, clb, 0.65, baseSpeed, AMP);
        }
        // BS → Gas → M2 → Gas → BS (right arm)
        if (m2On) {
          drawWave(bsX + 8, bsY, gasBoxX, bsY, 1.6, clr, clg, clb, 0.8, baseSpeed, AMP);
          drawWave(gasBoxX, bsY, gEnd, bsY, 1.6, cgr, cgg, cgb, 0.8, gasSpeed, AMP * 0.72);
          drawWave(gEnd, bsY, m2X - 12, bsY, 1.6, clr, clg, clb, 0.8, baseSpeed, AMP);
          // Return trip
          drawWave(m2X - 12, bsY, gEnd, bsY, 3.1 + phMir, clr, clg, clb, 0.55, baseSpeed, AMP);
          drawWave(gEnd, bsY, gasBoxX, bsY, 3.1 + phMir, cgr, cgg, cgb, 0.55, gasSpeed, AMP * 0.72);
          drawWave(gasBoxX, bsY, bsX + 8, bsY, 3.1 + phMir, clr, clg, clb, 0.55, baseSpeed, AMP);
        }
        // Recombined → Detector  (amplitude = intensity from real OPD)
        const recR = Math.round((clr + cgr) / 2), recG = Math.round((clg + cgg) / 2), recB = Math.round((clb + cgb) / 2);
        const recAlpha = 0.35 + intensity * 0.55;
        const recAmp = AMP * (0.3 + intensity * 0.8);
        drawWave(bsX, bsY + 10, detX, detY - 18, 2.2 + phMir, recR, recG, recB, recAlpha, baseSpeed, recAmp);

        // Interference label
        const intLabel = intensity > 0.75 ? '⊕ constructive' : intensity < 0.25 ? '⊖ destructive' : '~ partial';
        const intColor = intensity > 0.75 ? '#ffe650' : intensity < 0.25 ? '#39ff14' : '#BA7517';
        ctx.fillStyle = intColor; ctx.font = '500 7px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(intLabel, bsX + 16, bsY - 10);
      }

      // ── Photon particle (single photon, loops along beam path) ──
      const ph = photonRef.current;
      ph.t += dtS * 0.18; // slow: takes ~5.5s per loop
      if (ph.t >= 1) { ph.t = 0; ph.arm = (ph.arm + 1) % 2; }
      const tVal = ph.t;
      // Define path segments for each arm
      let phX, phY;
      if (ph.arm === 0 && m1On) {
        // Laser → BS → M1 → BS → Detector
        const pathPts = [
          {x: laserX + 32, y: laserY},
          {x: bsX, y: bsY},
          {x: m1X, y: m1Y + 12},
          {x: bsX, y: bsY},
          {x: detX, y: detY - 18},
        ];
        // interpolate
        const totalSegs = pathPts.length - 1;
        const segIdx = Math.min(totalSegs - 1, Math.floor(tVal * totalSegs));
        const segT = (tVal * totalSegs) - segIdx;
        phX = pathPts[segIdx].x + segT * (pathPts[segIdx+1].x - pathPts[segIdx].x);
        phY = pathPts[segIdx].y + segT * (pathPts[segIdx+1].y - pathPts[segIdx].y);
      } else if (ph.arm === 1 && m2On) {
        // Laser → BS → Gas → M2 → Gas → BS → Detector
        const pathPts = [
          {x: laserX + 32, y: laserY},
          {x: bsX, y: bsY},
          {x: gasBoxX + gasBoxW / 2, y: bsY},
          {x: m2X - 12, y: bsY},
          {x: gasBoxX + gasBoxW / 2, y: bsY},
          {x: bsX, y: bsY},
          {x: detX, y: detY - 18},
        ];
        const totalSegs = pathPts.length - 1;
        const segIdx = Math.min(totalSegs - 1, Math.floor(tVal * totalSegs));
        const segT = (tVal * totalSegs) - segIdx;
        phX = pathPts[segIdx].x + segT * (pathPts[segIdx+1].x - pathPts[segIdx].x);
        phY = pathPts[segIdx].y + segT * (pathPts[segIdx+1].y - pathPts[segIdx].y);
      }

      if (phX !== undefined) {
        // Draw photon glow
        const phGrad = ctx.createRadialGradient(phX, phY, 0, phX, phY, 10);
        phGrad.addColorStop(0, `rgba(${clr},${clg},${clb},0.9)`);
        phGrad.addColorStop(0.5, `rgba(${clr},${clg},${clb},0.3)`);
        phGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = phGrad;
        ctx.beginPath(); ctx.arc(phX, phY, 10, 0, Math.PI * 2); ctx.fill();
        // Core dot
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(phX, phY, 2.5, 0, Math.PI * 2); ctx.fill();
        // Label
        ctx.fillStyle = `rgba(${clr},${clg},${clb},0.6)`;
        ctx.font = '600 7px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('γ', phX, phY - 12);
      }

      // ── Components ──
      // Laser
      ctx.fillStyle = 'rgba(20,40,70,0.6)';
      ctx.strokeStyle = `rgba(${clr},${clg},${clb},0.5)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(laserX, laserY - 14, 34, 28); ctx.fill(); ctx.stroke();
      ctx.fillStyle = `rgba(${clr},${clg},${clb},0.9)`; ctx.font = '500 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Laser', laserX + 17, laserY + 4);
      ctx.fillStyle = `rgba(${clr},${clg},${clb},0.45)`; ctx.font = '6px monospace';
      ctx.fillText(`${lamNm.toFixed(0)}nm`, laserX + 17, laserY + 13);

      // BS
      ctx.save(); ctx.translate(bsX, bsY); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = 'rgba(100,180,255,0.08)'; ctx.strokeStyle = 'rgba(100,140,220,0.5)'; ctx.lineWidth = 1.5;
      ctx.fillRect(-14, -2, 28, 4); ctx.strokeRect(-14, -2, 28, 4);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '500 8px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('BS', bsX + 12, bsY + 5);

      // M1
      ctx.fillStyle = m1On ? 'rgba(20,40,60,0.5)' : 'rgba(60,20,20,0.3)';
      ctx.strokeStyle = m1On ? 'rgba(100,140,220,0.6)' : 'rgba(255,60,60,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(bsX - 18, m1Y, 36, 22); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(m1On ? 'M1 (fixed)' : 'M1 OFF', bsX, m1Y + 34);

      // M2 (with tilt visual)
      ctx.save(); ctx.translate(m2X, m2Y); ctx.rotate(tiltVal * 1e-3 * 0.1);
      ctx.fillStyle = m2On ? 'rgba(60,25,25,0.5)' : 'rgba(60,20,20,0.3)';
      ctx.strokeStyle = m2On ? 'rgba(226,75,74,0.6)' : 'rgba(255,60,60,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(-5, -22, 16, 44); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#A32D2D'; ctx.font = '500 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('M2', m2X + 3, m2Y + 34);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '7px monospace';
      ctx.fillText(`${(mirPos * 1e6 >= 0 ? '+' : '')}${(mirPos * 1e6).toFixed(1)}μm`, m2X + 3, m2Y + 44);

      // Detector — threshold-based color (changes state only at intensity crossings, not per frame)
      const detIntensity = intensity * powerFactor;
      const detR = isC ? 255 : 57, detGc = isC ? 220 : 255, detB = isC ? 60 : 20;
      ctx.fillStyle = `rgba(${detR},${detGc},${detB},${0.1 + detIntensity * 0.3})`;
      ctx.strokeStyle = '#1D9E75'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(detX - 24, detY - 18, 48, 18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2dd4a8'; ctx.font = '500 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Detector', detX, detY - 5);
      // Intensity readout ON detector
      ctx.fillStyle = `rgba(${detR},${detGc},${detB},0.8)`; ctx.font = '600 7px monospace';
      ctx.fillText(`I=${(intensity*100).toFixed(0)}%`, detX, detY + 10);

      // Top readout
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '500 9px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`λ=${Math.round(lamNm)}nm  spd=${baseSpeed.toFixed(1)}×  P=${(powerFactor*100).toFixed(0)}%`, 8, 14);
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '8px monospace';
      ctx.fillText(`Δφ = ${(phMod / (2 * Math.PI)).toFixed(4)}λ`, W2 - 8, 14);

      // Legend
      const legs = [
        { r: clr, g: clg, b: clb, l: 'Arm 1 — M1' },
        { r: cgr, g: cgg, b: cgb, l: 'Arm 2 — M2/gas' },
        { r: Math.round((clr+cgr)/2), g: Math.round((clg+cgg)/2), b: Math.round((clb+cgb)/2), l: 'Recombined' },
      ];
      legs.forEach((lg, i) => {
        const lx = W2 - 115, ly = 26 + i * 13;
        ctx.strokeStyle = `rgba(${lg.r},${lg.g},${lg.b},0.9)`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 14, ly); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '7px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(lg.l, lx + 18, ly + 3);
      });

      // Bottom formula
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
      ctx.fillText('I = I₀cos²(πΔ/λ)   Δ = 2(n−1)Lc + 2Δd', 8, H2 - 6);
    };

    raf = requestAnimationFrame(animate);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, [wavesOn]);

  // Compute values for React overlay (live update each render via store subscription)
  const st = useSimulationStore();
  const gas = GAS_DATA[st.gasCellGas] || GAS_DATA.air;
  const nM1 = gas.n0 * st.gasCellPressure;
  const nVal2 = 1 + nM1;
  const gasOPD = 2 * (nVal2 - 1) * st.gasCellLength;
  const mirOPD = 2 * st.mirrorDisplacement * 1e-6;
  const totalOPD = gasOPD + mirOPD;
  const phaseDiff = (2 * Math.PI / st.wavelength) * totalOPD;
  const phaseMod = ((phaseDiff % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const intensity = Math.cos(phaseMod / 2) ** 2;
  const totalFringes = totalOPD / st.wavelength;
  const tiltSpacing = st.mirrorTilt > 0.01 ? (st.wavelength / (2 * st.mirrorTilt * 1e-3)) : Infinity;
  const regime = st.mirrorTilt < 0.05 ? 'Circular' : st.mirrorTilt < 0.5 ? 'Curved' : st.mirrorTilt < 2 ? 'Straight' : 'Dense';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Title */}
      <div style={{ position: 'absolute', top: 6, left: 8, zIndex: 2, pointerEvents: 'none' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Michelson Interferometer
        </div>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>
          {gas.label} · n={nVal2.toFixed(6)} · OPD={(totalOPD*1e9).toFixed(1)}nm
        </div>
      </div>

      {/* Interference badge — driven by real intensity */}
      <div style={{ position: 'absolute', top: 6, right: 8, zIndex: 2 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
          background: intensity > 0.75 ? 'rgba(255,230,80,0.2)' : intensity < 0.25 ? 'rgba(57,255,20,0.15)' : 'rgba(186,117,23,0.15)',
          color: intensity > 0.75 ? '#ffe650' : intensity < 0.25 ? '#39ff14' : '#BA7517',
        }}>
          {intensity > 0.75 ? 'Constructive' : intensity < 0.25 ? 'Destructive' : 'Partial'}
        </span>
      </div>

      {/* Animation controls */}
      <div style={{ position: 'absolute', bottom: 48, right: 8, zIndex: 3, display: 'flex', gap: 4 }}>
        <AnimBtn label={wavesOn ? 'Waves ON' : 'Waves OFF'} active={wavesOn} onClick={() => setWavesOn(!wavesOn)} color="#2dd4a8" />
        <AnimBtn label={animMode === 'p' ? '■ Stop P' : '▶ Animate P'} active={animMode === 'p'} onClick={() => toggleParamAnim('p')}
          title="Smoothly sweeps gas-cell pressure (0.1→10 atm). Watch fringe count change via Δ=2(n-1)Lc." />
        <AnimBtn label={animMode === 't' ? '■ Stop tilt' : '▶ Animate tilt'} active={animMode === 't'} onClick={() => toggleParamAnim('t')}
          title="Sweeps mirror tilt (0→5 mrad). Circular → straight fringes." />
        <AnimBtn label={animMode === 'm' ? '■ Stop M2' : '▶ Animate M2'} active={animMode === 'm'} onClick={() => toggleParamAnim('m')}
          title="Oscillates M2 position ±50μm. Full fringe cycle = λ/2 = 316nm stepping." />
      </div>

      {/* Metrics bar — all real physics */}
      <div style={{
        display: 'flex', gap: 10, padding: '4px 8px', flexWrap: 'wrap',
        fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.4)',
        position: 'absolute', bottom: 4, left: 4, right: 4, zIndex: 2,
      }}>
        <TooltipSpan tip="n−1 = n₀ × P  (Lorentz-Lorenz approximation)">
          n−1: <b style={{ color: '#fff' }}>{(nM1 * 1e6).toFixed(1)}×10⁻⁶</b>
        </TooltipSpan>
        <TooltipSpan tip="Gas OPD = 2(n−1)Lc">
          Gas OPD: <b style={{ color: '#fff' }}>{(gasOPD * 1e9).toFixed(2)} nm</b>
        </TooltipSpan>
        <TooltipSpan tip="Mirror OPD = 2·Δd">
          Mirror OPD: <b style={{ color: '#fff' }}>{(mirOPD * 1e9).toFixed(1)} nm</b>
        </TooltipSpan>
        <TooltipSpan tip="N = Δ_total / λ">
          Fringes: <b style={{ color: '#fff' }}>{totalFringes.toFixed(3)}</b>
        </TooltipSpan>
        <TooltipSpan tip="Λ = λ / (2θ)  fringe spacing for current tilt θ">
          Tilt spacing: <b style={{ color: '#fff' }}>{tiltSpacing < 1e6 ? (tiltSpacing * 1e3).toFixed(2) + ' mm' : '∞'}</b>
        </TooltipSpan>
        <TooltipSpan tip="Regime: θ<0.05→Circular, θ<0.5→Curved, θ<2→Straight, else Dense">
          Regime: <b style={{ color: intensity > 0.5 ? '#ffe650' : '#39ff14' }}>{regime}</b>
        </TooltipSpan>
        <TooltipSpan tip="I = I₀cos²(πΔ/λ) — detector intensity">
          I: <b style={{ color: '#fff' }}>{(intensity * 100).toFixed(1)}%</b>
        </TooltipSpan>
      </div>

      {/* Full-width canvas */}
      <div ref={containerRef} style={{ position: 'absolute', inset: '28px 4px 68px 4px' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', borderRadius: 8, display: 'block' }} />
      </div>
    </div>
  );
};

/** Tooltip wrapper */
const TooltipSpan = ({ tip, children }) => (
  <span title={tip} style={{ cursor: 'help', borderBottom: '1px dotted rgba(255,255,255,0.2)' }}>
    {children}
  </span>
);

const AnimBtn = ({ label, active, onClick, color, title }) => (
  <button onClick={onClick} title={title} style={{
    fontSize: 9, padding: '3px 10px', borderRadius: 6,
    border: `1px solid ${active ? (color || 'rgba(79,156,249,0.5)') : 'rgba(255,255,255,0.12)'}`,
    background: active ? `${color ? color + '22' : 'rgba(79,156,249,0.2)'}` : 'rgba(255,255,255,0.06)',
    color: active ? (color || '#4f9cf9') : 'rgba(255,255,255,0.7)',
    cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
  }}>
    {label}
  </button>
);

export default MichelsonScene;
