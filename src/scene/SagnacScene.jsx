import React, { useRef, useEffect, useState, useCallback } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { computeSagnac } from '../physics/sagnacModel.js';

/**
 * SagnacScene — Sagnac Interferometer / Fibre-Optic Gyroscope
 * 
 * Circular optical path with 4 mirrors on a rotating disk.
 * CW (blue) and CCW (red) counter-propagating beams.
 */

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

const SagnacScene = () => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const waveTRef = useRef(0);
  const [animOmega, setAnimOmega] = useState(false);
  const animOmegaRef = useRef(false);

  const toggleAnimOmega = useCallback(() => {
    animOmegaRef.current = !animOmegaRef.current;
    setAnimOmega(animOmegaRef.current);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    let raf;
    let running = true;

    const animate = () => {
      if (!running) return;
      raf = requestAnimationFrame(animate);

      const st = useSimulationStore.getState();
      if (st.simulationPaused) return;

      const W = container.clientWidth;
      const H = container.clientHeight;
      if (W < 10 || H < 10) return;

      // Resize canvas to match container
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }

      waveTRef.current += 0.016 * 2;
      const waveT = waveTRef.current;

      // Animate omega via ref (no setParam in RAF — use local override)
      let omega = st.sagnacOmega;
      if (animOmegaRef.current) {
        omega = Math.sin(waveT * 0.3) * 5;
      }

      const ctx = canvas.getContext('2d');
      const lamNm = st.wavelength * 1e9;
      const [lr, lg, lb] = lambdaToRGB(lamNm);
      const powerFactor = Math.min(1, st.laserPower / 0.01);

      // Compute Sagnac
      const sg = computeSagnac({
        loopLength: st.sagnacLoopLength,
        loopRadius: st.sagnacLoopRadius,
        numLoops: st.sagnacNumLoops,
        omega: omega,
        wavelength: st.wavelength,
      });

      // Clear
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(5,5,5,0.95)';
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.02)';
      ctx.lineWidth = 0.5;
      for (let gx = 0; gx < W; gx += 30) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (let gy = 0; gy < H; gy += 30) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

      // Layout
      const cx = W * 0.45, cy = H * 0.48;
      const diskR = Math.min(W, H) * 0.3;
      const plateR = diskR + 20;
      const mirrorSize = 10;
      const pathR = diskR * 0.7;

      // Corners (square path)
      const corners = [
        { x: cx - pathR, y: cy - pathR, label: 'M1' },
        { x: cx + pathR, y: cy - pathR, label: 'M2' },
        { x: cx + pathR, y: cy + pathR, label: 'M3' },
        { x: cx - pathR, y: cy + pathR, label: 'M4' },
      ];

      const bsX = cx - pathR, bsY = cy;
      const srcX = bsX - 36, srcY = cy + 25;
      const detX = cx + pathR + 36, detY = cy;

      // Stationary plate circle
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, plateR, 0, Math.PI * 2); ctx.stroke();

      // Rotating disk outline
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(cx, cy, diskR, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);

      // Rotation indicator
      if (Math.abs(omega) > 0.001) {
        const diskRotation = omega * waveT * 0.3;
        const arrowAngle = diskRotation % (Math.PI * 2);
        const arrowR = diskR - 8;
        const arrowLen = 0.3;
        ctx.strokeStyle = omega > 0 ? 'rgba(100,200,255,0.25)' : 'rgba(255,100,100,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, arrowR, arrowAngle, arrowAngle + (omega > 0 ? arrowLen : -arrowLen));
        ctx.stroke();
        const tipAngle = arrowAngle + (omega > 0 ? arrowLen : -arrowLen);
        const tx = cx + arrowR * Math.cos(tipAngle), ty = cy + arrowR * Math.sin(tipAngle);
        ctx.fillStyle = omega > 0 ? 'rgba(100,200,255,0.4)' : 'rgba(255,100,100,0.4)';
        ctx.beginPath(); ctx.arc(tx, ty, 3, 0, Math.PI * 2); ctx.fill();
      }

      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Rotating Disk', cx, cy - 6);
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '8px monospace';
      ctx.fillText(`ω = ${omega.toFixed(2)} rad/s`, cx, cy + 8);

      // Draw wave paths
      const drawWaveSeg = (from, to, phOffset, r2, g2, b2, alpha, dir) => {
        const dx = to.x - from.x, dy = to.y - from.y;
        const len = Math.hypot(dx, dy);
        if (len < 2) return;
        const ux = dx / len, uy = dy / len, px = -uy, py = ux;
        const freq = 0.05, amp = 6 * powerFactor;
        ctx.beginPath();
        for (let i = 0; i <= len; i += 2) {
          const w = Math.sin(i * freq + phOffset - waveT * 2 * dir) * amp;
          const xx = from.x + ux * i + px * w, yy = from.y + uy * i + py * w;
          if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
        }
        ctx.strokeStyle = `rgba(${r2},${g2},${b2},${alpha * powerFactor})`;
        ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
      };

      // Arrow helper
      const drawArrow = (from, to, color) => {
        const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
        const dx = to.x - from.x, dy = to.y - from.y;
        const len = Math.hypot(dx, dy);
        ctx.save();
        ctx.fillStyle = color;
        ctx.translate(mx, my);
        ctx.rotate(Math.atan2(dy / len, dx / len));
        ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, 3); ctx.lineTo(-3, -3); ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      // CW beams (blue)
      const cwPts = [corners[0], corners[1], corners[2], corners[3]];
      const cwPh = sg.phaseDiff * 0.5;
      for (let i = 0; i < cwPts.length; i++) {
        drawWaveSeg(cwPts[i], cwPts[(i + 1) % cwPts.length], cwPh + i * 1.5, 80, 160, 255, 0.5, 1);
        drawArrow(cwPts[i], cwPts[(i + 1) % cwPts.length], 'rgba(80,160,255,0.35)');
      }

      // CCW beams (red)
      const ccwPts = [corners[0], corners[3], corners[2], corners[1]];
      const ccwPh = -sg.phaseDiff * 0.5;
      for (let i = 0; i < ccwPts.length; i++) {
        drawWaveSeg(ccwPts[i], ccwPts[(i + 1) % ccwPts.length], ccwPh + i * 1.5, 255, 100, 100, 0.5, -1);
        drawArrow(ccwPts[i], ccwPts[(i + 1) % ccwPts.length], 'rgba(255,100,100,0.35)');
      }

      // Mirrors
      corners.forEach(c => {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.rect(c.x - mirrorSize, c.y - mirrorSize, mirrorSize * 2, mirrorSize * 2);
        ctx.fill(); ctx.stroke();
        // Diagonal line (mirror surface)
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(c.x - mirrorSize * 0.5, c.y + mirrorSize * 0.5);
        ctx.lineTo(c.x + mirrorSize * 0.5, c.y - mirrorSize * 0.5); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '600 9px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(c.label, c.x, c.y - mirrorSize - 4);
      });

      // Beam splitter
      ctx.save(); ctx.translate(bsX, bsY); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = 'rgba(100,180,255,0.12)'; ctx.strokeStyle = 'rgba(100,180,255,0.5)'; ctx.lineWidth = 1.5;
      ctx.fillRect(-12, -2, 24, 4); ctx.strokeRect(-12, -2, 24, 4);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '500 7px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Half-silvered', bsX, bsY + 20);
      ctx.fillText('mirror', bsX, bsY + 28);

      // Light source
      ctx.fillStyle = 'rgba(20,40,70,0.6)'; ctx.strokeStyle = `rgba(${lr},${lg},${lb},0.5)`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(srcX, srcY, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const pulse = 0.5 + 0.5 * Math.sin(waveT * 3);
      ctx.fillStyle = `rgba(${lr},${lg},${lb},${pulse * powerFactor})`;
      ctx.beginPath(); ctx.arc(srcX, srcY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${lr},${lg},${lb},0.8)`; ctx.font = '500 7px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Source', srcX, srcY + 22);

      // Source → BS beam
      ctx.strokeStyle = `rgba(${lr},${lg},${lb},${0.4 * powerFactor})`; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(srcX + 12, srcY - 8); ctx.lineTo(bsX - 5, bsY + 5); ctx.stroke();
      ctx.setLineDash([]);

      // Detector
      const detW = 16, detH = 40;
      ctx.fillStyle = sg.isConstructive
        ? `rgba(255,220,60,${0.15 + sg.cosVal * 0.25})`
        : `rgba(57,255,20,${0.1 + (1 - sg.cosVal) * 0.2})`;
      ctx.strokeStyle = '#1D9E75'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(detX - detW / 2, detY - detH / 2, detW, detH); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2dd4a8'; ctx.font = '500 7px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Detector', detX, detY + detH / 2 + 10);

      // Detector halo
      const detHaloR = 16 + sg.cosVal * 12;
      const detGrad = ctx.createRadialGradient(detX, detY, 0, detX, detY, detHaloR);
      if (sg.isConstructive) {
        detGrad.addColorStop(0, `rgba(255,230,80,${0.3 + sg.cosVal * 0.4})`);
        detGrad.addColorStop(1, 'rgba(255,200,0,0)');
      } else {
        detGrad.addColorStop(0, `rgba(57,255,20,${0.2 + (1 - sg.cosVal) * 0.3})`);
        detGrad.addColorStop(1, 'rgba(57,255,20,0)');
      }
      ctx.fillStyle = detGrad;
      ctx.beginPath(); ctx.arc(detX, detY, detHaloR, 0, Math.PI * 2); ctx.fill();

      // BS → detector beam
      ctx.strokeStyle = `rgba(${lr},${lg},${lb},${0.3 * powerFactor})`; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(bsX + 5, bsY); ctx.lineTo(detX - detW / 2 - 3, detY); ctx.stroke();
      ctx.setLineDash([]);

      // Info
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '500 9px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`λ=${Math.round(lamNm)}nm  R=${st.sagnacLoopRadius.toFixed(2)}m  N=${Math.round(st.sagnacNumLoops)}`, 6, 14);

      // Formula
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
      ctx.fillText('Δt = 4AΩ/c²   ΔN = 4AΩ/(cλ)', 6, H - 6);

      // Legend
      const legX = W - 110, legY0 = 20;
      const legs = [
        { r: 80, g: 160, b: 255, l: 'CW beam' },
        { r: 255, g: 100, b: 100, l: 'CCW beam' },
        { r: 255, g: 230, b: 80, l: 'Constructive' },
        { r: 57, g: 255, b: 20, l: 'Destructive' },
      ];
      legs.forEach((lg2, i) => {
        const ly = legY0 + i * 12;
        ctx.strokeStyle = `rgba(${lg2.r},${lg2.g},${lg2.b},0.9)`;
        ctx.lineWidth = i >= 2 ? 4 : 2;
        ctx.beginPath(); ctx.moveTo(legX, ly); ctx.lineTo(legX + 12, ly); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '7px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(lg2.l, legX + 16, ly + 3);
      });
    };

    raf = requestAnimationFrame(animate);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, []);

  // React-level computed values for overlays
  const st = useSimulationStore();
  const sagnac = computeSagnac({
    loopLength: st.sagnacLoopLength,
    loopRadius: st.sagnacLoopRadius,
    numLoops: st.sagnacNumLoops,
    omega: st.sagnacOmega,
    wavelength: st.wavelength,
  });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Title */}
      <div style={{ position: 'absolute', top: 6, left: 8, zIndex: 2, pointerEvents: 'none' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Sagnac Interferometer / FOG
        </div>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>
          Counter-propagating beams
        </div>
      </div>

      {/* Badge */}
      <div style={{ position: 'absolute', top: 6, right: 8, zIndex: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
          background: sagnac.isConstructive ? 'rgba(255,230,80,0.2)' : 'rgba(57,255,20,0.15)',
          color: sagnac.isConstructive ? '#ffe650' : '#39ff14',
        }}>
          {sagnac.cosVal > 0.75 ? 'Constructive' : sagnac.cosVal < 0.25 ? 'Destructive' : 'Partial'}
        </span>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.4)' }}>
          ΔN: {sagnac.fringeShiftMethod1.toExponential(3)}
        </span>
      </div>

      {/* Controls */}
      <div style={{ position: 'absolute', bottom: 28, right: 8, zIndex: 3 }}>
        <button onClick={toggleAnimOmega} style={{
          fontSize: 9, padding: '3px 10px', borderRadius: 6,
          border: `1px solid ${animOmega ? 'rgba(79,156,249,0.5)' : 'rgba(255,255,255,0.12)'}`,
          background: animOmega ? 'rgba(79,156,249,0.15)' : 'rgba(255,255,255,0.06)',
          color: animOmega ? '#4f9cf9' : 'rgba(255,255,255,0.7)',
          cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
        }}>
          {animOmega ? 'Stop Ω' : 'Animate Ω'}
        </button>
      </div>

      {/* Metrics */}
      <div style={{
        display: 'flex', gap: 8, padding: '4px 8px', flexWrap: 'wrap',
        fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.4)',
        position: 'absolute', bottom: 4, left: 4, right: 4, zIndex: 2,
      }}>
        <span>Area: <b style={{ color: '#fff' }}>{sagnac.area.toFixed(2)} m²</b></span>
        <span>ΔFringe: <b style={{ color: '#fff' }}>{sagnac.fringeShiftMethod1.toExponential(3)}</b></span>
        <span>Δt: <b style={{ color: '#fff' }}>{sagnac.dtMethod1.toExponential(3)} s</b></span>
        <span>CW: <b style={{ color: '#4fa0ff' }}>{sagnac.cwSpeed.toFixed(2)} m/s</b></span>
        <span>CCW: <b style={{ color: '#ff6464' }}>{sagnac.ccwSpeed.toFixed(2)} m/s</b></span>
        <span>Ω: <b style={{ color: '#fff' }}>{st.sagnacOmega.toFixed(3)} rad/s</b></span>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ position: 'absolute', inset: '28px 4px 46px 4px' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', borderRadius: 8, display: 'block' }} />
      </div>
    </div>
  );
};

export default SagnacScene;
