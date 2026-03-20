import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { computeOPD, computeTiltAveragedProbability } from '../store/simulationStore.js';
import { generateFringePattern, wavelengthToColor, detectionProbabilities } from '../physics/basicInterference.js';
import { fringeVisibility } from '../physics/coherenceModel.js';

/**
 * SceneManager — Mach-Zehnder Interferometer (MZI) with Superposition
 *
 * Photon travels INPUT→BS1 where it SPLITS into two ghost dots:
 *   Ghost A: BS1→M1→BS2 (arm 1, reflected)
 *   Ghost B: BS1→PS→M2→BS2 (arm 2, transmitted)
 * At BS2 the ghosts recombine — interference decides D1 or D2.
 * The "losing" ghost fades out (destructive interference).
 *
 * Toggle M1/M2 off → that arm is blocked → no interference → 50:50
 * Toggle BS2 off → no recombination → photons go straight
 */

const GRID = 20;
const snap = (v) => Math.round(v / GRID) * GRID;

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

// EM-wave drawing helper — draws sinusoidal wave in LOGICAL (0-700) coordinate space
// then transforms to canvas via px/py. No broken ratio math.
function drawEMWave(ctx, from, to, waveT, phOffset, color, alpha, px, py, ps, waveFreq, ampLogical) {
  const wFreq = waveFreq || 0.08;   // spatial frequency cycles per logical unit
  const amp   = ampLogical || 5;     // perpendicular amplitude in logical units
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len, uy = dy / len;   // unit vec along beam
  const perpX = -uy, perpY = ux;        // perpendicular
  const STEPS = Math.ceil(len * 1.0);   // one sample per logical pixel
  ctx.beginPath();
  for (let i = 0; i <= STEPS; i++) {
    const frac = i / STEPS;
    const lx = from.x + ux * len * frac;
    const ly = from.y + uy * len * frac;
    // Sinusoidal displacement perpendicular to beam direction
    const wave = Math.sin(frac * len * wFreq - waveT * 4 + phOffset) * amp;
    const wx = lx + perpX * wave;
    const wy = ly + perpY * wave;
    if (i === 0) ctx.moveTo(px(wx), py(wy));
    else         ctx.lineTo(px(wx), py(wy));
  }
  ctx.strokeStyle = color;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.lineWidth = ps(2.2);
  ctx.lineJoin = 'round';
  ctx.lineCap  = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur  = ps(3);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

const SceneManager = () => {
  const canvasRef = useRef(null);
  const simRef = useRef({
    photons: [], flashes: [],
    waveT: 0, autoQ: 0, continuous: false, continuousTimer: 0,
  });
  const [, forceRender] = useState(0);
  const [viewMode, setViewMode] = useState('photon'); // 'photon' | 'emwave' | 'both'

  const [positions, setPositions] = useState({
    BS1: { x: 150, y: 310 },
    M1:  { x: 150, y: 100 },
    M2:  { x: 520, y: 310 },
    BS2: { x: 520, y: 100 },
    PS:  { x: 340, y: 310 },
  });
  const dragRef = useRef({ dragging: null, offsetX: 0, offsetY: 0 });

  // SELECTIVE subscriptions — only physics params, NOT simD1/simD2/simFired
  // This prevents re-render cascade when photons update counts
  const wavelength = useSimulationStore(s => s.wavelength);
  const laserPower = useSimulationStore(s => s.laserPower);
  const laserLinewidth = useSimulationStore(s => s.laserLinewidth);
  const bsReflectivity = useSimulationStore(s => s.bsReflectivity);
  const bsTransmissivity = useSimulationStore(s => s.bsTransmissivity);
  const mirror1PosX = useSimulationStore(s => s.mirror1PosX);
  const mirror1PosZ = useSimulationStore(s => s.mirror1PosZ);
  const mirror2PosX = useSimulationStore(s => s.mirror2PosX);
  const mirror2PosZ = useSimulationStore(s => s.mirror2PosZ);
  const mirror1Tip = useSimulationStore(s => s.mirror1Tip);
  const mirror2Tip = useSimulationStore(s => s.mirror2Tip);
  const mirror1Reflectivity = useSimulationStore(s => s.mirror1Reflectivity);
  const mirror2Reflectivity = useSimulationStore(s => s.mirror2Reflectivity);
  const m1Enabled = useSimulationStore(s => s.m1Enabled);
  const m2Enabled = useSimulationStore(s => s.m2Enabled);
  const bs2Enabled = useSimulationStore(s => s.bs2Enabled);
  const compensatorEnabled = useSimulationStore(s => s.compensatorEnabled);
  const compensatorRefractiveIndex = useSimulationStore(s => s.compensatorRefractiveIndex);
  const compensatorThickness = useSimulationStore(s => s.compensatorThickness);
  const bsRefractiveIndex = useSimulationStore(s => s.bsRefractiveIndex);
  const bsThickness = useSimulationStore(s => s.bsThickness);
  const simulationPaused = useSimulationStore(s => s.simulationPaused);

  const INPUT = useMemo(() => ({ x: 40, y: positions.BS1.y }), [positions.BS1.y]);
  const D1 = useMemo(() => ({ x: positions.BS2.x, y: 30 }), [positions.BS2.x]);
  const D2 = useMemo(() => ({ x: 660, y: positions.BS2.y }), [positions.BS2.y]);

  // Arm lengths from canvas (for DISPLAY only)
  const arm1LenPx = Math.hypot(positions.M1.x - positions.BS1.x, positions.M1.y - positions.BS1.y)
                   + Math.hypot(positions.BS2.x - positions.M1.x, positions.BS2.y - positions.M1.y);
  const arm2LenPx = Math.hypot(positions.PS.x - positions.BS1.x, positions.PS.y - positions.BS1.y)
                   + Math.hypot(positions.M2.x - positions.PS.x, positions.M2.y - positions.PS.y)
                   + Math.hypot(positions.BS2.x - positions.M2.x, positions.BS2.y - positions.M2.y);
  // Display arm lengths (arbitrary scaling for readout)
  const armXphys = arm1LenPx * 0.0005;
  const armYphys = arm2LenPx * 0.0005;

  // MZI OPD — from central physics engine (includes drag, compensator, thermal, seismic, GW)
  const opd = computeOPD(useSimulationStore.getState()).opd;

  /**
   * Build a photon with SUPERPOSITION paths.
   * Each photon has two ghosts (arm1 and arm2) that travel simultaneously.
   * After BS2, interference determines which detector fires.
   */
  const buildPhoton = useCallback(() => {
    const P = positions;
    const st = useSimulationStore.getState();

    // Arm paths
    const arm1Path = [INPUT, P.BS1, P.M1, P.BS2];
    const arm2Path = [INPUT, P.BS1, P.PS, P.M2, P.BS2];

    // Detection probabilities from interference
    const bothArmsActive = st.m1Enabled && st.m2Enabled;
    let goD1;
    if (!st.bs2Enabled) {
      // No BS2 → photon takes one arm randomly, goes straight to its detector
      goD1 = Math.random() < 0.5;
    } else if (bothArmsActive) {
      // Full MZI interference (tilt-aware)
      const { p1: effectiveP1 } = computeTiltAveragedProbability(st);
      goD1 = Math.random() < effectiveP1;
    } else {
      // Only one arm → no interference → 50:50
      goD1 = Math.random() < 0.5;
    }

    // After BS2: exit paths
    const exitD1 = [P.BS2, D1];
    const exitD2 = [P.BS2, D2];

    // Phase 1: INPUT → BS1 (shared entrance)
    const entrancePath = [INPUT, P.BS1];
    // Phase 2: both ghosts in arms (superposition) — BS1 to BS2
    const ghost1Path = [P.BS1, P.M1, P.BS2];  // arm 1
    const ghost2Path = [P.BS1, P.PS, P.M2, P.BS2]; // arm 2
    // Phase 3: exit — BS2 to D1 or D2
    const exitPath = goD1 ? exitD1 : exitD2;

    return {
      phase: 'entrance', // 'entrance' → 'superposition' → 'exit'
      progress: 0,
      entrancePath,
      ghost1Path, ghost2Path,
      exitPath,
      goD1,
      arm1Active: st.m1Enabled,
      arm2Active: st.m2Enabled,
      bs2Active: st.bs2Enabled,
      speed: 0.8 + Math.random() * 0.2,
      prevPos1: null, prevPos2: null, prevPosMain: null,
      ghost1Opacity: st.m1Enabled ? 1 : 0,
      ghost2Opacity: st.m2Enabled ? 1 : 0,
      exitOpacity: 0,
    };
  }, [positions, opd, INPUT, D1, D2]);

  const fireOne = useCallback(() => { simRef.current.photons.push(buildPhoton()); }, [buildPhoton]);

  // Batch fire: resolve most counts INSTANTLY, animate only ~5 visible photons
  const fireN = useCallback((n) => {
    const st = useSimulationStore.getState();
    const bothArms = st.m1Enabled && st.m2Enabled;
    const { p1 } = computeTiltAveragedProbability(st);
    const effectiveP1 = (bothArms && st.bs2Enabled) ? p1 : 0.5;

    // Instantly resolve bulk (n-5) photons statistically
    const animateCount = Math.min(5, n);
    const instantCount = n - animateCount;
    if (instantCount > 0) {
      // Deterministic Binomial Expected-Value split — eliminates
      // stochastic variance on small N that causes apparent physics mismatches
      const d1 = Math.round(instantCount * effectiveP1);
      const d2 = instantCount - d1;
      // Batch update store
      const store = useSimulationStore.getState();
      useSimulationStore.setState({
        simD1: store.simD1 + d1,
        simD2: store.simD2 + d2,
        simFired: store.simFired + instantCount,
      });
    }
    // Queue a few for animation
    for (let i = 0; i < animateCount; i++) {
      simRef.current.photons.push(buildPhoton());
    }
  }, [buildPhoton, opd]);
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

  // ── Animation Loop ──
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
      const P = positions;

      ctx.clearRect(0, 0, W, H);

      // Subtle grid
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (let gy = 0; gy < H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

      // ── Guide beam paths (dashed) ──
      const drawGuide = (pts, alpha = 0.07) => {
        ctx.save();
        ctx.setLineDash([ps(4), ps(6)]);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = ps(0.8);
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(px(p.x), py(p.y)) : ctx.lineTo(px(p.x), py(p.y)));
        ctx.stroke();
        ctx.restore();
      };
      drawGuide([INPUT, P.BS1, P.M1, P.BS2, D1], st.m1Enabled ? 0.07 : 0.03);
      drawGuide([P.BS1, P.PS, P.M2, P.BS2, D2], st.m2Enabled ? 0.07 : 0.03);

      // ── Solid beam paths ──
      const drawBeam = (from, to, alpha) => {
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
      drawBeam(INPUT, P.BS1, 1.0);
      if (st.m1Enabled) {
        drawBeam(P.BS1, P.M1, st.bsReflectivity);
        drawBeam(P.M1, P.BS2, st.bsReflectivity * st.mirror1Reflectivity);
      }
      if (st.m2Enabled) {
        drawBeam(P.BS1, P.PS, st.bsTransmissivity);
        drawBeam(P.PS, P.M2, st.bsTransmissivity);
        drawBeam(P.M2, P.BS2, st.bsTransmissivity * st.mirror2Reflectivity);
      }
      if (st.bs2Enabled) {
        drawBeam(P.BS2, D1, 0.5);
        drawBeam(P.BS2, D2, 0.5);
      }

      // ── Draw BS ──
      const drawBS = (pos, label, enabled) => {
        const r = ps(16);
        ctx.save();
        ctx.translate(px(pos.x), py(pos.y));
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = enabled ? 'rgba(100,140,220,0.08)' : 'rgba(255,60,60,0.05)';
        ctx.strokeStyle = enabled ? 'rgba(100,140,220,0.35)' : 'rgba(255,60,60,0.15)';
        ctx.lineWidth = ps(1.2);
        ctx.beginPath(); ctx.rect(-r, -r, r * 2, r * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = enabled ? 'rgba(100,140,220,0.7)' : 'rgba(255,60,60,0.3)';
        ctx.lineWidth = ps(2);
        ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.7); ctx.lineTo(r * 0.7, -r * 0.7); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = enabled ? 'rgba(255,255,255,0.65)' : 'rgba(255,80,80,0.4)';
        ctx.font = `600 ${ps(10)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(label, px(pos.x), py(pos.y) - r - ps(6));
        if (!enabled) {
          ctx.fillStyle = 'rgba(255,80,80,0.35)'; ctx.font = `${ps(7)}px sans-serif`;
          ctx.fillText('OFF', px(pos.x), py(pos.y) + r + ps(10));
        }
        // Show R:T ratio
        if (enabled) {
          ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = `${ps(7)}px monospace`;
          ctx.fillText(`${(st.bsReflectivity*100).toFixed(0)}:${(st.bsTransmissivity*100).toFixed(0)}`, px(pos.x), py(pos.y) + r + ps(10));
        }
      };

      const drawMirror = (pos, label, armLen, tipVal, enabled) => {
        const r = ps(13);
        ctx.save();
        ctx.translate(px(pos.x), py(pos.y));
        const tiltAngle = Math.PI / 4 + tipVal * 200;
        ctx.rotate(tiltAngle);
        ctx.fillStyle = enabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,60,60,0.04)';
        ctx.strokeStyle = enabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,60,60,0.12)';
        ctx.lineWidth = ps(1.2);
        ctx.beginPath(); ctx.rect(-r, -r, r * 2, r * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = enabled ? 'rgba(255,255,255,0.75)' : 'rgba(255,60,60,0.25)';
        ctx.lineWidth = ps(2.5);
        ctx.beginPath(); ctx.moveTo(-r * 0.65, r * 0.65); ctx.lineTo(r * 0.65, -r * 0.65); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = enabled ? 'rgba(255,255,255,0.7)' : 'rgba(255,80,80,0.35)';
        ctx.font = `600 ${ps(10)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(label, px(pos.x), py(pos.y) - r - ps(6));
        if (!enabled) {
          ctx.fillStyle = 'rgba(255,80,80,0.35)'; ctx.font = `${ps(7)}px sans-serif`;
          ctx.fillText('OFF', px(pos.x), py(pos.y) + r + ps(14));
        } else {
          ctx.font = `${ps(7)}px monospace`; ctx.fillStyle = 'rgba(255,255,255,0.3)';
          if (tipVal !== 0) ctx.fillText(`tip: ${(tipVal * 1e3).toFixed(2)}mrad`, px(pos.x), py(pos.y) + r + ps(14));
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
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(px(pos.x), py(pos.y) - ps(4), ps(4), 0, Math.PI * 2); ctx.fill();
        ctx.font = `700 ${ps(10)}px sans-serif`; ctx.textAlign = 'center';
        ctx.fillText(label, px(pos.x), py(pos.y) + ps(10));
        ctx.font = `${ps(8)}px monospace`; ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText(`${count}`, px(pos.x), py(pos.y) + h / 2 + ps(12));
      };

      // ── EM WAVE overlay (drawn BEFORE other components so it's under labels) ──
      const showEM = viewMode === 'emwave' || viewMode === 'both';
      if (showEM) {
        const emFreq   = 0.08;  // spatial frequency (visually pleasing sine density)
        const emAlpha  = viewMode === 'both' ? 0.55 : 0.9;
        const { p1: emP1, p2: emP2 } = detectionProbabilities(st.wavelength, opd);
        // Amplitude of output beams scales with interference
        const ampIn  = 6 * powerFactor;
        const ampArm = 5 * powerFactor;
        // INPUT → BS1
        drawEMWave(ctx, INPUT, P.BS1, sim.waveT, 0,   wlColor, emAlpha,         px, py, ps, emFreq, ampIn);
        // Arm 1: BS1→M1→BS2
        if (st.m1Enabled) {
          drawEMWave(ctx, P.BS1, P.M1,  sim.waveT, 1.1, wlColor, emAlpha * 0.85, px, py, ps, emFreq, ampArm);
          drawEMWave(ctx, P.M1,  P.BS2, sim.waveT, 2.6, wlColor, emAlpha * 0.85, px, py, ps, emFreq, ampArm);
        }
        // Arm 2: BS1→PS→M2→BS2
        if (st.m2Enabled) {
          drawEMWave(ctx, P.BS1, P.PS,  sim.waveT, 1.6, wlColor, emAlpha * 0.8,  px, py, ps, emFreq, ampArm);
          drawEMWave(ctx, P.PS,  P.M2,  sim.waveT, 2.8, wlColor, emAlpha * 0.8,  px, py, ps, emFreq, ampArm);
          drawEMWave(ctx, P.M2,  P.BS2, sim.waveT, 4.2, wlColor, emAlpha * 0.8,  px, py, ps, emFreq, ampArm);
        }
        // Recombined output — amplitude & alpha from real interference
        if (st.bs2Enabled) {
          const a1 = Math.max(0.05, emAlpha * emP1);
          const a2 = Math.max(0.05, emAlpha * emP2);
          drawEMWave(ctx, P.BS2, D1, sim.waveT, 4.8,             wlColor, a1, px, py, ps, emFreq, 6 * emP1  * powerFactor);
          drawEMWave(ctx, P.BS2, D2, sim.waveT, 4.8 + Math.PI,   wlColor, a2, px, py, ps, emFreq, 6 * emP2  * powerFactor);
        }
      }

      // Source
      const srcR = ps(14);
      ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.strokeStyle = wlColor; ctx.lineWidth = ps(1.5);
      ctx.beginPath(); ctx.arc(px(INPUT.x), py(INPUT.y), srcR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      sim.waveT += dt;
      const pulse = 0.6 + 0.4 * Math.sin(sim.waveT * 3);
      ctx.fillStyle = wlColor; ctx.globalAlpha = pulse * powerFactor;
      ctx.beginPath(); ctx.arc(px(INPUT.x), py(INPUT.y), ps(4), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = `500 ${ps(9)}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('INPUT', px(INPUT.x), py(INPUT.y) + srcR + ps(12));
      ctx.font = `${ps(7)}px monospace`; ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillText(`${(st.wavelength * 1e9).toFixed(0)}nm · ${(st.laserPower * 1e3).toFixed(1)}mW`, px(INPUT.x), py(INPUT.y) + srcR + ps(21));

      // Components
      drawBS(P.BS1, 'BS₁', true);
      drawBS(P.BS2, 'BS₂', st.bs2Enabled);
      // Phase Shifter
      const psW = ps(30), psH = ps(20);
      ctx.fillStyle = 'rgba(167,139,250,0.1)'; ctx.strokeStyle = 'rgba(167,139,250,0.45)'; ctx.lineWidth = ps(0.8);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px(P.PS.x) - psW / 2, py(P.PS.y) - psH / 2, psW, psH, ps(3));
      else ctx.rect(px(P.PS.x) - psW / 2, py(P.PS.y) - psH / 2, psW, psH);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(167,139,250,0.85)'; ctx.font = `500 ${ps(8)}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('PS', px(P.PS.x), py(P.PS.y) + ps(3));

      // Mirrors
      drawMirror(P.M1, 'M₁', armXphys, st.mirror1Tip, st.m1Enabled);
      drawMirror(P.M2, 'M₂', armYphys, st.mirror2Tip, st.m2Enabled);

      // Detectors
      const d1Flash = sim.flashes.some(f => f.d1 && f.age < 10);
      const d2Flash = sim.flashes.some(f => !f.d1 && f.age < 10);
      drawDetector(D1, 'D1', st.simD1, d1Flash);
      drawDetector(D2, 'D2', st.simD2, d2Flash);

      // Arm labels
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = `${ps(8)}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('arm 1 (reflected)', px((P.BS1.x + P.M1.x) / 2) - ps(30), py((P.BS1.y + P.M1.y) / 2));
      ctx.fillText('arm 2 (transmitted)', px((P.BS1.x + P.M2.x) / 2), py(P.BS1.y) + ps(16));

      // ── PHOTON ANIMATION (only in photon or both mode) ──
      if (!st.simulationPaused && (viewMode === 'photon' || viewMode === 'both')) {
        if (sim.autoQ > 0 && sim.photons.length < 15) {
          const batch = Math.min(sim.autoQ, 3);
          sim.autoQ -= batch;
          for (let i = 0; i < batch; i++) sim.photons.push(buildPhoton());
        }
        if (sim.continuous) {
          sim.continuousTimer += dt;
          if (sim.continuousTimer > 0.07) { sim.continuousTimer = 0; sim.photons.push(buildPhoton()); }
        }

        const drawDot = (posXY, opacity, color, radius) => {
          if (opacity < 0.02) return;
          ctx.save(); ctx.globalAlpha = opacity;
          const g = ctx.createRadialGradient(px(posXY.x), py(posXY.y), 0, px(posXY.x), py(posXY.y), ps(radius));
          g.addColorStop(0, color + 'cc'); g.addColorStop(1, color + '00');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(px(posXY.x), py(posXY.y), ps(radius), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.globalAlpha = opacity * 0.8;
          ctx.beginPath(); ctx.arc(px(posXY.x), py(posXY.y), ps(3), 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        };

        sim.photons = sim.photons.filter(ph => {
          ph.progress += dt * ph.speed;

          if (ph.phase === 'entrance') {
            // Phase 1: single dot INPUT → BS1
            if (ph.progress >= 1) {
              ph.phase = 'superposition';
              ph.progress = 0;
              return true;
            }
            const pos = interpPt(ph.entrancePath, ph.progress);
            drawDot(pos, 1, wlColor, 10);
          } else if (ph.phase === 'superposition') {
            // Phase 2: TWO ghost dots traveling both arms simultaneously
            if (ph.progress >= 1) {
              if (ph.bs2Active) {
                ph.phase = 'exit';
                ph.progress = 0;
                return true;
              } else {
                // No BS2 — photon exits at BS2 position randomly
                useSimulationStore.getState().incSimCount(ph.goD1 ? 1 : 2);
                sim.flashes.push({ age: 0, d1: ph.goD1 });
                return false;
              }
            }
            const pos1 = interpPt(ph.ghost1Path, ph.progress);
            const pos2 = interpPt(ph.ghost2Path, ph.progress);

            // Draw ghost trails (fainter)
            if (ph.prevPos1 && ph.arm1Active) {
              ctx.beginPath(); ctx.moveTo(px(ph.prevPos1.x), py(ph.prevPos1.y)); ctx.lineTo(px(pos1.x), py(pos1.y));
              ctx.strokeStyle = wlColor + '44'; ctx.lineWidth = ps(1.2); ctx.stroke();
            }
            if (ph.prevPos2 && ph.arm2Active) {
              ctx.beginPath(); ctx.moveTo(px(ph.prevPos2.x), py(ph.prevPos2.y)); ctx.lineTo(px(pos2.x), py(pos2.y));
              ctx.strokeStyle = wlColor + '44'; ctx.lineWidth = ps(1.2); ctx.stroke();
            }

            // Ghost dots
            if (ph.arm1Active) drawDot(pos1, ph.ghost1Opacity * 0.7, wlColor, 8);
            if (ph.arm2Active) drawDot(pos2, ph.ghost2Opacity * 0.7, wlColor, 8);

            // "Superposition" label at midpoint
            if (ph.progress > 0.3 && ph.progress < 0.7 && ph.arm1Active && ph.arm2Active) {
              ctx.save();
              ctx.fillStyle = 'rgba(167,139,250,0.35)';
              ctx.font = `${ps(7)}px sans-serif`;
              ctx.textAlign = 'center';
              const mid = { x: (P.BS1.x + P.BS2.x) / 2, y: (P.BS1.y + P.BS2.y) / 2 };
              ctx.fillText('|ψ⟩ = |arm1⟩ + |arm2⟩', px(mid.x), py(mid.y));
              ctx.restore();
            }

            ph.prevPos1 = { ...pos1 };
            ph.prevPos2 = { ...pos2 };
          } else if (ph.phase === 'exit') {
            // Phase 3: single dot BS2 → D1 or D2
            // The "winning" ghost exits, the "losing" one fades
            if (ph.progress >= 1) {
              useSimulationStore.getState().incSimCount(ph.goD1 ? 1 : 2);
              sim.flashes.push({ age: 0, d1: ph.goD1 });
              return false;
            }
            const pos = interpPt(ph.exitPath, ph.progress);
            drawDot(pos, 1, ph.goD1 ? '#2dd4a8' : '#4f9cf9', 10);

            // Show fading "destructive" dot going to the OTHER detector
            if (ph.progress < 0.4) {
              const fadePath = ph.goD1 ? [P.BS2, D2] : [P.BS2, D1];
              const fadePos = interpPt(fadePath, ph.progress * 0.5);
              const fadeAlpha = Math.max(0, 0.5 - ph.progress * 1.5);
              if (fadeAlpha > 0.02) {
                drawDot(fadePos, fadeAlpha, 'rgba(255,100,100)', 6);
                // "Destructive interference" label
                if (ph.progress < 0.2) {
                  ctx.save(); ctx.fillStyle = `rgba(255,100,100,${fadeAlpha * 0.7})`; ctx.font = `${ps(7)}px sans-serif`; ctx.textAlign = 'center';
                  ctx.fillText('destructive', px(fadePos.x), py(fadePos.y) - ps(12));
                  ctx.restore();
                }
              }
            }
          }
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
      const statusParts = [];
      if (!st.m1Enabled) statusParts.push('M1:OFF');
      if (!st.m2Enabled) statusParts.push('M2:OFF');
      if (!st.bs2Enabled) statusParts.push('BS2:OFF');
      if (statusParts.length) { ctx.fillStyle = 'rgba(255,100,100,0.4)'; ctx.fillText(statusParts.join(' '), px(290), ry); }
      else { ctx.fillText(`Arm1: ${(armXphys * 1e3).toFixed(1)}mm  Arm2: ${(armYphys * 1e3).toFixed(1)}mm`, px(290), ry); }

      // Theory display
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = `500 ${ps(9)}px sans-serif`;
      ctx.fillText(`Sent: ${st.simFired}`, px(680), py(45));
      const { p1: tp1, p2: tp2 } = detectionProbabilities(st.wavelength, opd);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = `${ps(8)}px monospace`;
      const interferenceLabel = (st.m1Enabled && st.m2Enabled && st.bs2Enabled) ? '' : ' (no interference)';
      ctx.fillText(`P(D1)=${(tp1 * 100).toFixed(0)}% P(D2)=${(tp2 * 100).toFixed(0)}%${interferenceLabel}`, px(680), py(60));

      // Formula subheading
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = `${ps(7)}px monospace`; ctx.textAlign = 'left';
      ctx.fillText('P(D₁) = cos²(δ/2)   δ = 2πΔL/λ', px(20), py(420));

      ctx.restore();
    };

    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, buildPhoton]);

  // ── Drag-and-drop ──
  const handleMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    const sf = Math.min(W / 700, H / 440);
    const ox = (W - 700 * sf) / 2, oy = (H - 440 * sf) / 2;
    const mx = (e.clientX - rect.left - ox) / sf;
    const my = (e.clientY - rect.top - oy) / sf;
    for (const [name, pos] of Object.entries(positions)) {
      if (Math.hypot(mx - pos.x, my - pos.y) < 25) {
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

  const handleMouseUp = useCallback(() => { dragRef.current.dragging = null; }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        style={{ position: 'absolute', inset: 0, display: 'block', cursor: dragRef.current.dragging ? 'grabbing' : 'default' }} />

      {/* View Mode Selector */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', gap: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 3, border: '1px solid rgba(255,255,255,0.08)' }}>
        {[['photon', 'γ Photon'], ['emwave', '∿ EM Wave'], ['both', '⊕ Both']].map(([mode, label]) => (
          <button key={mode} onClick={() => setViewMode(mode)} title={mode === 'photon' ? 'Quantum particle: single-photon path tracing with superposition' : mode === 'emwave' ? 'Classical EM: sinusoidal wave lines on all beam paths, amplitude from OPD' : 'Show both photon particles and EM waves simultaneously'} style={{
            fontSize: 9, padding: '4px 10px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            background: viewMode === mode ? 'rgba(255,255,255,0.18)' : 'transparent',
            border: viewMode === mode ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
            color: viewMode === mode ? '#fff' : 'rgba(255,255,255,0.45)',
            transition: 'all 150ms',
          }}>{label}</button>
        ))}
      </div>

      {/* Fire controls — always visible in all 3 modes */}
      <div style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 10, display: 'flex', gap: 5, alignItems: 'center' }}>
        <SimBtn label="Send 1" onClick={fireOne} />
        <SimBtn label="×50"    onClick={() => fireN(50)} />
        <SimBtn label="×500"   onClick={() => fireN(500)} />
        <SimBtn label={simRef.current.continuous ? '■ Stop' : '▶ Auto'} onClick={toggleContinuous} active={simRef.current.continuous} />
        <SimBtn label="Reset" onClick={resetCounts} danger />
      </div>
      {/* Title + hint */}
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
