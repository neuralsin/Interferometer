import React, { useRef, useEffect, useState, useCallback } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { computeSagnac } from '../physics/sagnacModel.js';

/**
 * SagnacScene — matches reference diagram exactly:
 *   • Large circle = rotating disk
 *   • BS (half-silvered mirror) at CENTER of disk
 *   • 4 mirrors at corners of inscribed square on circle perimeter:
 *       M1 = top-left,  M2 = top-right
 *       M3 = bottom-right, M4 = bottom-left
 *   • Source enters from outside (left/below center)
 *   • Detector exits from right (outside circle)
 *   • CW  (blue):  BS→M2→M1→M4→M3→BS  (clockwise)
 *   • CCW (red):   BS→M3→M4→M1→M2→BS  (counter-clockwise)
 *
 * Physics: Δt = 4AΩ/c²   ΔN = 4AΩ/(cλ)   C'= c-v  C"= c+v
 */

const C_LIGHT = 299792458;

function lambdaToRGB(nm) {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = (440 - nm) / 60; b = 1; }
  else if (nm >= 440 && nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm >= 490 && nm < 510) { g = 1; b = (510 - nm) / 20; }
  else if (nm >= 510 && nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm >= 580 && nm < 645) { r = 1; g = (645 - nm) / 65; }
  else if (nm >= 645 && nm <= 750) { r = 1; }
  const f = nm < 420 ? 0.3 + 0.7 * (nm - 380) / 40
            : nm > 700 ? 0.3 + 0.7 * (750 - nm) / 50 : 1;
  return [Math.round(r * f * 255), Math.round(g * f * 255), Math.round(b * f * 255)];
}

// Draw a sinusoidal wave segment
function drawSineBeam(ctx, fromX, fromY, toX, toY, waveT, phOff, [r, g, b], alpha, amp, freqPx) {
  const dx = toX - fromX, dy = toY - fromY;
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  const STEPS = Math.ceil(len);
  ctx.beginPath();
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const bx = fromX + ux * len * t;
    const by = fromY + uy * len * t;
    const w  = Math.sin(t * len * freqPx - waveT * 4 + phOff) * amp;
    if (i === 0) ctx.moveTo(bx + px * w, by + py * w);
    else           ctx.lineTo(bx + px * w, by + py * w);
  }
  ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.shadowColor = `rgba(${r},${g},${b},0.4)`;
  ctx.shadowBlur = 4;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// Arrow at midpoint of segment
function drawArrow(ctx, fromX, fromY, toX, toY, color) {
  const mx = (fromX + toX) / 2, my = (fromY + toY) / 2;
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.save();
  ctx.fillStyle = color;
  ctx.translate(mx, my);
  ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, 4); ctx.lineTo(-5, -4); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Mirror rectangle at position, rotated
function drawMirror(ctx, cx, cy, label) {
  // Mirror = short rectangle tilted 45°
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.fillRect(-14, -4, 28, 8);
  ctx.strokeRect(-14, -4, 28, 8);
  // Reflective surface line
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(10, -10); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '600 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy - 18);
}

const SagnacScene = () => {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const waveTRef     = useRef(0);
  const cwTRef       = useRef(0.0);   // 0→1 progress around loop (CW)
  const ccwTRef      = useRef(0.5);   // start offset so both visible
  const [animOmega, setAnimOmega] = useState(false);
  const animOmegaRef = useRef(false);
  const animOmegaVal = useRef(1.0);

  const toggleAnimOmega = useCallback(() => {
    animOmegaRef.current = !animOmegaRef.current;
    setAnimOmega(animOmegaRef.current);
  }, []);

  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    let raf;
    let running = true;
    let lastTs  = null;

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

      waveTRef.current += dtS * 2;
      const waveT = waveTRef.current;

      // Smooth Omega animation: sine oscillation, period ≈ 120s
      if (animOmegaRef.current) {
        const newOmega = Math.sin(waveT * 0.052) * 2;
        animOmegaVal.current = newOmega;
        st.setParam('sagnacOmega', parseFloat(newOmega.toFixed(4)));
      }

      const omega = st.sagnacOmega;
      const sg = computeSagnac({
        loopLength: st.sagnacLoopLength,
        loopRadius: st.sagnacLoopRadius,
        numLoops:   st.sagnacNumLoops,
        omega,
        wavelength: st.wavelength,
      });

      const lamNm = st.wavelength * 1e9;
      const [lr, lg2, lb] = lambdaToRGB(lamNm);
      const powerFactor = Math.min(1, st.laserPower / 5e-3);

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(5,5,5,0.97)';
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.018)';
      ctx.lineWidth = 0.5;
      for (let gx = 0; gx < W; gx += 30) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (let gy = 0; gy < H; gy += 30) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

      // ── Layout ──
      // Disk centered a bit left of canvas center
      const diskCX = W * 0.44, diskCY = H * 0.50;
      const diskR  = Math.min(W * 0.30, H * 0.40);

      // BS at center of disk
      const bsX = diskCX, bsY = diskCY;

      // Mirrors at 45° corners of inscribed square (on circle perimeter)
      //   angle: M1=135°(top-left), M2=45°(top-right), M3=315°(bottom-right), M4=225°(bottom-left)
      const ang135 = (135 * Math.PI) / 180;
      const ang45  = (45  * Math.PI) / 180;
      const ang315 = (315 * Math.PI) / 180;
      const ang225 = (225 * Math.PI) / 180;

      const M1 = { x: diskCX + diskR * Math.cos(ang135), y: diskCY + diskR * Math.sin(ang135) }; // top-left
      const M2 = { x: diskCX + diskR * Math.cos(ang45),  y: diskCY + diskR * Math.sin(ang45)  }; // top-right
      const M3 = { x: diskCX + diskR * Math.cos(ang315), y: diskCY + diskR * Math.sin(ang315) }; // bottom-right
      const M4 = { x: diskCX + diskR * Math.cos(ang225), y: diskCY + diskR * Math.sin(ang225) }; // bottom-left

      // Source: external, below-center-left
      const srcX = diskCX - diskR * 0.45, srcY = diskCY + diskR + 28;
      // Detector: external, right of disk
      const detX = diskCX + diskR + 52, detY = diskCY;

      // ── Draw Disk ──
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(diskCX, diskCY, diskR, 0, Math.PI * 2); ctx.stroke();

      // Rotation arrows on the disk circle
      if (Math.abs(omega) > 0.001) {
        const dir = omega < 0 ? -1 : 1;
        [0.25, 0.75].forEach(startFrac => {
          const startAngle = startFrac * 2 * Math.PI;
          const endAngle   = startAngle + dir * 0.4;
          ctx.strokeStyle = omega > 0 ? 'rgba(100,200,255,0.35)' : 'rgba(255,100,100,0.35)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(diskCX, diskCY, diskR * 0.95, startAngle, endAngle, omega < 0);
          ctx.stroke();
          // Arrowhead
          const tipA = endAngle;
          const tx2 = diskCX + diskR * 0.95 * Math.cos(tipA);
          const ty2 = diskCY + diskR * 0.95 * Math.sin(tipA);
          ctx.fillStyle = omega > 0 ? 'rgba(100,200,255,0.7)' : 'rgba(255,100,100,0.7)';
          ctx.beginPath(); ctx.arc(tx2, ty2, 5, 0, Math.PI * 2); ctx.fill();
        });
      }

      // Disk center label
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Rotating Disk', diskCX, diskCY - 28);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '700 9px monospace';
      ctx.fillText(`ω = ${omega >= 0 ? '+' : ''}${omega.toFixed(3)} rad/s`, diskCX, diskCY - 16);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.font = '8px monospace';
      ctx.fillText(`A = ${sg.area.toFixed(2)} m²`, diskCX, diskCY - 4);
      ctx.fillText(`v = ${sg.tangentialVelocity.toFixed(4)} m/s`, diskCX, diskCY + 8);

      // ── Loop paths (CW blue: BS→M2→M1→M4→M3→BS, CCW red: reverse) ──
      const cwPath  = [[bsX,bsY],[M2.x,M2.y],[M1.x,M1.y],[M4.x,M4.y],[M3.x,M3.y],[bsX,bsY]];
      const ccwPath = [[bsX,bsY],[M3.x,M3.y],[M4.x,M4.y],[M1.x,M1.y],[M2.x,M2.y],[bsX,bsY]];

      const wavePh = sg.phaseDiff * 0.5;
      const sineFreq = 0.035; // Hz/px: Δ spatial frequency of sine wave on path
      const sineAmp  = 4.0 * powerFactor;

      // CW (blue)
      for (let i = 0; i < cwPath.length - 1; i++) {
        drawSineBeam(ctx, cwPath[i][0], cwPath[i][1], cwPath[i+1][0], cwPath[i+1][1],
          waveT, wavePh + i * 1.1, [70, 150, 255], 0.55, sineAmp, sineFreq);
        drawArrow(ctx, cwPath[i][0], cwPath[i][1], cwPath[i+1][0], cwPath[i+1][1], 'rgba(70,150,255,0.7)');
      }

      // CCW (red)
      for (let i = 0; i < ccwPath.length - 1; i++) {
        drawSineBeam(ctx, ccwPath[i][0], ccwPath[i][1], ccwPath[i+1][0], ccwPath[i+1][1],
          waveT, -wavePh + i * 1.1, [255, 80, 80], 0.55, sineAmp, sineFreq);
        drawArrow(ctx, ccwPath[i][0], ccwPath[i][1], ccwPath[i+1][0], ccwPath[i+1][1], 'rgba(255,80,80,0.7)');
      }

      // ── CW photon particle ──
      cwTRef.current  = (cwTRef.current  + dtS * 0.10 * (sg.cwSpeed  / C_LIGHT)) % 1;
      ccwTRef.current = (ccwTRef.current + dtS * 0.10 * (sg.ccwSpeed / C_LIGHT)) % 1;

      const getPtOnPath = (path, t) => {
        // path is array of [x,y]
        const segs = path.length - 1;
        const segT = t * segs;
        const si   = Math.min(segs - 1, Math.floor(segT));
        const sf   = segT - si;
        return {
          x: path[si][0] + sf * (path[si+1][0] - path[si][0]),
          y: path[si][1] + sf * (path[si+1][1] - path[si][1]),
        };
      };

      const drawPhoton = (x, y, cr, cg, cb) => {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 12);
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},${0.9 * powerFactor})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      };

      const cwPt  = getPtOnPath(cwPath,  cwTRef.current);
      const ccwPt = getPtOnPath(ccwPath, ccwTRef.current);
      drawPhoton(cwPt.x,  cwPt.y,  70,  150, 255);
      drawPhoton(ccwPt.x, ccwPt.y, 255, 80,  80);

      // ── Mirrors ──
      drawMirror(ctx, M1.x, M1.y, 'M1');
      drawMirror(ctx, M2.x, M2.y, 'M2');
      drawMirror(ctx, M3.x, M3.y, 'M3');
      drawMirror(ctx, M4.x, M4.y, 'M4');

      // ── BS at center (half-silvered, diamond shape) ──
      ctx.save();
      ctx.translate(bsX, bsY);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = 'rgba(100,180,255,0.12)';
      ctx.strokeStyle = 'rgba(100,180,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-13, -3, 26, 6);
      ctx.strokeRect(-13, -3, 26, 6);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '700 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('BS', bsX, bsY - 18);
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '8px sans-serif';
      ctx.fillText('Half-silvered mirror', bsX, bsY + 24);

      // ── Source ──
      // Source → BS (entry beam)
      ctx.strokeStyle = `rgba(${lr},${lg2},${lb},${0.45 * powerFactor})`;
      ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(srcX, srcY); ctx.lineTo(bsX, bsY); ctx.stroke();
      ctx.setLineDash([]);
      // Source circle
      ctx.fillStyle = 'rgba(20,40,70,0.7)'; ctx.strokeStyle = `rgba(${lr},${lg2},${lb},0.6)`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(srcX, srcY, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const srcPulse = 0.5 + 0.5 * Math.sin(waveT * 3.2);
      ctx.fillStyle = `rgba(${lr},${lg2},${lb},${srcPulse * powerFactor})`;
      ctx.beginPath(); ctx.arc(srcX, srcY, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${lr},${lg2},${lb},0.8)`; ctx.font = '500 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Light source', srcX, srcY + 26);
      ctx.fillText(`${lamNm.toFixed(0)}nm`, srcX, srcY + 36);

      // ── Detector ──
      const sIntensity = sg.intensity;
      const sIsC = sg.isConstructive;
      const [dR, dG, dB2] = sIsC ? [255, 220, 60] : [57, 255, 20];
      // BS → Detector (output beam)
      ctx.strokeStyle = `rgba(${dR},${dG},${dB2},${(0.3 + sIntensity * 0.4) * powerFactor})`;
      ctx.lineWidth = 1.8; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(bsX, bsY); ctx.lineTo(detX - 20, detY); ctx.stroke();
      ctx.setLineDash([]);
      // Detector block
      ctx.fillStyle = `rgba(${dR},${dG},${dB2},${0.1 + sIntensity * 0.25})`;
      ctx.strokeStyle = '#1D9E75'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(detX - 18, detY - 40, 22, 80); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2dd4a8'; ctx.font = '600 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Photo-', detX - 7, detY - 14);
      ctx.fillText('graphic', detX - 7, detY - 3);
      ctx.fillText('Plate', detX - 7, detY + 9);
      ctx.fillText('(Det.)', detX - 7, detY + 20);
      ctx.fillStyle = `rgba(${dR},${dG},${dB2},0.9)`; ctx.font = '700 8px monospace';
      ctx.fillText(`${(sIntensity * 100).toFixed(0)}%`, detX - 7, detY + 34);
      // Detector halo
      const dGrad2 = ctx.createRadialGradient(detX, detY, 0, detX, detY, 20 + sIntensity * 12);
      dGrad2.addColorStop(0, `rgba(${dR},${dG},${dB2},${0.3 + sIntensity * 0.35})`);
      dGrad2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = dGrad2;
      ctx.beginPath(); ctx.arc(detX, detY, 20 + sIntensity * 12, 0, Math.PI * 2); ctx.fill();

      // ── Top title ──
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '700 11px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('Sagnac Interferometer / FOG', 8, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '8px monospace';
      ctx.fillText('CW: BS→M2→M1→M4→M3→BS   CCW: BS→M3→M4→M1→M2→BS', 8, H - 6);

      // Legend
      const legX = W - 120, legY0 = 28;
      [
        { rgb: [70, 150, 255], l: 'CW beam (blue)' },
        { rgb: [255, 80, 80],  l: 'CCW beam (red)' },
        { rgb: [dR, dG, dB2],  l: sIsC ? '⊕ Constructive' : '⊖ Destructive' },
      ].forEach((lg, i) => {
        ctx.strokeStyle = `rgba(${lg.rgb[0]},${lg.rgb[1]},${lg.rgb[2]},0.9)`;
        ctx.lineWidth = lg.thick || 2;
        const ly = legY0 + i * 14;
        ctx.beginPath(); ctx.moveTo(legX, ly); ctx.lineTo(legX + 14, ly); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '7px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(lg.l, legX + 18, ly + 3);
      });
    };

    raf = requestAnimationFrame(animate);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, []);

  // React-level live values
  const st = useSimulationStore();
  const sg = computeSagnac({
    loopLength: st.sagnacLoopLength,
    loopRadius: st.sagnacLoopRadius,
    numLoops:   st.sagnacNumLoops,
    omega:      st.sagnacOmega,
    wavelength: st.wavelength,
  });
  const C = 299792458, H_PLANCK = 6.626e-34;
  const photonFlux = (st.laserPower * st.wavelength) / (H_PLANCK * C);
  const N = photonFlux * st.detectorExposureTime;
  const snr = N > 0 ? Math.abs(sg.phaseDiff) * Math.sqrt(N) * st.detectorQE : 0;
  const snrDB = snr > 1e-10 ? 10 * Math.log10(snr) : 0;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Badge */}
      <div style={{ position: 'absolute', top: 6, right: 8, zIndex: 2, display: 'flex', gap: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
          background: sg.isConstructive ? 'rgba(255,230,80,0.2)' : 'rgba(57,255,20,0.15)',
          color: sg.isConstructive ? '#ffe650' : '#39ff14',
        }}>
          {sg.isConstructive ? 'Constructive' : 'Destructive'}
        </span>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '3px 8px',
          background: 'rgba(255,255,255,0.05)', borderRadius: 12, color: 'rgba(255,255,255,0.5)' }}>
          ΔN: {sg.fringeShiftMethod1.toExponential(3)}
        </span>
      </div>

      {/* Animate Ω */}
      <div style={{ position: 'absolute', bottom: 48, right: 8, zIndex: 3 }}>
        <button onClick={toggleAnimOmega}
          title="Slowly oscillates Ω between −2 and +2 rad/s (sine, period ≈120s). Watch CW↔CCW speed change."
          style={{
            fontSize: 9, padding: '3px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
            border: `1px solid ${animOmega ? 'rgba(79,156,249,0.5)' : 'rgba(255,255,255,0.12)'}`,
            background: animOmega ? 'rgba(79,156,249,0.18)' : 'rgba(255,255,255,0.06)',
            color: animOmega ? '#4f9cf9' : 'rgba(255,255,255,0.7)',
          }}>
          {animOmega ? '■ Stop Ω' : '▶ Animate Ω'}
        </button>
      </div>

      {/* Physics metrics bar */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', padding: '4px 8px',
        fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.4)',
        position: 'absolute', bottom: 4, left: 4, right: 100, zIndex: 2,
      }}>
        <Tip t="A = N·π·R²">Area: <b style={{ color: '#fff' }}>{sg.area.toFixed(2)} m²</b></Tip>
        <Tip t="ΔN = 4AΩ/(cλ)">ΔFringe: <b style={{ color: '#fff' }}>{sg.fringeShiftMethod1.toExponential(3)}</b></Tip>
        <Tip t="Δt = 4AΩ/c²">Δt: <b style={{ color: '#fff' }}>{sg.dtMethod1.toExponential(3)} s</b></Tip>
        <Tip t="C′ = c − v  where v = Ω·R">CW: <b style={{ color: '#4fa0ff' }}>{sg.cwSpeed.toFixed(0)} m/s</b></Tip>
        <Tip t='C″ = c + v  where v = Ω·R'>CCW: <b style={{ color: '#ff6464' }}>{sg.ccwSpeed.toFixed(0)} m/s</b></Tip>
        <Tip t="v = Ω·R">v: <b style={{ color: '#fff' }}>{sg.tangentialVelocity.toFixed(4)} m/s</b></Tip>
        <Tip t="SNR = |Δφ|·√N·η  (simplified)">SNR: <b style={{ color: '#fff' }}>{snrDB.toFixed(1)} dB</b></Tip>
        <Tip t="I = I₀cos²(Δφ/2)">I: <b style={{ color: '#fff' }}>{(sg.intensity * 100).toFixed(1)}%</b></Tip>
      </div>

      <div ref={containerRef} style={{ position: 'absolute', inset: '28px 4px 66px 4px' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', borderRadius: 8, display: 'block' }} />
      </div>
    </div>
  );
};

const Tip = ({ t, children }) => (
  <span title={t} style={{ cursor: 'help', borderBottom: '1px dotted rgba(255,255,255,0.2)' }}>
    {children}
  </span>
);

export default SagnacScene;
