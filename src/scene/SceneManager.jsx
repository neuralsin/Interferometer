import React, { useRef, useEffect, useCallback, useState } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { generateFringePattern, wavelengthToColor, detectionProbabilities } from '../physics/basicInterference.js';
import { fringeVisibility } from '../physics/coherenceModel.js';

/**
 * SceneManager — Mach-Zehnder Interferometer (MZI)
 *
 * Layout (matching reference diagram):
 *         D1 (up)
 *         ↑
 * M1 ───→ BS2 ──→ D2 (right)
 * ↑       ↑
 * │       │
 * BS1 →[PS]→ M2
 * ↑
 * INPUT
 *
 * Features: drag-and-drop components, animated photons, dual detectors,
 * phase shifter, all params affect physics
 */

const GRID = 20; // snap grid
const snap = (v) => Math.round(v / GRID) * GRID;

// Path utilities
const pathLen = (pts) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return l;
};
const interpPt = (pts, t) => {
  const total = pathLen(pts);
  let tgt = t * total, acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc + seg >= tgt) {
      const f = (tgt - acc) / seg;
      return { x: pts[i - 1].x + f * (pts[i].x - pts[i - 1].x), y: pts[i - 1].y + f * (pts[i].y - pts[i - 1].y) };
    }
    acc += seg;
  }
  return pts[pts.length - 1];
};

const SceneManager = () => {
  const canvasRef = useRef(null);
  const simRef = useRef({
    photons: [], flashes: [],
    waveT: 0, autoQ: 0, continuous: false, continuousTimer: 0,
  });
  const [, forceRender] = useState(0);

  // Draggable component positions (in virtual 700x440 space)
  const [positions, setPositions] = useState({
    BS1: { x: 150, y: 310 },
    M1:  { x: 150, y: 100 },
    M2:  { x: 520, y: 310 },
    BS2: { x: 520, y: 100 },
    PS:  { x: 340, y: 310 },
  });
  const dragRef = useRef({ dragging: null, offsetX: 0, offsetY: 0 });

  const state = useSimulationStore();

  // Derived positions for static endpoints
  const INPUT = { x: 40, y: positions.BS1.y };
  const D1 = { x: positions.BS2.x, y: 30 };
  const D2 = { x: 660, y: positions.BS2.y };

  // Compute OPD from arm lengths
  const arm1Len = Math.hypot(positions.M1.x - positions.BS1.x, positions.M1.y - positions.BS1.y)
                + Math.hypot(positions.BS2.x - positions.M1.x, positions.BS2.y - positions.M1.y);
  const arm2Len = Math.hypot(positions.PS.x - positions.BS1.x, positions.PS.y - positions.BS1.y)
                + Math.hypot(positions.M2.x - positions.PS.x, positions.M2.y - positions.PS.y)
                + Math.hypot(positions.BS2.x - positions.M2.x, positions.BS2.y - positions.M2.y);
  // Scale virtual units to meters (1 virtual unit ≈ 0.5mm)
  const scale = 0.0005;
  const armXphys = arm1Len * scale;
  const armYphys = arm2Len * scale;
  const mirrorTipOPD = (state.mirror1Tip + state.mirror2Tip) * armXphys;
  const compensatorOPD = state.compensatorEnabled ? 0 : (state.bsRefractiveIndex - 1) * state.bsThickness;
  const opd = (armXphys - armYphys) + mirrorTipOPD + compensatorOPD;

  // Build photon path through MZI
  const buildPhoton = useCallback(() => {
    const P = positions;
    const { p1 } = detectionProbabilities(state.wavelength, opd);
    const vis = fringeVisibility(opd, state.laserLinewidth);
    const effectiveP1 = p1 * vis + 0.5 * (1 - vis);
    const goD1 = Math.random() < effectiveP1;

    // Choose arm at BS1 (cosmetic — both arms lead to BS2)
    const goUpper = Math.random() < state.bsReflectivity;
    let path;
    if (goUpper) {
      // Reflected up: BS1 → M1 → BS2
      path = [INPUT, P.BS1, P.M1, P.BS2];
    } else {
      // Transmitted right: BS1 → PS → M2 → BS2
      path = [INPUT, P.BS1, P.PS, P.M2, P.BS2];
    }
    // After BS2: go to D1 or D2 based on interference
    if (goD1) {
      path.push(D1);
    } else {
      path.push(D2);
    }
    return { path, goD1, progress: 0, prevPos: null, speed: 0.25 + Math.random() * 0.12, arm: goUpper ? 1 : 2 };
  }, [positions, state.wavelength, state.laserLinewidth, state.bsReflectivity, state.mirror1Tip, state.mirror2Tip, state.compensatorEnabled, opd, INPUT, D1, D2]);

  const fireOne = useCallback(() => { simRef.current.photons.push(buildPhoton()); }, [buildPhoton]);
  const fireN = useCallback((n) => { simRef.current.autoQ += n; }, []);
  const resetCounts = useCallback(() => {
    const sim = simRef.current;
    sim.photons = []; sim.flashes = []; sim.autoQ = 0; sim.continuous = false; sim.continuousTimer = 0;
    useSimulationStore.getState().resetSimCounts();
    forceRender(r => r + 1);
  }, []);
  const toggleContinuous = useCallback(() => {
    simRef.current.continuous = !simRef.current.continuous;
    forceRender(r => r + 1);
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let animFrame, lastTs = null;

    const animate = (ts) => {
      animFrame = requestAnimationFrame(animate);
      if (!lastTs) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      const sim = simRef.current;

      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const W = parent.clientWidth, H = parent.clientHeight;
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      }
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.scale(dpr, dpr);

      const sf = Math.min(W / 700, H / 440);
      const ox = (W - 700 * sf) / 2, oy = (H - 440 * sf) / 2;
      const px = (x) => ox + x * sf;
      const py = (y) => oy + y * sf;
      const ps = (s) => s * sf;

      const st = useSimulationStore.getState();
      const wlColor = wavelengthToColor(st.wavelength);
      const powerFactor = Math.min(1, st.laserPower / 0.01);
      const P = positions; // current positions

      ctx.clearRect(0, 0, W, H);

      // Subtle grid
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // ── Guide beam paths (dashed) ──
      const drawGuide = (...pts) => {
        ctx.save();
        ctx.setLineDash([ps(4), ps(6)]);
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = ps(0.8);
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(px(p.x), py(p.y)) : ctx.lineTo(px(p.x), py(p.y)));
        ctx.stroke();
        ctx.restore();
      };
      // Arm 1: BS1 → M1 → BS2
      drawGuide(INPUT, P.BS1, P.M1, P.BS2, D1);
      // Arm 2: BS1 → PS → M2 → BS2
      drawGuide(P.BS1, P.PS, P.M2, P.BS2, D2);

      // ── Solid beam paths (glow) ──
      const drawBeamPath = (from, to, alpha) => {
        const a = alpha * powerFactor;
        if (a < 0.01) return;
        ctx.save();
        ctx.strokeStyle = wlColor;
        ctx.globalAlpha = a * 0.35;
        ctx.lineWidth = ps(2);
        ctx.shadowColor = wlColor;
        ctx.shadowBlur = ps(5) * powerFactor;
        ctx.beginPath();
        ctx.moveTo(px(from.x), py(from.y)); ctx.lineTo(px(to.x), py(to.y));
        ctx.stroke();
        ctx.restore();
      };
      drawBeamPath(INPUT, P.BS1, 1.0);
      drawBeamPath(P.BS1, P.M1, st.bsReflectivity);
      drawBeamPath(P.M1, P.BS2, st.bsReflectivity * st.mirror1Reflectivity);
      drawBeamPath(P.BS1, P.PS, st.bsTransmissivity);
      drawBeamPath(P.PS, P.M2, st.bsTransmissivity);
      drawBeamPath(P.M2, P.BS2, st.bsTransmissivity * st.mirror2Reflectivity);
      drawBeamPath(P.BS2, D1, 0.5);
      drawBeamPath(P.BS2, D2, 0.5);

      // ── Draw components ──
      const drawBS = (pos, label) => {
        const r = ps(16);
        ctx.save();
        ctx.translate(px(pos.x), py(pos.y));
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = 'rgba(100,140,220,0.08)';
        ctx.strokeStyle = 'rgba(100,140,220,0.35)';
        ctx.lineWidth = ps(1.2);
        ctx.beginPath(); ctx.rect(-r, -r, r * 2, r * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(100,140,220,0.7)';
        ctx.lineWidth = ps(2);
        ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.7); ctx.lineTo(r * 0.7, -r * 0.7); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = `600 ${ps(10)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(label, px(pos.x), py(pos.y) - r - ps(6));
      };

      const drawMirror = (pos, label, armLen, tipVal) => {
        const r = ps(13);
        ctx.save();
        ctx.translate(px(pos.x), py(pos.y));
        // Tilt mirror based on tip angle (visual only, scaled up for visibility)
        const tiltAngle = Math.PI / 4 + tipVal * 200;
        ctx.rotate(tiltAngle);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = ps(1.2);
        ctx.beginPath(); ctx.rect(-r, -r, r * 2, r * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = ps(2.5);
        ctx.beginPath(); ctx.moveTo(-r * 0.65, r * 0.65); ctx.lineTo(r * 0.65, -r * 0.65); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = `600 ${ps(10)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(label, px(pos.x), py(pos.y) - r - ps(6));
        ctx.font = `${ps(8)}px monospace`;
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText(`${(armLen * 1e3).toFixed(1)}mm`, px(pos.x), py(pos.y) - r - ps(16));
        if (tipVal !== 0) {
          ctx.fillText(`tip: ${(tipVal * 1e3).toFixed(2)}mrad`, px(pos.x), py(pos.y) + r + ps(14));
        }
      };

      const drawDetector = (pos, label, count, isFlashing) => {
        const w = ps(44), h = ps(32);
        if (isFlashing) {
          const g = ctx.createRadialGradient(px(pos.x), py(pos.y), 0, px(pos.x), py(pos.y), ps(35));
          g.addColorStop(0, label === 'D1' ? 'rgba(45,212,168,0.35)' : 'rgba(79,156,249,0.35)');
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(px(pos.x), py(pos.y), ps(35), 0, Math.PI * 2); ctx.fill();
        }
        const color = label === 'D1' ? '#2dd4a8' : '#4f9cf9';
        ctx.fillStyle = isFlashing ? `${color}22` : 'rgba(255,255,255,0.04)';
        ctx.strokeStyle = color;
        ctx.lineWidth = ps(isFlashing ? 2 : 1.2);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(px(pos.x) - w / 2, py(pos.y) - h / 2, w, h, ps(5));
        else ctx.rect(px(pos.x) - w / 2, py(pos.y) - h / 2, w, h);
        ctx.fill(); ctx.stroke();
        // Dot indicator
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(px(pos.x), py(pos.y) - ps(4), ps(4), 0, Math.PI * 2); ctx.fill();
        // Labels
        ctx.fillStyle = color;
        ctx.font = `700 ${ps(10)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(label, px(pos.x), py(pos.y) + ps(10));
        ctx.font = `${ps(8)}px monospace`;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText(`${count}`, px(pos.x), py(pos.y) + h / 2 + ps(12));
      };

      // Source
      const srcR = ps(14);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.strokeStyle = wlColor;
      ctx.lineWidth = ps(1.5);
      ctx.beginPath(); ctx.arc(px(INPUT.x), py(INPUT.y), srcR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      sim.waveT += dt;
      const pulse = 0.6 + 0.4 * Math.sin(sim.waveT * 3);
      ctx.fillStyle = wlColor; ctx.globalAlpha = pulse * powerFactor;
      ctx.beginPath(); ctx.arc(px(INPUT.x), py(INPUT.y), ps(4), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = `500 ${ps(9)}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('INPUT', px(INPUT.x), py(INPUT.y) + srcR + ps(12));
      ctx.font = `${ps(7)}px monospace`; ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillText(`${(st.wavelength * 1e9).toFixed(0)}nm`, px(INPUT.x), py(INPUT.y) + srcR + ps(21));

      // Beam splitters
      drawBS(P.BS1, 'BS₁');
      drawBS(P.BS2, 'BS₂');

      // Phase Shifter
      const psW = ps(30), psH = ps(20);
      ctx.fillStyle = 'rgba(167,139,250,0.1)';
      ctx.strokeStyle = 'rgba(167,139,250,0.45)';
      ctx.lineWidth = ps(0.8);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px(P.PS.x) - psW / 2, py(P.PS.y) - psH / 2, psW, psH, ps(3));
      else ctx.rect(px(P.PS.x) - psW / 2, py(P.PS.y) - psH / 2, psW, psH);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(167,139,250,0.85)'; ctx.font = `500 ${ps(8)}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('PS', px(P.PS.x), py(P.PS.y) + ps(3));
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = `${ps(7)}px monospace`;
      ctx.fillText(`Δφ`, px(P.PS.x), py(P.PS.y) + psH / 2 + ps(10));

      // Mirrors (with tip visualization)
      drawMirror(P.M1, 'M₁', armXphys, st.mirror1Tip);
      drawMirror(P.M2, 'M₂', armYphys, st.mirror2Tip);

      // Detectors
      const d1Count = st.simD1, d2Count = st.simD2;
      const d1Flash = sim.flashes.some(f => f.d1 && f.age < 10);
      const d2Flash = sim.flashes.some(f => !f.d1 && f.age < 10);
      drawDetector(D1, 'D1', d1Count, d1Flash);
      drawDetector(D2, 'D2', d2Count, d2Flash);

      // ── Arm labels ──
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = `${ps(9)}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('arm 1 (reflected)', px((P.BS1.x + P.M1.x) / 2) - ps(30), py((P.BS1.y + P.M1.y) / 2));
      ctx.fillText('arm 2 (transmitted)', px((P.BS1.x + P.M2.x) / 2), py(P.BS1.y) + ps(16));

      // ── Animate photons ──
      if (!st.simulationPaused) {
        if (sim.autoQ > 0 && sim.photons.length < 20) { sim.autoQ--; sim.photons.push(buildPhoton()); }
        if (sim.continuous) {
          sim.continuousTimer += dt;
          if (sim.continuousTimer > 0.06) { sim.continuousTimer = 0; sim.photons.push(buildPhoton()); }
        }

        sim.photons = sim.photons.filter(ph => {
          ph.progress += dt * ph.speed;
          if (ph.progress >= 1) {
            useSimulationStore.getState().incSimCount(ph.goD1 ? 1 : 2);
            sim.flashes.push({ age: 0, d1: ph.goD1 });
            return false;
          }
          const pos = interpPt(ph.path, ph.progress);
          // Glow
          const g = ctx.createRadialGradient(px(pos.x), py(pos.y), 0, px(pos.x), py(pos.y), ps(10));
          g.addColorStop(0, wlColor + 'cc'); g.addColorStop(1, wlColor + '00');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(px(pos.x), py(pos.y), ps(10), 0, Math.PI * 2); ctx.fill();
          if (ph.prevPos) {
            ctx.beginPath();
            ctx.moveTo(px(ph.prevPos.x), py(ph.prevPos.y)); ctx.lineTo(px(pos.x), py(pos.y));
            ctx.strokeStyle = wlColor + '66'; ctx.lineWidth = ps(1.5); ctx.stroke();
          }
          ctx.beginPath(); ctx.arc(px(pos.x), py(pos.y), ps(3), 0, Math.PI * 2);
          ctx.fillStyle = '#fff'; ctx.fill();
          ph.prevPos = { ...pos };
          return true;
        });

        sim.flashes = sim.flashes.filter(f => { f.age++; return f.age < 20; });
      }

      // ── Bottom readout ──
      const vis = fringeVisibility(opd, st.laserLinewidth);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = `${ps(9)}px monospace`; ctx.textAlign = 'left';
      const ry = py(435);
      ctx.fillText(`OPD: ${Math.abs(opd) < 1e-6 ? `${(opd * 1e9).toFixed(1)}nm` : `${(opd * 1e6).toFixed(2)}μm`}`, px(20), ry);
      ctx.fillText(`V: ${(vis * 100).toFixed(1)}%`, px(170), ry);
      ctx.fillText(`Arm1: ${(armXphys * 1e3).toFixed(1)}mm  Arm2: ${(armYphys * 1e3).toFixed(1)}mm`, px(290), ry);

      // Detection stats (top-right)
      const total = st.simFired;
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = `500 ${ps(9)}px sans-serif`;
      ctx.fillText(`Sent: ${total}`, px(680), py(20));
      const { p1: tp1, p2: tp2 } = detectionProbabilities(st.wavelength, opd);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = `${ps(8)}px monospace`;
      ctx.fillText(`P(D1)=${(tp1 * 100).toFixed(0)}% P(D2)=${(tp2 * 100).toFixed(0)}%`, px(680), py(35));

      // Drag indicator
      if (dragRef.current.dragging) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = `${ps(8)}px sans-serif`; ctx.textAlign = 'center';
        ctx.fillText('drag to reposition', px(350), py(435));
      }

      ctx.restore();
    };

    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [positions, buildPhoton, opd, armXphys, armYphys, INPUT, D1, D2]);

  // ── Drag-and-drop ──
  const handleMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = rect.width, H = rect.height;
    const sf = Math.min(W / 700, H / 440);
    const ox = (W - 700 * sf) / 2, oy = (H - 440 * sf) / 2;
    const mx = (e.clientX - rect.left - ox) / sf;
    const my = (e.clientY - rect.top - oy) / sf;

    // Check if clicking near a draggable component
    for (const [name, pos] of Object.entries(positions)) {
      const dist = Math.hypot(mx - pos.x, my - pos.y);
      if (dist < 25) {
        dragRef.current = { dragging: name, offsetX: mx - pos.x, offsetY: my - pos.y };
        return;
      }
    }
  }, [positions]);

  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current.dragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    const sf = Math.min(W / 700, H / 440);
    const ox = (W - 700 * sf) / 2, oy = (H - 440 * sf) / 2;
    const mx = (e.clientX - rect.left - ox) / sf;
    const my = (e.clientY - rect.top - oy) / sf;
    const newX = snap(Math.max(30, Math.min(670, mx - dragRef.current.offsetX)));
    const newY = snap(Math.max(30, Math.min(420, my - dragRef.current.offsetY)));
    setPositions(prev => ({ ...prev, [dragRef.current.dragging]: { x: newX, y: newY } }));
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current.dragging = null;
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ position: 'absolute', inset: 0, display: 'block', cursor: dragRef.current.dragging ? 'grabbing' : 'default' }} />
      {/* Fire controls */}
      <div style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 10, display: 'flex', gap: 5, alignItems: 'center' }}>
        <SimBtn label="Send 1" onClick={fireOne} />
        <SimBtn label="×50" onClick={() => fireN(50)} />
        <SimBtn label="×500" onClick={() => fireN(500)} />
        <SimBtn label={simRef.current.continuous ? '■ Stop' : '▶ Auto'} onClick={toggleContinuous} active={simRef.current.continuous} />
        <SimBtn label="Reset" onClick={resetCounts} danger />
      </div>
      {/* Interferometer label + drag hint */}
      <div style={{ position: 'absolute', top: 8, left: 10, pointerEvents: 'none' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>
          Mach-Zehnder Interferometer
        </div>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
          Drag components to reposition • Snap-to-grid
        </div>
      </div>
    </div>
  );
};

const SimBtn = ({ label, onClick, active, danger }) => (
  <button onClick={onClick} style={{
    padding: '4px 10px', fontSize: 9, fontWeight: 600,
    background: active ? 'rgba(79,156,249,0.25)' : danger ? 'rgba(240,96,96,0.12)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${active ? 'rgba(79,156,249,0.5)' : danger ? 'rgba(240,96,96,0.3)' : 'rgba(255,255,255,0.12)'}`,
    borderRadius: 5, cursor: 'pointer', color: danger ? '#f06060' : '#fff',
    fontFamily: 'inherit', letterSpacing: '0.03em', transition: 'all 150ms',
  }}>
    {label}
  </button>
);

export default SceneManager;
