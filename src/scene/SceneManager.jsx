import React, { useRef, useEffect, useCallback, useState } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { generateFringePattern, wavelengthToColor, detectionProbabilities } from '../physics/basicInterference.js';
import { fringeVisibility } from '../physics/coherenceModel.js';

/**
 * SceneManager — Animated 2D Michelson Interferometer
 *
 * Features:
 * - Animated photon/particle dots traveling along beam paths
 * - Wave mode with oscillating sinusoidal paths
 * - Detection counters with flash effects
 * - All beam paths respond to store mirror positions
 * - Power affects beam brightness/intensity
 * - BS reflectivity affects split ratio
 * - Fire controls (Send 1, Send 50, continuous)
 * - Mini interferogram in detector
 */

/* ─── Path utilities ─── */
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
    photons: [],
    flashes: [],
    d1: 0, d2: 0, fired: 0,
    waveT: 0,
    autoQ: 0,
    continuous: false,
    continuousTimer: 0,
  });
  const [, forceRender] = useState(0);

  const state = useSimulationStore();

  // Layout coordinates (700×440 virtual space)
  const getLayout = useCallback(() => {
    const SRC = { x: 60, y: 220 };
    const BS = { x: 220, y: 220 };
    const m1x = 220 + (state.mirror1PosX / 0.175) * 180;
    const m1y = 220 + (state.mirror1PosZ / 0.175) * 180;
    const m2x = 220 + (state.mirror2PosX / 0.175) * 180;
    const m2y = 220 + (state.mirror2PosZ / 0.175) * 180;
    const M1 = { x: Math.max(280, Math.min(620, m1x)), y: Math.max(30, Math.min(410, m1y)) };
    const M2 = { x: Math.max(30, Math.min(620, m2x)), y: Math.max(30, Math.min(410, m2y)) };
    const DET = { x: 220, y: 400 };
    return { SRC, BS, M1, M2, DET };
  }, [state.mirror1PosX, state.mirror1PosZ, state.mirror2PosX, state.mirror2PosZ]);

  // Build a photon/particle path
  const buildPath = useCallback(() => {
    const L = getLayout();
    const armX = Math.sqrt(state.mirror1PosX ** 2 + state.mirror1PosZ ** 2);
    const armY = Math.sqrt(state.mirror2PosX ** 2 + state.mirror2PosZ ** 2);
    const opd = 2 * (armX - armY);
    const { p1 } = detectionProbabilities(state.wavelength, opd);
    const vis = fringeVisibility(opd, state.laserLinewidth);
    const effectiveP1 = p1 * vis + 0.5 * (1 - vis); // decoherence → 50:50
    const goD1 = Math.random() < effectiveP1;

    // Path: Source → BS → random arm → BS → Detector
    const goUpper = Math.random() < state.bsReflectivity;
    let solid;
    if (goUpper) {
      solid = [L.SRC, L.BS, L.M2, L.BS, L.DET];
    } else {
      solid = [L.SRC, L.BS, L.M1, L.BS, L.DET];
    }

    return { solid, goD1, progress: 0, prevPos: null, speed: 0.3 + Math.random() * 0.15 };
  }, [state, getLayout]);

  // Fire one photon
  const fireOne = useCallback(() => {
    const sim = simRef.current;
    sim.photons.push(buildPath());
  }, [buildPath]);

  // Fire N
  const fireN = useCallback((n) => {
    const sim = simRef.current;
    sim.autoQ += n;
  }, []);

  // Reset
  const resetCounts = useCallback(() => {
    const sim = simRef.current;
    sim.d1 = 0; sim.d2 = 0; sim.fired = 0;
    sim.photons = []; sim.flashes = [];
    sim.autoQ = 0; sim.continuous = false;
    useSimulationStore.getState().resetSimCounts();
    forceRender(r => r + 1);
  }, []);

  // Toggle continuous
  const toggleContinuous = useCallback(() => {
    simRef.current.continuous = !simRef.current.continuous;
    forceRender(r => r + 1);
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let animFrame;
    let lastTs = null;

    const animate = (ts) => {
      animFrame = requestAnimationFrame(animate);
      if (!lastTs) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      const sim = simRef.current;

      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const W = parent.clientWidth;
      const H = parent.clientHeight;
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
      }
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.scale(dpr, dpr);

      const sf = Math.min(W / 700, H / 440);
      const ox = (W - 700 * sf) / 2;
      const oy = (H - 440 * sf) / 2;
      const px = (x) => ox + x * sf;
      const py = (y) => oy + y * sf;
      const ps = (s) => s * sf;

      const st = useSimulationStore.getState();
      const wlColor = wavelengthToColor(st.wavelength);
      const L = getLayout();
      const armX = Math.sqrt(st.mirror1PosX ** 2 + st.mirror1PosZ ** 2);
      const armY = Math.sqrt(st.mirror2PosX ** 2 + st.mirror2PosZ ** 2);
      const opd = 2 * (armX - armY);
      const powerFactor = Math.min(1, st.laserPower / 0.01); // normalize to 10mW max

      // ── Clear ──
      ctx.clearRect(0, 0, W, H);

      // Subtle grid
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // ── Guide lines (dashed) ──
      const drawGuide = (pts) => {
        ctx.save();
        ctx.setLineDash([ps(5), ps(8)]);
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = ps(0.8);
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(px(p.x), py(p.y)) : ctx.lineTo(px(p.x), py(p.y)));
        ctx.stroke();
        ctx.restore();
      };
      drawGuide([L.SRC, L.BS]);
      drawGuide([L.BS, L.M1]);
      drawGuide([L.BS, L.M2]);
      drawGuide([L.BS, L.DET]);

      // ── Beam paths (continuous glow, intensity = power) ──
      const drawBeamPath = (from, to, alpha) => {
        const a = alpha * powerFactor;
        if (a < 0.01) return;
        ctx.save();
        ctx.strokeStyle = wlColor;
        ctx.globalAlpha = a * 0.4;
        ctx.lineWidth = ps(2);
        ctx.shadowColor = wlColor;
        ctx.shadowBlur = ps(6) * powerFactor;
        ctx.beginPath();
        ctx.moveTo(px(from.x), py(from.y));
        ctx.lineTo(px(to.x), py(to.y));
        ctx.stroke();
        ctx.restore();
      };
      drawBeamPath(L.SRC, L.BS, 1.0);
      drawBeamPath(L.BS, L.M1, st.bsTransmissivity);
      drawBeamPath(L.BS, L.M2, st.bsReflectivity);
      drawBeamPath(L.BS, L.DET, 0.7);

      // ── Wave mode: oscillating sinusoidal wave along paths ──
      sim.waveT += dt;
      if (!st.simulationPaused) {
        const drawWave = (pts, phaseOff = 0, alpha = 0.6) => {
          const total = pathLen(pts);
          const nPts = Math.round(total * 2);
          ctx.save();
          ctx.strokeStyle = wlColor;
          ctx.globalAlpha = alpha * powerFactor;
          ctx.lineWidth = ps(1.5);
          ctx.beginPath();
          let first = true;
          for (let i = 0; i <= nPts; i++) {
            const frac = i / nPts;
            const pos = interpPt(pts, frac);
            const dx = i < nPts ? (interpPt(pts, (i + 1) / nPts).x - pos.x) : 0;
            const dy = i < nPts ? (interpPt(pts, (i + 1) / nPts).y - pos.y) : 0;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len, ny = dx / len;
            const wave = Math.sin(frac * total * 0.15 - sim.waveT * 4 + phaseOff) * ps(4) * powerFactor;
            const wx = px(pos.x) + nx * wave;
            const wy = px(pos.y) + ny * wave;  // intentionally use px for uniform scaling
            if (first) { ctx.moveTo(wx, py(pos.y) + (ny * wave)); first = false; }
            else ctx.lineTo(px(pos.x) + nx * wave, py(pos.y) + ny * wave);
          }
          ctx.stroke();
          ctx.restore();
        };
        // Only draw waves along beam paths (subtle, showing standing wave)
        drawWave([L.SRC, L.BS], 0, 0.3);
        drawWave([L.BS, L.M1], 0, 0.2 * st.bsTransmissivity);
        drawWave([L.BS, L.M2], Math.PI / 2, 0.2 * st.bsReflectivity);
      }

      // ── Source ──
      const srcR = ps(16);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.strokeStyle = wlColor;
      ctx.lineWidth = ps(1.5);
      ctx.beginPath(); ctx.arc(px(L.SRC.x), py(L.SRC.y), srcR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Pulsing inner dot
      const pulse = 0.6 + 0.4 * Math.sin(sim.waveT * 3);
      ctx.fillStyle = wlColor;
      ctx.globalAlpha = pulse * powerFactor;
      ctx.beginPath(); ctx.arc(px(L.SRC.x), py(L.SRC.y), ps(5), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `500 ${ps(10)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('SOURCE', px(L.SRC.x), py(L.SRC.y) + srcR + ps(12));
      ctx.font = `${ps(8)}px monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText(`${(st.wavelength * 1e9).toFixed(0)}nm · ${(st.laserPower * 1e3).toFixed(1)}mW`, px(L.SRC.x), py(L.SRC.y) + srcR + ps(22));

      // ── Beam Splitter ──
      const bsR = ps(18);
      ctx.save();
      ctx.translate(px(L.BS.x), py(L.BS.y));
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = ps(1.2);
      ctx.beginPath(); ctx.rect(-bsR, -bsR, bsR * 2, bsR * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = ps(2);
      ctx.beginPath(); ctx.moveTo(-bsR * 0.7, bsR * 0.7); ctx.lineTo(bsR * 0.7, -bsR * 0.7); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = `600 ${ps(11)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`BS₁`, px(L.BS.x), py(L.BS.y) - bsR - ps(6));
      ctx.font = `${ps(8)}px monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText(`${(st.bsReflectivity * 100).toFixed(0)}:${(st.bsTransmissivity * 100).toFixed(0)}`, px(L.BS.x), py(L.BS.y) - bsR - ps(16));

      // ── Mirrors ──
      const drawMirror = (pos, label, armLen) => {
        const r = ps(14);
        ctx.save();
        ctx.translate(px(pos.x), py(pos.y));
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = ps(1.2);
        ctx.beginPath(); ctx.rect(-r, -r, r * 2, r * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = ps(2.5);
        ctx.beginPath(); ctx.moveTo(-r * 0.65, r * 0.65); ctx.lineTo(r * 0.65, -r * 0.65); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = `600 ${ps(11)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(label, px(pos.x), py(pos.y) - r - ps(6));
        ctx.font = `${ps(8)}px monospace`;
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText(`${(armLen * 1e3).toFixed(1)}mm`, px(pos.x), py(pos.y) - r - ps(16));
      };
      drawMirror(L.M1, 'M₁', armX);
      drawMirror(L.M2, 'M₂', armY);

      // ── Compensator plate ──
      if (st.compensatorEnabled) {
        const cpX = (L.BS.x + L.M1.x) / 2;
        const cpY = (L.BS.y + L.M1.y) / 2;
        ctx.fillStyle = 'rgba(167,139,250,0.12)';
        ctx.strokeStyle = 'rgba(167,139,250,0.5)';
        ctx.lineWidth = ps(0.8);
        const cpW = ps(36), cpH = ps(16);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(px(cpX) - cpW / 2, py(cpY) - cpH / 2, cpW, cpH, ps(3));
        else { ctx.rect(px(cpX) - cpW / 2, py(cpY) - cpH / 2, cpW, cpH); }
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(167,139,250,0.9)';
        ctx.font = `500 ${ps(8)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('COMP', px(cpX), py(cpY) + ps(3));
      }

      // ── Detector with mini interferogram ──
      const detW = ps(48), detH = ps(36);
      const fringeRes = 24;
      const fringeData = generateFringePattern({
        wavelength: st.wavelength, opdCenter: opd,
        tiltX: st.mirror1Tip, tiltY: st.mirror2Tip,
        resolution: fringeRes, detectorSize: 0.01,
        linewidth: st.laserLinewidth,
      });
      // Detector flash glow
      const activeFlash = sim.flashes.some(f => f.age < 10);
      if (activeFlash) {
        const g = ctx.createRadialGradient(px(L.DET.x), py(L.DET.y), 0, px(L.DET.x), py(L.DET.y), ps(40));
        g.addColorStop(0, 'rgba(45,212,168,0.4)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px(L.DET.x), py(L.DET.y), ps(40), 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = activeFlash ? 'rgba(45,212,168,0.1)' : 'rgba(255,255,255,0.04)';
      ctx.strokeStyle = '#2dd4a8';
      ctx.lineWidth = ps(activeFlash ? 2 : 1.2);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px(L.DET.x) - detW / 2, py(L.DET.y) - detH / 2, detW, detH, ps(5));
      else ctx.rect(px(L.DET.x) - detW / 2, py(L.DET.y) - detH / 2, detW, detH);
      ctx.fill(); ctx.stroke();
      // Mini fringe pattern
      const fR = ps(12);
      const cr = parseInt(wlColor.slice(1, 3), 16);
      const cg = parseInt(wlColor.slice(3, 5), 16);
      const cb = parseInt(wlColor.slice(5, 7), 16);
      for (let j = 0; j < fringeRes; j++) {
        for (let i = 0; i < fringeRes; i++) {
          const val = fringeData[j * fringeRes + i] * powerFactor;
          const fx = px(L.DET.x) + (i / fringeRes - 0.5) * fR * 2;
          const fy = py(L.DET.y) + (j / fringeRes - 0.5) * fR * 2;
          const ddx = fx - px(L.DET.x), ddy = fy - py(L.DET.y);
          if (ddx * ddx + ddy * ddy > fR * fR) continue;
          ctx.fillStyle = `rgba(${Math.round(cr * val)},${Math.round(cg * val)},${Math.round(cb * val)},${0.4 + val * 0.6})`;
          ctx.fillRect(fx, fy, fR * 2 / fringeRes + 0.5, fR * 2 / fringeRes + 0.5);
        }
      }
      ctx.fillStyle = '#2dd4a8';
      ctx.font = `600 ${ps(10)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('DETECTOR', px(L.DET.x), py(L.DET.y) + detH / 2 + ps(12));

      // ── Animate photons ──
      if (!st.simulationPaused) {
        // Auto-fire queue
        if (sim.autoQ > 0 && sim.photons.length < 15) {
          sim.autoQ--;
          sim.photons.push(buildPath());
        }
        // Continuous mode
        if (sim.continuous) {
          sim.continuousTimer += dt;
          if (sim.continuousTimer > 0.08) {
            sim.continuousTimer = 0;
            sim.photons.push(buildPath());
          }
        }

        sim.photons = sim.photons.filter(ph => {
          ph.progress += dt * ph.speed;
          if (ph.progress >= 1) {
            if (ph.goD1) sim.d1++; else sim.d2++;
            sim.fired++;
            // Push to store so DetectionOverlay updates
            useSimulationStore.getState().incSimCount(ph.goD1 ? 1 : 2);
            sim.flashes.push({ age: 0, d1: ph.goD1 });
            return false;
          }
          // Draw photon dot
          const pos = interpPt(ph.solid, ph.progress);
          // Glow
          const g = ctx.createRadialGradient(px(pos.x), py(pos.y), 0, px(pos.x), py(pos.y), ps(12));
          g.addColorStop(0, wlColor + 'cc');
          g.addColorStop(1, wlColor + '00');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(px(pos.x), py(pos.y), ps(12), 0, Math.PI * 2); ctx.fill();
          // Trail
          if (ph.prevPos) {
            ctx.beginPath();
            ctx.moveTo(px(ph.prevPos.x), py(ph.prevPos.y));
            ctx.lineTo(px(pos.x), py(pos.y));
            ctx.strokeStyle = wlColor + '88';
            ctx.lineWidth = ps(2);
            ctx.stroke();
          }
          // Core dot
          ctx.beginPath(); ctx.arc(px(pos.x), py(pos.y), ps(3.5), 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ph.prevPos = { ...pos };
          return true;
        });

        // Flash effects
        sim.flashes = sim.flashes.filter(f => {
          f.age++;
          if (f.age > 20) return false;
          const a = 1 - f.age / 20;
          ctx.save();
          ctx.globalAlpha = a * 0.6;
          ctx.beginPath();
          ctx.arc(px(L.DET.x), py(L.DET.y), ps(18 + f.age * 1.2), 0, Math.PI * 2);
          ctx.strokeStyle = '#2dd4a8';
          ctx.lineWidth = ps(1.5);
          ctx.stroke();
          ctx.restore();
          return true;
        });
      }

      // ── Bottom readout bar ──
      const vis = fringeVisibility(opd, st.laserLinewidth);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = `${ps(9)}px monospace`;
      ctx.textAlign = 'left';
      const ry = py(432);
      ctx.fillText(`OPD: ${Math.abs(opd) < 1e-6 ? `${(opd * 1e9).toFixed(1)}nm` : `${(opd * 1e6).toFixed(3)}μm`}`, px(20), ry);
      ctx.fillText(`V: ${(vis * 100).toFixed(1)}%`, px(180), ry);
      ctx.fillText(`Δν: ${(st.laserLinewidth / 1e9).toFixed(2)}GHz`, px(280), ry);

      // ── Detection stats (right side) ──
      const total = sim.d1 + sim.d2;
      const p1Pct = total > 0 ? (sim.d1 / total * 100).toFixed(1) : '—';
      const p2Pct = total > 0 ? (sim.d2 / total * 100).toFixed(1) : '—';
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `500 ${ps(10)}px sans-serif`;
      ctx.fillText(`Sent: ${sim.fired}`, px(680), py(30));
      ctx.fillStyle = '#2dd4a8';
      ctx.fillText(`D₁: ${sim.d1} (${p1Pct}%)`, px(680), py(48));
      ctx.fillStyle = '#4f9cf9';
      ctx.fillText(`D₂: ${sim.d2} (${p2Pct}%)`, px(680), py(66));
      // Theory
      const { p1: tp1, p2: tp2 } = detectionProbabilities(st.wavelength, opd);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = `${ps(8)}px monospace`;
      ctx.fillText(`theory: ${(tp1 * 100).toFixed(0)}%/${(tp2 * 100).toFixed(0)}%`, px(680), py(82));

      // Detection bars
      if (total > 0) {
        const barX = px(580), barY = py(92), barW = ps(96), barH = ps(6);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#2dd4a8';
        ctx.fillRect(barX, barY, barW * sim.d1 / total, barH);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(barX, barY + barH + ps(2), barW, barH);
        ctx.fillStyle = '#4f9cf9';
        ctx.fillRect(barX, barY + barH + ps(2), barW * sim.d2 / total, barH);
      }

      ctx.restore();
    };

    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [getLayout, buildPath]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, display: 'block' }} />
      {/* Fire controls overlay */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12, zIndex: 10,
        display: 'flex', gap: 6, alignItems: 'center',
      }}>
        <SimBtn label="Send 1" onClick={fireOne} />
        <SimBtn label="Send 50" onClick={() => fireN(50)} />
        <SimBtn label="Send 500" onClick={() => fireN(500)} />
        <SimBtn label={simRef.current.continuous ? '■ Stop' : '▶ Auto'}
          onClick={toggleContinuous}
          active={simRef.current.continuous} />
        <SimBtn label="Reset" onClick={resetCounts} danger />
      </div>
    </div>
  );
};

const SimBtn = ({ label, onClick, active, danger }) => (
  <button onClick={onClick} style={{
    padding: '5px 12px', fontSize: 9, fontWeight: 600,
    background: active ? 'rgba(79,156,249,0.25)' : danger ? 'rgba(240,96,96,0.12)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${active ? 'rgba(79,156,249,0.5)' : danger ? 'rgba(240,96,96,0.3)' : 'rgba(255,255,255,0.12)'}`,
    borderRadius: 5, cursor: 'pointer',
    color: danger ? '#f06060' : '#fff',
    fontFamily: 'inherit', letterSpacing: '0.03em',
    transition: 'all 150ms',
  }}>
    {label}
  </button>
);

export default SceneManager;
