import React, { useRef, useEffect, useState, useCallback } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { computeSagnac } from '../physics/sagnacModel.js';

/**
 * SagnacScene — Clean Pentagon Perimeter Loop
 *
 * 5 optical elements on the PERIMETER of the disk circle.
 * No interior crossing. Beams travel smoothly around the pentagon.
 *
 *   Pentagon (clockwise from right):
 *     BS  at   0° (right — source/detector arm here)
 *     M2  at  72° (upper-right)
 *     M1  at 144° (upper-left)
 *     M4  at 216° (lower-left)
 *     M3  at 288° (lower-right)
 *
 *   CW  (blue):  BS→M2→M1→M4→M3→BS
 *   CCW (red):   BS→M3→M4→M1→M2→BS
 *
 * Source and Detector are external, connecting to BS via horizontal arms.
 * Physics: Δt = 4AΩ/c²   ΔN = 4AΩ/(cλ)   C'=c−v  C"=c+v
 */

const C_LIGHT = 299792458;

function lambdaToRGB(nm) {
  let r = 0, g = 0, b = 0;
  if      (nm >= 380 && nm <  440) { r = (440-nm)/60; b = 1; }
  else if (nm >= 440 && nm <  490) { g = (nm-440)/50; b = 1; }
  else if (nm >= 490 && nm <  510) { g = 1; b = (510-nm)/20; }
  else if (nm >= 510 && nm <  580) { r = (nm-510)/70; g = 1; }
  else if (nm >= 580 && nm <  645) { r = 1; g = (645-nm)/65; }
  else if (nm >= 645 && nm <= 750) { r = 1; }
  const f = nm < 420 ? 0.3+0.7*(nm-380)/40 : nm > 700 ? 0.3+0.7*(750-nm)/50 : 1;
  return [Math.round(r*f*255), Math.round(g*f*255), Math.round(b*f*255)];
}

/** Draw a sinusoidal wave along a straight segment */
function sineBeam(ctx, x1, y1, x2, y2, waveT, phOff, rgb, alpha, ampPx, freqPpx) {
  const dx = x2-x1, dy = y2-y1, len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx/len, uy = dy/len, px = -uy, py = ux;
  const steps = Math.ceil(len);
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i/steps;
    const bx = x1+ux*len*t, by = y1+uy*len*t;
    const w  = Math.sin(t*len*freqPpx - waveT*4 + phOff) * ampPx;
    if (i===0) ctx.moveTo(bx+px*w, by+py*w);
    else       ctx.lineTo(bx+px*w, by+py*w);
  }
  ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.shadowColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.35)`;
  ctx.shadowBlur = 4; ctx.stroke(); ctx.shadowBlur = 0;
}

/** Draw direction arrow at midpoint of segment */
function arrow(ctx, x1, y1, x2, y2, color, scale=1) {
  const mx=(x1+x2)/2, my=(y1+y2)/2;
  const ang = Math.atan2(y2-y1, x2-x1);
  ctx.save(); ctx.fillStyle = color;
  ctx.translate(mx, my); ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(7*scale,0); ctx.lineTo(-5*scale,3.5*scale); ctx.lineTo(-5*scale,-3.5*scale);
  ctx.closePath(); ctx.fill(); ctx.restore();
}

/** Draw a mirror (thin rotated rectangle) */
function mirror(ctx, cx, cy, color, label) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI/4);
  ctx.fillStyle   = 'rgba(255,255,255,0.07)';
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.fillRect(-16,-4,32,8); ctx.strokeRect(-16,-4,32,8);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-12,12); ctx.lineTo(12,-12); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = '700 10px sans-serif';
  ctx.textAlign = 'center'; ctx.fillText(label, cx, cy-22);
}

export default function SagnacScene() {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const waveTRef     = useRef(0);
  const cwTRef       = useRef(0);    // 0→1 progress (CW)
  const ccwTRef      = useRef(0.5);  // offset so both visible
  const [animateOmega, setAnimateOmega] = useState(false);
  const animRef = useRef(false);

  const toggle = useCallback(() => {
    animRef.current = !animRef.current;
    setAnimateOmega(animRef.current);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;
    let raf, running = true, lastTs = null;

    const loop = (ts) => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (!lastTs) lastTs = ts;
      const dtMs = Math.min(50, ts - lastTs); lastTs = ts;
      const dtS = dtMs / 1000;

      const st = useSimulationStore.getState();
      if (st.simulationPaused) return;

      const W = container.clientWidth, H = container.clientHeight;
      if (W < 10 || H < 10) return;
      if (canvas.width !== W || canvas.height !== H) { canvas.width=W; canvas.height=H; }

      waveTRef.current += dtS * 2;
      const waveT = waveTRef.current;

      // Slow sinusoidal Omega animation — period ≈ 120s
      if (animRef.current) {
        const newOmega = Math.sin(waveT * 0.052) * 2;
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
      const [lr, lg, lb] = lambdaToRGB(lamNm);
      const pf = Math.min(1, st.laserPower / 5e-3);

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle = 'rgba(5,5,5,0.97)'; ctx.fillRect(0,0,W,H);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.018)'; ctx.lineWidth = 0.5;
      for (let x=0;x<W;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for (let y=0;y<H;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

      // ── Pentagon layout ──
      // Disk at canvas center, leaving room for external source/detector on right
      const diskCX = W * 0.42, diskCY = H * 0.50;
      const diskR  = Math.min(W*0.28, H*0.38);

      // 5 vertices at equal 72° spacing, starting at 0° (right)
      // BS=0°, M2=72°, M1=144°, M4=216°, M3=288°
      const toAngle = (deg) => (deg * Math.PI) / 180;
      const vtx = (deg) => ({
        x: diskCX + diskR * Math.cos(toAngle(deg)),
        y: diskCY + diskR * Math.sin(toAngle(deg)),
      });

      const BS = vtx(0);      // right — source/detector arm
      const M2 = vtx(-72);   // upper-right  (−72 = 288 ≡ top-right in screen trig)
      const M1 = vtx(-144);  // upper-left
      const M4 = vtx(144);   // lower-left   (going around CCW)
      const M3 = vtx(72);    // lower-right

      // Pentagon perimeter
      const pentagon = [BS, M2, M1, M4, M3, BS]; // CW order
      const cwPath  = [BS, M2, M1, M4, M3, BS];
      const ccwPath = [BS, M3, M4, M1, M2, BS];

      // ── Disk circle ──
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(diskCX, diskCY, diskR, 0, Math.PI*2); ctx.stroke();

      // Rotation direction arrows on disk rim
      if (Math.abs(omega) > 0.001) {
        const dir = omega > 0 ? 1 : -1;
        [0.3, 0.7].forEach(frac => {
          const a0 = frac * 2*Math.PI, a1 = a0 + dir * 0.45;
          ctx.strokeStyle = omega>0 ? 'rgba(100,200,255,0.4)' : 'rgba(255,100,100,0.4)';
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(diskCX, diskCY, diskR*0.92, a0, a1, omega<0); ctx.stroke();
          const tx = diskCX + diskR*0.92*Math.cos(a1);
          const ty = diskCY + diskR*0.92*Math.sin(a1);
          ctx.fillStyle = omega>0 ? 'rgba(100,200,255,0.7)' : 'rgba(255,100,100,0.7)';
          ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI*2); ctx.fill();
        });
      }

      // Disk center label
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.font = '8px sans-serif'; ctx.textAlign='center';
      ctx.fillText('Rotating Disk', diskCX, diskCY-20);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '700 9px monospace';
      ctx.fillText(`ω=${omega>=0?'+':''}${omega.toFixed(3)} rad/s`, diskCX, diskCY-7);
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '7px monospace';
      ctx.fillText(`A=${sg.area.toFixed(2)} m²`, diskCX, diskCY+6);
      ctx.fillText(`v=${sg.tangentialVelocity.toFixed(4)} m/s`, diskCX, diskCY+17);

      // ── CW and CCW sinusoidal beams along pentagon perimeter ──
      const freq = 0.04, amp = 4 * pf;
      const cwPh  = sg.phaseDiff * 0.5;
      const ccwPh = -sg.phaseDiff * 0.5;

      for (let i = 0; i < cwPath.length-1; i++) {
        sineBeam(ctx,
          cwPath[i].x,  cwPath[i].y,
          cwPath[i+1].x, cwPath[i+1].y,
          waveT, cwPh + i*1.2, [70,150,255], 0.55*pf, amp, freq);
        arrow(ctx, cwPath[i].x, cwPath[i].y, cwPath[i+1].x, cwPath[i+1].y, 'rgba(70,150,255,0.8)');
      }
      for (let i = 0; i < ccwPath.length-1; i++) {
        sineBeam(ctx,
          ccwPath[i].x,  ccwPath[i].y,
          ccwPath[i+1].x, ccwPath[i+1].y,
          waveT, ccwPh + i*1.2, [255,80,80], 0.50*pf, amp, freq);
        arrow(ctx, ccwPath[i].x, ccwPath[i].y, ccwPath[i+1].x, ccwPath[i+1].y, 'rgba(255,80,80,0.8)');
      }

      // ── Photon particles (CW blue, CCW red) ──
      const relCW  = sg.cwSpeed  / C_LIGHT;
      const relCCW = sg.ccwSpeed / C_LIGHT;
      cwTRef.current  = (cwTRef.current  + dtS * 0.09 * relCW)  % 1;
      ccwTRef.current = (ccwTRef.current + dtS * 0.09 * relCCW) % 1;

      const getPt = (path, t) => {
        const segs = path.length - 1;
        const idx  = Math.min(segs-1, Math.floor(t * segs));
        const frac = t * segs - idx;
        return {
          x: path[idx].x + frac*(path[idx+1].x - path[idx].x),
          y: path[idx].y + frac*(path[idx+1].y - path[idx].y),
        };
      };

      const drawPhoton = (x, y, cr, cg, cb) => {
        const g2 = ctx.createRadialGradient(x,y,0,x,y,13);
        g2.addColorStop(0, `rgba(${cr},${cg},${cb},${0.9*pf})`);
        g2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(x,y,13,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x,y,2.5,0,Math.PI*2); ctx.fill();
        // γ label
        ctx.fillStyle = `rgba(${cr},${cg},${cb},0.65)`;
        ctx.font = '700 8px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('γ', x, y-15);
      };

      const cwPt  = getPt(cwPath,  cwTRef.current);
      const ccwPt = getPt(ccwPath, ccwTRef.current);
      drawPhoton(cwPt.x,  cwPt.y,  70,  150, 255);
      drawPhoton(ccwPt.x, ccwPt.y, 255, 80,  80);

      // ── Mirrors ──
      mirror(ctx, M1.x, M1.y, 'rgba(255,255,255,0.5)', 'M1');
      mirror(ctx, M2.x, M2.y, 'rgba(255,255,255,0.5)', 'M2');
      mirror(ctx, M3.x, M3.y, 'rgba(255,255,255,0.5)', 'M3');
      mirror(ctx, M4.x, M4.y, 'rgba(255,255,255,0.5)', 'M4');

      // ── BS (on perimeter at 0°) ──
      ctx.save(); ctx.translate(BS.x, BS.y); ctx.rotate(Math.PI/4);
      ctx.fillStyle = 'rgba(100,180,255,0.12)';
      ctx.strokeStyle = 'rgba(100,180,255,0.75)'; ctx.lineWidth = 1.8;
      ctx.fillRect(-14,-3,28,6); ctx.strokeRect(-14,-3,28,6);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '700 10px sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('BS', BS.x+20, BS.y-14);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '7px sans-serif';
      ctx.fillText('Half-silvered', BS.x+20, BS.y-3);

      // ── External source (below-right, outside circle) ──
      const srcX = BS.x + 60, srcY = BS.y + 50;
      // source → BS (dashed entry)
      ctx.strokeStyle = `rgba(${lr},${lg},${lb},${0.5*pf})`;
      ctx.lineWidth = 1.5; ctx.setLineDash([5,4]);
      ctx.beginPath(); ctx.moveTo(srcX, srcY); ctx.lineTo(BS.x+4, BS.y+4); ctx.stroke();
      ctx.setLineDash([]);
      // Source circle
      ctx.fillStyle = 'rgba(20,40,70,0.75)';
      ctx.strokeStyle = `rgba(${lr},${lg},${lb},0.65)`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(srcX, srcY, 13, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      const pulse = 0.5 + 0.5*Math.sin(waveT*3.2);
      ctx.fillStyle = `rgba(${lr},${lg},${lb},${pulse*pf})`;
      ctx.beginPath(); ctx.arc(srcX, srcY, 4.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = `rgba(${lr},${lg},${lb},0.8)`;
      ctx.font = '500 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Source', srcX, srcY+26);
      ctx.fillText(`${lamNm.toFixed(0)} nm`, srcX, srcY+35);

      // ── Detector (external, right side) ──
      const detX = diskCX + diskR + 72, detY = BS.y;
      const sI = sg.intensity, sIsC = sg.isConstructive;
      const [dR, dG, dB] = sIsC ? [255,220,60] : [57,255,20];

      // BS → detector (dashed, intensity-coded)
      ctx.strokeStyle = `rgba(${dR},${dG},${dB},${(0.35+sI*0.45)*pf})`;
      ctx.lineWidth = 1.5; ctx.setLineDash([5,4]);
      ctx.beginPath(); ctx.moveTo(BS.x+14, BS.y); ctx.lineTo(detX-18, detY); ctx.stroke();
      ctx.setLineDash([]);

      // Detector block
      ctx.fillStyle = `rgba(${dR},${dG},${dB},${0.1+sI*0.2})`;
      ctx.strokeStyle = '#1D9E75'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(detX-16, detY-38, 20, 76); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2dd4a8'; ctx.font = '600 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Photo-', detX-6, detY-15);
      ctx.fillText('graphic', detX-6, detY-4);
      ctx.fillText('Plate', detX-6, detY+8);
      ctx.fillStyle = `rgba(${dR},${dG},${dB},0.9)`; ctx.font = '700 8px monospace';
      ctx.fillText(`${(sI*100).toFixed(0)}%`, detX-6, detY+24);
      // Glow
      const dHalo = ctx.createRadialGradient(detX,detY,0,detX,detY,20+sI*14);
      dHalo.addColorStop(0, `rgba(${dR},${dG},${dB},${0.3+sI*0.35})`);
      dHalo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = dHalo;
      ctx.beginPath(); ctx.arc(detX,detY,20+sI*14,0,Math.PI*2); ctx.fill();

      // ── Labels ──
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font='700 11px sans-serif'; ctx.textAlign='left';
      ctx.fillText('Sagnac Interferometer / FOG', 8, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font='7px monospace';
      ctx.fillText('CW(blue): BS→M2→M1→M4→M3→BS   CCW(red): BS→M3→M4→M1→M2→BS', 8, H-6);

      // Legend
      const legX = W-130, legY = 22;
      [[70,150,255,'CW beam'],[255,80,80,'CCW beam'],[dR,dG,dB,sIsC?'⊕ Constructive':'⊖ Destructive']].forEach(([r2,g2,b2,l],i)=>{
        const lY = legY + i*13;
        ctx.strokeStyle=`rgba(${r2},${g2},${b2},0.9)`; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(legX,lY); ctx.lineTo(legX+13,lY); ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.font='7px sans-serif'; ctx.textAlign='left';
        ctx.fillText(l, legX+17, lY+3);
      });
    };

    raf = requestAnimationFrame(loop);
    return () => { running=false; cancelAnimationFrame(raf); };
  }, []);

  // Live React-level metrics
  const st = useSimulationStore();
  const sg = computeSagnac({
    loopLength: st.sagnacLoopLength, loopRadius: st.sagnacLoopRadius,
    numLoops: st.sagnacNumLoops, omega: st.sagnacOmega, wavelength: st.wavelength,
  });

  return (
    <div style={{ width:'100%', height:'100%', position:'relative' }}>
      {/* Badge */}
      <div style={{ position:'absolute', top:6, right:8, zIndex:2, display:'flex', gap:6 }}>
        <span style={{
          fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:20,
          background: sg.isConstructive ? 'rgba(255,230,80,0.2)' : 'rgba(57,255,20,0.15)',
          color: sg.isConstructive ? '#ffe650' : '#39ff14',
        }}>
          {sg.isConstructive ? 'Constructive' : 'Destructive'}
        </span>
        <span style={{ fontSize:9, fontFamily:'var(--font-mono)', padding:'3px 8px',
          background:'rgba(255,255,255,0.05)', borderRadius:12, color:'rgba(255,255,255,0.5)' }}>
          ΔN: {sg.fringeShiftMethod1.toExponential(3)}
        </span>
      </div>

      {/* Animate Ω */}
      <div style={{ position:'absolute', bottom:48, right:8, zIndex:3 }}>
        <button onClick={toggle}
          title="Slowly oscillates Ω between −2 and +2 rad/s  (period ≈120 s)"
          style={{
            fontSize:9, padding:'3px 12px', borderRadius:6, cursor:'pointer',
            fontWeight:600, fontFamily:'inherit',
            border:`1px solid ${animateOmega ? 'rgba(79,156,249,0.5)':'rgba(255,255,255,0.12)'}`,
            background: animateOmega ? 'rgba(79,156,249,0.18)':'rgba(255,255,255,0.06)',
            color: animateOmega ? '#4f9cf9':'rgba(255,255,255,0.7)',
          }}>
          {animateOmega ? '■ Stop Ω' : '▶ Animate Ω'}
        </button>
      </div>

      {/* Physics metrics */}
      <div style={{
        display:'flex', gap:10, flexWrap:'wrap', padding:'4px 8px',
        fontSize:8, fontFamily:'var(--font-mono)', color:'rgba(255,255,255,0.4)',
        position:'absolute', bottom:4, left:4, right:104, zIndex:2,
      }}>
        {[
          ['A = N·π·R²',            'Area',    `${sg.area.toFixed(2)} m²`],
          ['ΔN = 4AΩ/(cλ)',         'ΔFringe', sg.fringeShiftMethod1.toExponential(3)],
          ['Δt = 4AΩ/c²',          'Δt',      `${sg.dtMethod1.toExponential(3)} s`],
          ['C′ = c − v  (v = Ω·R)','CW',      `${sg.cwSpeed.toFixed(0)} m/s`],
          ['C″ = c + v',           'CCW',     `${sg.ccwSpeed.toFixed(0)} m/s`],
          ['v = Ω·R',              'v',       `${sg.tangentialVelocity.toFixed(4)} m/s`],
          ['I = I₀cos²(Δφ/2)',     'I',       `${(sg.intensity*100).toFixed(1)}%`],
        ].map(([tip, lbl, val]) => (
          <span key={lbl} title={tip}
            style={{ cursor:'help', borderBottom:'1px dotted rgba(255,255,255,0.2)' }}>
            {lbl}: <b style={{ color:'#fff' }}>{val}</b>
          </span>
        ))}
      </div>

      <div ref={containerRef} style={{ position:'absolute', inset:'28px 4px 66px 4px' }}>
        <canvas ref={canvasRef} style={{width:'100%',height:'100%',borderRadius:8,display:'block'}} />
      </div>
    </div>
  );
}
