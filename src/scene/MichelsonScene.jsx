import React, { useRef, useEffect, useState, useCallback } from 'react';
import useSimulationStore from '../store/simulationStore.js';

/**
 * MichelsonScene — Classic Michelson Interferometer
 * Fully integrated from michelson_neon_destructive.html
 *
 * Layout:
 *               M1 (fixed, top)
 *               |
 * Laser → BS → M2 (movable, right) + Gas Cell
 *               |
 *            Detector (bottom)
 */

const GAS_DATA = {
  air: { n0: 293e-6, color: [55, 138, 221], label: 'Air' },
  he:  { n0: 35e-6,  color: [29, 158, 117], label: 'Helium' },
  ar:  { n0: 281e-6, color: [216, 90, 48],  label: 'Argon' },
};

const DESTR_R = 57, DESTR_G = 255, DESTR_B = 20;
const CONSTR_R = 255, CONSTR_G = 230, CONSTR_B = 80;

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
  const containerRef = useRef(null);
  const setupRef = useRef(null);
  const fringeRef = useRef(null);
  const waveTRef = useRef(0);
  const paramAnimRef = useRef({ active: false, mode: '', val: 0, dir: 1 });
  const fringeBufferRef = useRef(null);
  const [wavesOn, setWavesOn] = useState(true);
  const [animMode, setAnimMode] = useState('');

  const toggleParamAnim = useCallback((mode) => {
    const pa = paramAnimRef.current;
    if (pa.active && pa.mode === mode) {
      pa.active = false; pa.mode = '';
      setAnimMode('');
    } else {
      pa.active = true; pa.mode = mode; pa.dir = 1;
      if (mode === 'p') pa.val = 0.1;
      else if (mode === 't') pa.val = 0;
      else { pa.val = -50; pa.dir = 1; }
      setAnimMode(mode);
    }
  }, []);

  useEffect(() => {
    const cs = setupRef.current;
    const cf = fringeRef.current;
    const container = containerRef.current;
    if (!cs || !cf || !container) return;
    let raf;
    let running = true;

    const animate = () => {
      if (!running) return;
      raf = requestAnimationFrame(animate);

      const st = useSimulationStore.getState();
      if (st.simulationPaused) return;

      // Sizing — get from container
      const totalW = container.clientWidth;
      const totalH = container.clientHeight;
      if (totalW < 10 || totalH < 10) return; // not laid out yet

      waveTRef.current += 0.016 * st.waveAnimSpeed * 4;
      const waveT = waveTRef.current;

      // Parameter animation
      const pa = paramAnimRef.current;
      if (pa.active) {
        if (pa.mode === 'p') {
          pa.val = +(pa.val + 0.04).toFixed(2);
          if (pa.val > 10) pa.val = 0.1;
          st.setParam('gasCellPressure', pa.val);
        } else if (pa.mode === 't') {
          pa.val = +(pa.val + 0.008).toFixed(3);
          if (pa.val > 5) pa.val = 0;
          st.setParam('mirrorTilt', pa.val);
        } else if (pa.mode === 'm') {
          pa.val = +(pa.val + pa.dir * 0.3).toFixed(2);
          if (pa.val >= 50) { pa.val = 50; pa.dir = -1; }
          if (pa.val <= -50) { pa.val = -50; pa.dir = 1; }
          st.setParam('mirrorDisplacement', pa.val);
        }
      }

      const setupW = Math.floor(totalW * 0.58);
      const fringeW = totalW - setupW - 16;
      const canvasH = totalH;

      // Resize canvases
      if (cs.width !== setupW || cs.height !== canvasH) {
        cs.width = setupW; cs.height = canvasH;
      }
      const fringeRes = Math.min(fringeW, 180);
      if (cf.width !== fringeRes || cf.height !== fringeRes) {
        cf.width = fringeRes; cf.height = fringeRes;
        fringeBufferRef.current = null;
      }

      const sctx = cs.getContext('2d');
      const fctx = cf.getContext('2d');
      const W = setupW, H = canvasH;
      const FW = fringeRes;

      // Read fresh state
      const gas2 = GAS_DATA[st.gasCellGas] || GAS_DATA.air;
      const nM = gas2.n0 * st.gasCellPressure;
      const nVal = 1 + nM;
      const lamVal = st.wavelength;
      const lamNm2 = lamVal * 1e9;
      const [clr, clg, clb] = lambdaToRGB(lamNm2);
      const [cgr, cgg, cgb] = gas2.color;
      const tiltVal = st.mirrorTilt;
      const mirPos = st.mirrorDisplacement * 1e-6;
      const curv = st.curvatureFactor;
      const baseSpeed = st.waveAnimSpeed;
      const gasSpeed = baseSpeed / nVal;
      const AMP = st.waveAnimAmplitude;
      const phMir = mirPos * 1e6 * 0.12;
      const powerFactor = Math.min(1, st.laserPower / 0.01);

      const gOPD = 2 * (nVal - 1) * st.gasCellLength;
      const mOPD = 2 * mirPos;
      const tOPD = gOPD + mOPD;
      const pd = (2 * Math.PI / lamVal) * tOPD;
      const pm = ((pd % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const cv = (Math.cos(pm) + 1) / 2;
      const isC = cv > 0.5;
      const recR = Math.round((clr + cgr) / 2), recG = Math.round((clg + cgg) / 2), recB = Math.round((clb + cgb) / 2);

      // ── SETUP CANVAS ──
      sctx.clearRect(0, 0, W, H);
      sctx.fillStyle = 'rgba(5,5,5,0.95)';
      sctx.fillRect(0, 0, W, H);

      // Subtle grid
      sctx.strokeStyle = 'rgba(255,255,255,0.02)';
      sctx.lineWidth = 0.5;
      for (let gx = 0; gx < W; gx += 30) { sctx.beginPath(); sctx.moveTo(gx, 0); sctx.lineTo(gx, H); sctx.stroke(); }
      for (let gy = 0; gy < H; gy += 30) { sctx.beginPath(); sctx.moveTo(0, gy); sctx.lineTo(W, gy); sctx.stroke(); }

      const bsX = Math.round(W * 0.38), bsY = Math.round(H * 0.46);
      const laserX = 14, laserY = bsY;
      const m1Y = 30;
      const m2BaseX = W - 52, m2Y = bsY;
      const m2X = Math.round(m2BaseX + mirPos * 1e6 * 0.45);
      const detX = bsX, detY = H - 24;

      // Gas cell box
      const gasBoxW = Math.max(28, Math.min(80, st.gasCellLength * 680));
      const gasBoxX = bsX + 26, gasBoxY = bsY - 13;
      sctx.fillStyle = `rgba(${cgr},${cgg},${cgb},0.08)`;
      sctx.strokeStyle = `rgba(${cgr},${cgg},${cgb},0.3)`;
      sctx.lineWidth = 1; sctx.setLineDash([3, 2]);
      sctx.fillRect(gasBoxX, gasBoxY, gasBoxW, 26);
      sctx.strokeRect(gasBoxX, gasBoxY, gasBoxW, 26);
      sctx.setLineDash([]);
      sctx.fillStyle = `rgba(${cgr},${cgg},${cgb},0.7)`;
      sctx.font = '500 8px sans-serif'; sctx.textAlign = 'center';
      sctx.fillText(gas2.label, gasBoxX + gasBoxW / 2, gasBoxY + 16);
      sctx.font = '7px monospace';
      sctx.fillText('v=c/' + nVal.toFixed(4), gasBoxX + gasBoxW / 2, gasBoxY - 4);

      const gEnd = gasBoxX + gasBoxW;

      // Halo helper
      const drawHalo = (x, y, isConst, radius, alpha) => {
        const grad = sctx.createRadialGradient(x, y, 0, x, y, radius);
        if (isConst) {
          grad.addColorStop(0, `rgba(${CONSTR_R},${CONSTR_G},${CONSTR_B},${alpha})`);
          grad.addColorStop(1, 'rgba(255,200,0,0)');
        } else {
          grad.addColorStop(0, `rgba(${DESTR_R},${DESTR_G},${DESTR_B},${alpha})`);
          grad.addColorStop(1, `rgba(${DESTR_R},${DESTR_G},${DESTR_B},0)`);
        }
        sctx.fillStyle = grad;
        sctx.beginPath(); sctx.arc(x, y, radius, 0, Math.PI * 2); sctx.fill();
      };

      const m1On = st.m1Enabled !== false;
      const m2On = st.m2Enabled !== false;

      // Halos
      const m1Pulse = (Math.sin(waveT * baseSpeed + 3.1 + phMir) + 1) / 2;
      if (m1On) drawHalo(bsX, m1Y + 11, true, 28, 0.15 + m1Pulse * 0.5);
      const m2Pulse = (Math.sin(waveT * baseSpeed + phMir) + 1) / 2;
      if (m2On) drawHalo(m2X, m2Y, isC, 34, 0.15 + m2Pulse * 0.55);
      const intStr = isC ? cv : (1 - cv);
      drawHalo(bsX, bsY, isC, 34 + intStr * 22, 0.28 + intStr * 0.55);
      drawHalo(detX, detY - 10, isC, 28 + cv * 14, 0.2 + cv * 0.6);

      // Wave drawing helper
      const drawWave = (x1, y1, x2, y2, phOff, wr, wg, wb, alpha, spd, amp) => {
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
        if (len < 2) return;
        const ux = dx / len, uy = dy / len, px2 = -uy, py2 = ux, freq = 0.07;
        sctx.beginPath();
        for (let i = 0; i <= len; i += 1.5) {
          const w = Math.sin(i * freq - waveT * spd + phOff) * amp * powerFactor;
          if (i === 0) sctx.moveTo(x1 + ux * i + px2 * w, y1 + uy * i + py2 * w);
          else sctx.lineTo(x1 + ux * i + px2 * w, y1 + uy * i + py2 * w);
        }
        sctx.strokeStyle = `rgba(${wr},${wg},${wb},${alpha * powerFactor})`;
        sctx.lineWidth = 2; sctx.lineJoin = 'round'; sctx.lineCap = 'round'; sctx.stroke();
      };

      if (wavesOn) {
        // Laser → BS
        drawWave(laserX + 30, laserY, bsX - 8, bsY, 0, clr, clg, clb, 0.9, baseSpeed, AMP);
        // BS → M1 → BS
        if (m1On) {
          drawWave(bsX, bsY - 8, bsX, m1Y + 22, 1.1, clr, clg, clb, 0.85, baseSpeed, AMP);
          drawWave(bsX, m1Y + 22, bsX, bsY - 8, 3.1 + phMir, cgr, cgg, cgb, 0.75, baseSpeed, AMP);
        }
        // BS → Gas → M2 → Gas → BS
        if (m2On) {
          drawWave(bsX + 8, bsY, gasBoxX, bsY, 1.6, clr, clg, clb, 0.85, baseSpeed, AMP);
          drawWave(gasBoxX, bsY, gEnd, bsY, 1.6, cgr, cgg, cgb, 0.85, gasSpeed, AMP * 0.7);
          drawWave(gEnd, bsY, m2X - 16, bsY, 1.6, clr, clg, clb, 0.85, baseSpeed, AMP);
          drawWave(m2X - 16, bsY, gEnd, bsY, 3.1 + phMir, clr, clg, clb, 0.6, baseSpeed, AMP);
          drawWave(gEnd, bsY, gasBoxX, bsY, 3.1 + phMir, cgr, cgg, cgb, 0.6, gasSpeed, AMP * 0.7);
          drawWave(gasBoxX, bsY, bsX + 8, bsY, 3.1 + phMir, clr, clg, clb, 0.6, baseSpeed, AMP);
        }
        // Recombined beam → detector
        const recAlpha = 0.4 + cv * 0.55;
        const recAmp = AMP * (0.3 + cv * 0.9);
        const beamR = isC ? recR : Math.round(recR * (1 - intStr) + DESTR_R * intStr);
        const beamG = isC ? recG : Math.round(recG * (1 - intStr) + DESTR_G * intStr);
        const beamB = isC ? recB : Math.round(recB * (1 - intStr) + DESTR_B * intStr);
        drawWave(bsX, bsY + 8, detX, detY - 22, 2.2 + phMir, beamR, beamG, beamB, recAlpha, baseSpeed, recAmp);

        // Interference label
        const intLabel = cv > 0.75 ? '⊕ constructive' : cv < 0.25 ? '⊖ destructive' : '~ partial';
        const intColor = cv > 0.75 ? '#ffe650' : cv < 0.25 ? '#39ff14' : '#BA7517';
        sctx.fillStyle = intColor; sctx.font = '500 7px sans-serif'; sctx.textAlign = 'left';
        sctx.fillText(intLabel, bsX + 14, bsY - 8);
      }

      // Components: Laser
      sctx.fillStyle = 'rgba(20,40,70,0.6)';
      sctx.strokeStyle = `rgba(${clr},${clg},${clb},0.5)`;
      sctx.lineWidth = 1.5;
      sctx.beginPath(); sctx.rect(laserX, laserY - 13, 30, 26); sctx.fill(); sctx.stroke();
      sctx.fillStyle = `rgba(${clr},${clg},${clb},0.9)`; sctx.font = '500 8px sans-serif'; sctx.textAlign = 'center';
      sctx.fillText('Laser', laserX + 15, laserY + 4);

      // BS
      sctx.save(); sctx.translate(bsX, bsY); sctx.rotate(Math.PI / 4);
      sctx.fillStyle = 'rgba(100,180,255,0.1)'; sctx.strokeStyle = 'rgba(100,140,220,0.5)'; sctx.lineWidth = 1.5;
      sctx.fillRect(-14, -2, 28, 4); sctx.strokeRect(-14, -2, 28, 4);
      sctx.restore();
      sctx.fillStyle = 'rgba(255,255,255,0.35)'; sctx.font = '8px sans-serif'; sctx.textAlign = 'left';
      sctx.fillText('BS', bsX + 10, bsY + 5);

      // M1
      sctx.fillStyle = m1On ? 'rgba(20,40,60,0.5)' : 'rgba(60,20,20,0.3)';
      sctx.strokeStyle = m1On ? 'rgba(100,140,220,0.6)' : 'rgba(255,60,60,0.3)';
      sctx.lineWidth = 1.5;
      sctx.beginPath(); sctx.rect(bsX - 18, m1Y, 36, 22); sctx.fill(); sctx.stroke();
      sctx.fillStyle = 'rgba(255,255,255,0.4)'; sctx.font = '8px sans-serif'; sctx.textAlign = 'center';
      sctx.fillText(m1On ? 'M1 (fixed)' : 'M1 OFF', bsX, m1Y + 36);

      // M2
      sctx.save(); sctx.translate(m2X, m2Y); sctx.rotate(tiltVal * 1e-3 * 0.09);
      sctx.fillStyle = m2On ? 'rgba(60,25,25,0.5)' : 'rgba(60,20,20,0.3)';
      sctx.strokeStyle = m2On ? 'rgba(226,75,74,0.6)' : 'rgba(255,60,60,0.3)';
      sctx.lineWidth = 1.5;
      sctx.beginPath(); sctx.rect(-5, -22, 16, 44); sctx.fill(); sctx.stroke();
      sctx.restore();
      sctx.fillStyle = '#A32D2D'; sctx.font = '500 8px sans-serif'; sctx.textAlign = 'center';
      sctx.fillText('M2', m2X + 3, m2Y + 33);
      sctx.fillStyle = 'rgba(255,255,255,0.3)'; sctx.font = '7px monospace';
      sctx.fillText((mirPos * 1e6 >= 0 ? '+' : '') + (mirPos * 1e6).toFixed(1) + 'μm', m2X + 3, m2Y + 44);

      // Detector
      const detFill = isC
        ? `rgba(255,220,60,${0.2 + cv * 0.35})`
        : `rgba(${DESTR_R},${DESTR_G},${DESTR_B},${0.15 + intStr * 0.35})`;
      sctx.fillStyle = detFill; sctx.strokeStyle = '#1D9E75'; sctx.lineWidth = 1.5;
      sctx.beginPath(); sctx.rect(detX - 22, detY - 20, 44, 20); sctx.fill(); sctx.stroke();
      sctx.fillStyle = '#2dd4a8'; sctx.font = '500 8px sans-serif'; sctx.textAlign = 'center';
      sctx.fillText('Detector', detX, detY - 6);

      // Info
      sctx.fillStyle = 'rgba(255,255,255,0.35)'; sctx.font = '500 9px sans-serif'; sctx.textAlign = 'left';
      sctx.fillText(`λ=${Math.round(lamNm2)}nm  spd=${baseSpeed.toFixed(1)}×`, 6, 14);
      sctx.textAlign = 'right'; sctx.fillStyle = 'rgba(255,255,255,0.3)'; sctx.font = '8px monospace';
      sctx.fillText(`Δφ = ${(pm / (2 * Math.PI)).toFixed(3)}λ`, W - 6, 14);

      // Legend
      const legs = [
        { r: clr, g: clg, b: clb, l: 'Arm 1 — M1' },
        { r: cgr, g: cgg, b: cgb, l: 'Arm 2 — M2/gas' },
        { r: recR, g: recG, b: recB, l: 'Recombined' },
      ];
      legs.forEach((lg2, i) => {
        const lx = W - 110, ly = 26 + i * 13;
        sctx.strokeStyle = `rgba(${lg2.r},${lg2.g},${lg2.b},0.9)`;
        sctx.lineWidth = 2;
        sctx.beginPath(); sctx.moveTo(lx, ly); sctx.lineTo(lx + 14, ly); sctx.stroke();
        sctx.fillStyle = 'rgba(255,255,255,0.4)'; sctx.font = '7px sans-serif'; sctx.textAlign = 'left';
        sctx.fillText(lg2.l, lx + 18, ly + 3);
      });

      // Formula at bottom
      sctx.fillStyle = 'rgba(255,255,255,0.2)'; sctx.font = '8px monospace'; sctx.textAlign = 'left';
      sctx.fillText('I = I₀cos²(πΔ/λ)   Δ = 2(n-1)Lc + 2Δd', 6, H - 6);

      // ── FRINGE CANVAS ──
      const tiltF = st.mirrorTilt * 1e-3;
      if (!fringeBufferRef.current || fringeBufferRef.current.width !== FW) {
        fringeBufferRef.current = fctx.createImageData(FW, FW);
      }
      const img = fringeBufferRef.current;
      const midX = FW / 2, midY2 = FW / 2;
      const scX = 0.01 / FW;
      const [flr, flg, flb] = lambdaToRGB(lamNm2);

      for (let py2 = 0; py2 < FW; py2++) {
        for (let px2 = 0; px2 < FW; px2++) {
          const x = (px2 - midX) * scX, y = (py2 - midY2) * scX;
          const R2 = x * x + y * y;
          const curvP = tiltF < 5e-5 ? (2 * Math.PI / lamVal) * (R2 / curv) : 0;
          const tiltP = (2 * Math.PI / lamVal) * 2 * tiltF * x;
          const totP = (2 * Math.PI / lamVal) * tOPD;
          const I = (1 + Math.cos(totP + tiltP + curvP)) / 2;
          const I2 = I * I;
          const idx = (py2 * FW + px2) * 4;
          img.data[idx] = Math.min(255, Math.round(I2 * flr * 1.15));
          img.data[idx + 1] = Math.min(255, Math.round(I2 * flg * 1.15));
          img.data[idx + 2] = Math.min(255, Math.round(I2 * flb * 1.15));
          img.data[idx + 3] = 255;
        }
      }
      fctx.putImageData(img, 0, 0);

      // Fringe overlay
      fctx.fillStyle = `rgba(${cgr},${cgg},${cgb},0.9)`; fctx.font = '500 8px sans-serif'; fctx.textAlign = 'left';
      fctx.fillText(gas2.label, 6, 14);
      fctx.fillStyle = 'rgba(0,0,0,0.45)'; fctx.fillRect(0, FW - 16, FW, 16);
      fctx.fillStyle = 'rgba(255,255,255,0.7)'; fctx.font = '7px sans-serif'; fctx.textAlign = 'center';
      const totalFringesF = tOPD / lamVal;
      const regimeF = tiltF * 1e3 < 0.05 ? 'Circular' : tiltF * 1e3 < 0.5 ? 'Curved' : tiltF * 1e3 < 2 ? 'Straight' : 'Dense';
      fctx.fillText(`OPD=${(gOPD * 1e9).toFixed(1)}nm  fringes=${totalFringesF.toFixed(2)}  ${regimeF}`, FW / 2, FW - 4);
    };

    raf = requestAnimationFrame(animate);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, [wavesOn]);

  // Compute values for React overlay
  const st = useSimulationStore();
  const gas = GAS_DATA[st.gasCellGas] || GAS_DATA.air;
  const nM1 = gas.n0 * st.gasCellPressure;
  const n = 1 + nM1;
  const gasOPD = 2 * (n - 1) * st.gasCellLength;
  const mirOPD = 2 * st.mirrorDisplacement * 1e-6;
  const totalOPD = gasOPD + mirOPD;
  const phaseDiff = (2 * Math.PI / st.wavelength) * totalOPD;
  const phaseMod = ((phaseDiff % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const cosVal = (Math.cos(phaseMod) + 1) / 2;
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
          {gas.label} (n={n.toFixed(6)})
        </div>
      </div>

      {/* Interference badge */}
      <div style={{ position: 'absolute', top: 6, right: 8, zIndex: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
          background: cosVal > 0.75 ? 'rgba(255,230,80,0.2)' : cosVal < 0.25 ? 'rgba(57,255,20,0.15)' : 'rgba(186,117,23,0.15)',
          color: cosVal > 0.75 ? '#ffe650' : cosVal < 0.25 ? '#39ff14' : '#BA7517',
        }}>
          {cosVal > 0.75 ? 'Constructive' : cosVal < 0.25 ? 'Destructive' : 'Partial'}
        </span>
      </div>

      {/* Animation controls */}
      <div style={{ position: 'absolute', bottom: 28, right: 8, zIndex: 3, display: 'flex', gap: 4 }}>
        <AnimBtn label={wavesOn ? 'Waves ON' : 'Waves OFF'} active={wavesOn} onClick={() => setWavesOn(!wavesOn)} color="#2dd4a8" />
        <AnimBtn label={animMode === 'p' ? 'Stop P' : 'Animate P'} active={animMode === 'p'} onClick={() => toggleParamAnim('p')} />
        <AnimBtn label={animMode === 't' ? 'Stop tilt' : 'Animate tilt'} active={animMode === 't'} onClick={() => toggleParamAnim('t')} />
        <AnimBtn label={animMode === 'm' ? 'Stop M2' : 'Animate M2'} active={animMode === 'm'} onClick={() => toggleParamAnim('m')} />
      </div>

      {/* Metrics bar */}
      <div style={{
        display: 'flex', gap: 8, padding: '4px 8px', flexWrap: 'wrap',
        fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.4)',
        position: 'absolute', bottom: 4, left: 4, right: 4, zIndex: 2,
      }}>
        <span>n−1: <b style={{ color: '#fff' }}>{(nM1 * 1e6).toFixed(1)}×10⁻⁶</b></span>
        <span>Gas OPD: <b style={{ color: '#fff' }}>{(gasOPD * 1e9).toFixed(2)} nm</b></span>
        <span>Mirror OPD: <b style={{ color: '#fff' }}>{(mirOPD * 1e9).toFixed(1)} nm</b></span>
        <span>Fringes: <b style={{ color: '#fff' }}>{totalFringes.toFixed(3)}</b></span>
        <span>Tilt: <b style={{ color: '#fff' }}>{tiltSpacing < 1e6 ? (tiltSpacing * 1e3).toFixed(2) + ' mm' : '∞'}</b></span>
        <span>Regime: <b style={{ color: cosVal > 0.5 ? '#ffe650' : '#39ff14' }}>{regime}</b></span>
      </div>

      {/* Canvases */}
      <div ref={containerRef} style={{ position: 'absolute', inset: '28px 4px 46px 4px', display: 'flex', gap: 8 }}>
        <canvas ref={setupRef} style={{ flex: 3, borderRadius: 8, display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />
        <canvas ref={fringeRef} style={{ flex: 2, borderRadius: 8, maxWidth: '40%', display: 'block', imageRendering: 'auto', objectFit: 'contain' }} />
      </div>
    </div>
  );
};

const AnimBtn = ({ label, active, onClick, color }) => (
  <button onClick={onClick} style={{
    fontSize: 9, padding: '3px 10px', borderRadius: 6,
    border: `1px solid ${active ? (color || 'rgba(79,156,249,0.5)') : 'rgba(255,255,255,0.12)'}`,
    background: active ? `${color || 'rgba(79,156,249,0.2)'}22` : 'rgba(255,255,255,0.06)',
    color: active ? (color || '#4f9cf9') : 'rgba(255,255,255,0.7)',
    cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
  }}>
    {label}
  </button>
);

export default MichelsonScene;
