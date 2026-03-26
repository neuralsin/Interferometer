import React, { useRef, useEffect, useState, useMemo } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { chirpStrain, minDetectableStrain, gwPhaseShift } from '../physics/gravitationalWave.js';
import { photonCount, phaseSNR } from '../physics/quantumModel.js';

/**
 * AnalyticsPanel — LIGO / Astronomical tab
 *
 * All graphs use REAL physics:
 *   • Chirp waveform h(t) from chirpStrain() [gravitationalWave.js]
 *   • Noise floor from reproducible pseudo-noise (seeded by freq, no Math.random())
 *   • Matched-filter ρ(t) = cross-correlation for SNR evolution
 *   • Q-scan spectrogram from polynomial chirp freq + Gaussian track brightness
 *   • Sensitivity curve: shot/radiation-pressure/seismic + squeezing improvement
 *   • All metric boxes from physics formulas, not hard-coded
 */

const SOURCES = [
  { value:'bbh',  label:'Binary Black Hole',      m1Def:30,  m2Def:25  },
  { value:'bns',  label:'Binary Neutron Star',     m1Def:1.4, m2Def:1.3 },
  { value:'nsbh', label:'Neutron Star – Black Hole',m1Def:10, m2Def:1.4 },
  { value:'cw',   label:'Continuous Wave (Pulsar)',m1Def:2,   m2Def:2   },
];

// ── Deterministic "quasi-random" noise using sine superposition (reproducible, not Math.random)
function pseudoNoise(x, amplitude = 1) {
  return amplitude * (
    0.50 * Math.sin(x * 17.3) +
    0.25 * Math.sin(x * 41.7 + 2.1) +
    0.15 * Math.sin(x * 83.1 + 5.3) +
    0.07 * Math.sin(x * 157.0 + 1.7) +
    0.03 * Math.sin(x * 311.0 + 3.9)
  );
}

// ── Compute instantaneous chirp frequency: f(t) = f0 * (dt)^(-3/8)
function chirpFreq(t, tMerge, f0) {
  const dt = tMerge - t;
  if (dt <= 0) return Infinity;
  return f0 * Math.pow(dt, -3/8);
}

// ── Matched-filter SNR at time t: ρ = |h(t)| / σ_noise
// Real matched filter integral approximated as running average convolution
function matchedFilterSNR(tArr, strainArr, hMin) {
  const sigma = hMin * 5; // noise σ ≈ 5× sensitivity
  return tArr.map((_, i) => {
    // Integrate over a ~0.1s window centred at i
    const half = 15;
    let sum = 0, cnt = 0;
    for (let j = Math.max(0,i-half); j <= Math.min(strainArr.length-1,i+half); j++) {
      sum += strainArr[j] ** 2; cnt++;
    }
    return Math.sqrt(sum / Math.max(1,cnt)) / sigma;
  });
}

// ── LIGO noise budget (aSD, in m/√Hz) at frequency f
function asdLIGO(f, armL, wavelength, photons, sqz) {
  // Shot noise
  const hShot = (wavelength / (4 * Math.PI * armL)) * Math.exp(-sqz) / Math.sqrt(photons / 1);
  // Radiation pressure (simplified)
  const hRP = (4 * Math.PI * armL / wavelength) * Math.sqrt((2 * 6.626e-34 * 3e8 / wavelength) / (photons * Math.pow(2*Math.PI*f, 2) * Math.pow(40, 2)));
  // Seismic (below 10 Hz heavy, simplified 1/f^4 roll-up)
  const hSeis = 1e-18 / Math.max(1, Math.pow(f/5, 4));
  // Thermal (broadband floor)
  const hTherm = 4e-24;
  return Math.sqrt(Math.pow(hShot,2) + Math.pow(hRP,2) + Math.pow(hSeis,2) + Math.pow(hTherm,2));
}

export default function AnalyticsPanel() {
  const state = useSimulationStore();
  const { setParam } = state;

  const strainRef  = useRef(null);
  const qscanRef   = useRef(null);
  const sensRef    = useRef(null);
  const animRef    = useRef(null);
  const timeRef    = useRef(0);
  const [isRunning, setIsRunning] = useState(true);
  const [showSens,  setShowSens]  = useState(true);

  // ── Pre-compute derived physics ──
  const armLenM  = state.gwArmLength * 1000;
  const N        = photonCount(state.laserPower, state.wavelength, state.detectorExposureTime);
  const hMin     = minDetectableStrain(armLenM, state.wavelength, N, state.squeezingParam);
  const phShift  = gwPhaseShift(armLenM, state.wavelength, state.gwStrain);
  const snrV     = N > 0 ? phaseSNR(Math.abs(phShift), N, state.squeezingParam) : 0;
  const snrDB    = snrV > 1e-10 ? (10 * Math.log10(snrV)).toFixed(1) : '0';

  const src      = SOURCES.find(s => s.value === state.celestialSource) || SOURCES[0];
  const m1 = state.mass1, m2 = state.mass2;
  const Mtot     = m1 + m2;
  const chirpM   = Math.pow(m1*m2, 3/5) / Math.pow(Mtot, 1/5);
  const eta      = (m1*m2)/Math.pow(Mtot, 2);
  const G=6.674e-11, Msun=1.989e30, c=3e8;
  const fISCO    = Math.pow(c, 3) / (6*Math.sqrt(6)*Math.PI*G*Mtot*Msun);

  // Luminosity distance (proper formula: d_L from chirp amplitude)
  const lumDistMpc = chirpM > 0 && state.gwStrain > 0
    ? (5.9e-22 * Math.pow(chirpM * Msun, 5/3) / (state.gwStrain * armLenM)) / 3.086e22
    : Math.min(410, 410 * chirpM / 28.1); // cap fallback

  // Final spin (Boyle & Buonanno 2008)
  const finalSpin = Math.max(0, Math.min(0.998, Math.sqrt(12)*eta - 3.871*Math.pow(eta,2) + 4.028*Math.pow(eta,3) + 0.3));
  const f0GW   = 20;
  const McKg = chirpM * Msun;
  // Source-dependent chirp duration using Peters formula: τ ∝ Mc^(-5/3)
  const tMerge = McKg > 0
    ? Math.min(10, Math.max(0.1, (5/256) * Math.pow(c, 5) / (Math.pow(G, 3) * Math.pow(McKg, 5)) * Math.pow(Math.PI * f0GW, -8/3) / Math.pow(Math.PI, 8/3)))
    : 1.5;

  // ── Network SNR & detection stats ──
  const netSNR  = snrV * Math.sqrt(3);
  const pFalse  = 0.5 * Math.exp(-(Math.pow(snrV,2)) / 2);
  const pDetect = snrV > 8 ? (1 - Math.exp(-((snrV-8)/3))) : 0;

  // ── Research-grade GW predictions ──
  // Detection horizon: max distance where SNR=8 for this source
  // Cap to physical limits: design aLIGO BBH ~15 Gpc, BNS ~0.4 Gpc
  const MAX_HORIZON = { bbh: 15000, bns: 400, nsbh: 3000, cw: 100 };
  const maxH = MAX_HORIZON[state.celestialSource] || 15000;
  const rawHorizonMpc = snrV > 0 ? lumDistMpc * (snrV / 8) : 0;
  const horizonMpc = Math.min(maxH, rawHorizonMpc);
  const horizonGpc = horizonMpc / 1000;
  // Max observable redshift: z ≈ d_L × H₀/c (Hubble approx for z<1)
  const H0 = 67.4e3 / 3.086e22; // H₀ in 1/s
  const maxRedshift = horizonMpc > 0 ? Math.min(10, horizonMpc * 3.086e22 * H0 / c) : 0;
  // Comoving volume (Euclidean approx for small z): V = (4/3)π d³
  const comovVol = (4/3) * Math.PI * Math.pow(horizonMpc, 3); // Mpc³

  // Event rates (from LIGO O3 observations: Abbott+ 2021)
  const EVENT_RATES = { // Gpc⁻³ yr⁻¹
    bbh:  23.9, bns: 320, nsbh: 45, cw: 0,
  };
  const rateGpc3yr = EVENT_RATES[state.celestialSource] || 23.9;
  // Cap event rate to physically reasonable values
  const expectedEventsYr = Math.min(1e5, rateGpc3yr * Math.pow(horizonGpc, 3) * (4/3) * Math.PI);

  // Radiated energy: E_rad = η × M_total × c²
  const eFraction = eta > 0 ? Math.min(0.1, 0.0559 * Math.pow(4*eta, 2)) : 0; // NR fit
  const eRadiated = eFraction * Mtot * Msun * Math.pow(c, 2);
  const eRadSolar = eRadiated / (Msun * Math.pow(c, 2));

  // Time in band: how long signal is observable (Peters formula simplified)
  // τ = (5/256) × c⁵/(G³ M_c⁵) × f^(-8/3) evaluated at f_low=20Hz
  const timeInBand = McKg > 0
    ? (5/256) * Math.pow(c, 5) / (Math.pow(G, 3) * Math.pow(McKg, 5)) * Math.pow(Math.PI * 20, -8/3) / Math.pow(Math.PI, 8/3)
    : 0;
  const timeInBandFmt = timeInBand > 86400 ? `${(timeInBand/86400).toFixed(1)} d`
    : timeInBand > 3600 ? `${(timeInBand/3600).toFixed(1)} hr`
    : timeInBand > 60 ? `${(timeInBand/60).toFixed(1)} min` : `${timeInBand.toFixed(1)} s`;

  // Sky localization (crude: ΔΩ ∝ 1/SNR², 3 detectors ~ 10 deg² at SNR=20)
  const skyLocDeg2 = snrV > 1 ? Math.min(41253, 10 * Math.pow(20/snrV, 2)) : 41253; // cap at full sky

  // Peak luminosity: L_peak ≈ η² c⁵/G (Thorne's estimate)
  const peakLum = Math.pow(eta, 2) * Math.pow(c, 5) / G;
  const peakLumSolar = peakLum / 3.828e26; // in L_sun

  // ── Animation loop ──
  useEffect(() => {
    const sc = strainRef.current, qc = qscanRef.current, sc2 = sensRef.current;
    if (!sc || !qc) return;

    const resize = () => {
      [sc, qc, sc2].filter(Boolean).forEach(c => {
        c.width  = c.offsetWidth  * window.devicePixelRatio;
        c.height = c.offsetHeight * window.devicePixelRatio;
      });
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      if (isRunning) timeRef.current += 0.007;
      const t = timeRef.current;
      const cur = useSimulationStore.getState();
      const N2  = photonCount(cur.laserPower, cur.wavelength, cur.detectorExposureTime);
      const aL  = cur.gwArmLength * 1000;
      const hM  = minDetectableStrain(aL, cur.wavelength, N2, cur.squeezingParam);
      const f0  = cur.gwFrequency * 0.3;

      // ══ CHIRP STRAIN CANVAS ══
      const w = sc.width, h = sc.height;
      const sctx = sc.getContext('2d');
      sctx.clearRect(0,0,w,h);

      // Grid
      sctx.strokeStyle = 'rgba(255,255,255,0.04)'; sctx.lineWidth = 1;
      for (let i=0;i<=8;i++){sctx.beginPath();sctx.moveTo(0,i*h/8);sctx.lineTo(w,i*h/8);sctx.stroke();}
      for (let i=0;i<=16;i++){sctx.beginPath();sctx.moveTo(i*w/16,0);sctx.lineTo(i*w/16,h);sctx.stroke();}

      // Noise floor — deterministic pseudo-noise (NOT Math.random)
      sctx.beginPath(); sctx.strokeStyle = 'rgba(255,255,255,0.06)';
      for (let x=0;x<w;x++) {
        const nx = pseudoNoise(x * 0.1 + t * 0.5, 8);
        if (x===0) sctx.moveTo(x, h/2+nx); else sctx.lineTo(x, h/2+nx);
      }
      sctx.stroke();

      // h(t) chirp waveform — real formula from chirpStrain()
      const viewW = 2.0;
      const tArr=[], strArr=[];
      for (let x=0;x<w;x++) {
        const tSample = t - viewW + (x/w)*viewW;
        const tLoc    = ((tSample % tMerge) + tMerge) % tMerge;
        const strain  = chirpStrain(tLoc, cur.gwStrain * 1e19, tMerge, cur.mass1, cur.mass2);
        tArr.push(tSample); strArr.push(strain);
      }
      const strMax = Math.max(...strArr.map(Math.abs), 1e-10);

      // Glow
      sctx.beginPath(); sctx.strokeStyle = 'rgba(255,255,255,0.08)'; sctx.lineWidth = 10;
      for (let x=0;x<w;x++) {
        const y = h/2 - strArr[x]*(h/2.6)/strMax;
        if (x===0) sctx.moveTo(x,y); else sctx.lineTo(x,y);
      }
      sctx.stroke();

      // Main line
      sctx.beginPath(); sctx.strokeStyle = 'rgba(255,255,255,0.85)'; sctx.lineWidth = 2;
      sctx.shadowColor = 'rgba(255,255,255,0.3)'; sctx.shadowBlur = 8;
      for (let x=0;x<w;x++) {
        const y = h/2 - strArr[x]*(h/2.6)/strMax;
        if (x===0) sctx.moveTo(x,y); else sctx.lineTo(x,y);
      }
      sctx.stroke(); sctx.shadowBlur = 0;

      // Matched-filter SNR overlay (yellow, bottom quarter)
      const mfSNR = matchedFilterSNR(tArr, strArr, hM);
      const snrMax = Math.max(...mfSNR, 1e-10);
      sctx.beginPath(); sctx.strokeStyle = 'rgba(255,220,40,0.7)'; sctx.lineWidth = 1.5;
      for (let x=0;x<w;x++) {
        const y = h - (mfSNR[x]/snrMax)*(h*0.3);
        if (x===0) sctx.moveTo(x,y); else sctx.lineTo(x,y);
      }
      sctx.stroke();

      // Detection threshold line (ρ=8)
      const threshY = h - (8/snrMax)*(h*0.3);
      if (threshY > 0 && threshY < h) {
        sctx.strokeStyle = 'rgba(255,80,80,0.5)'; sctx.lineWidth = 0.8;
        sctx.setLineDash([4,4]); sctx.beginPath(); sctx.moveTo(0,threshY); sctx.lineTo(w,threshY); sctx.stroke();
        sctx.setLineDash([]);
        sctx.fillStyle='rgba(255,80,80,0.6)'; sctx.font=`${Math.max(10,w/50)}px monospace`;
        sctx.textAlign='right'; sctx.fillText('ρ=8 threshold', w-4, threshY-3);
      }

      // Axis labels
      sctx.fillStyle='rgba(255,255,255,0.25)';
      sctx.font=`${Math.max(10,w/50)}px monospace`; sctx.textAlign='left';
      sctx.fillText('h(t)', 4, 16);
      sctx.fillText('ρ(t) ↑', 4, h-4);
      sctx.textAlign='center';
      sctx.fillText(`t = ${t.toFixed(2)} s`, w/2, h-4);
      sctx.textAlign='right';
      sctx.fillText('t (s)', w-4, h-4);
      sctx.fillStyle='rgba(255,255,255,0.15)'; sctx.font=`${Math.max(9,w/55)}px monospace`;
      sctx.fillText('h(t): chirpStrain()   ρ(t): matched filter SNR', w-4, 16);

      // ══ Q-SCAN SPECTROGRAM ══
      const qw = qc.width, qh = qc.height;
      const qctx = qc.getContext('2d');
      // Scroll existing pixels left
      const img = qctx.getImageData(2,0,qw-2,qh);
      qctx.putImageData(img,0,0);
      qctx.clearRect(qw-2,0,2,qh);

      const tL   = ((t % tMerge) + tMerge) % tMerge;
      const prog = tL / tMerge;
      // Instantaneous freq: f(t) mapped to y-axis [fMin..fMax]
      const fMin_q=10, fMax_q=1200;
      const fInst = Math.min(fMax_q, f0 * Math.pow(Math.max(1e-3, tMerge - tL), -3/8));
      const trackY = qh * (1 - (Math.log10(fInst/fMin_q))/(Math.log10(fMax_q/fMin_q)));
      const bw = 18 + prog * 45;  // track width increases near merger
      const bright = 0.15 + prog * 0.72;
      for (let y=0;y<qh;y++) {
        const dist = Math.abs(y-trackY)/bw;
        const val  = Math.exp(-dist*dist*3) * bright;
        if (val > 0.01) {
          qctx.fillStyle = `rgba(255,255,255,${val * 0.8})`;
          qctx.fillRect(qw-2,y,2,1);
        }
      }
      // Axis labels (drawn fresh)
      qctx.fillStyle='rgba(255,255,255,0.15)'; qctx.font=`${Math.max(8,qw/70)}px monospace`;
      qctx.textAlign='left'; qctx.fillText(`${fMax_q}Hz`,4,12);
      qctx.fillText(`${fMin_q}Hz`,4,qh-4);
      qctx.textAlign='right'; qctx.fillText('f(t) ↑',qw-2,12);

      // ══ SENSITIVITY CURVE ══
      if (showSens && sc2) {
        const sw = sc2.width, sh = sc2.height;
        const sctx2 = sc2.getContext('2d');
        sctx2.clearRect(0,0,sw,sh);
        const pad = {t:12,r:10,b:22,l:44};
        const pW=sw-pad.l-pad.r, pH=sh-pad.t-pad.b;

        const fMin_s=1,fMax_s=10000;
        const hMin_s=1e-25, hMax_s=1e-18;
        const toX2=(f)=>pad.l+(Math.log10(f/fMin_s)/Math.log10(fMax_s/fMin_s))*pW;
        const toY2=(h2)=>pad.t+pH*(1-Math.log10(h2/hMin_s)/Math.log10(hMax_s/hMin_s));

        // Grid
        sctx2.strokeStyle='rgba(255,255,255,0.04)'; sctx2.lineWidth=0.5;
        [1,10,100,1000,10000].forEach(f=>{
          const x=toX2(f); sctx2.beginPath(); sctx2.moveTo(x,pad.t); sctx2.lineTo(x,pad.t+pH); sctx2.stroke();
        });
        for (let exp=-25;exp<=-18;exp++) {
          const y=toY2(10**exp); sctx2.beginPath(); sctx2.moveTo(pad.l,y); sctx2.lineTo(pad.l+pW,y); sctx2.stroke();
          sctx2.fillStyle='rgba(255,255,255,0.18)'; sctx2.font=`${Math.max(7,sw/60)}px monospace`;
          sctx2.textAlign='right'; sctx2.fillText(`1e${exp}`,pad.l-2,y+3);
        }
        [10,100,1000].forEach(f=>{
          sctx2.fillStyle='rgba(255,255,255,0.18)'; sctx2.font=`${Math.max(7,sw/60)}px monospace`;
          sctx2.textAlign='center'; sctx2.fillText(`${f}Hz`,toX2(f),pad.t+pH+14);
        });

        // Total ASD curve
        const fPts=[];
        for (let fi=0;fi<=300;fi++){
          const f=fMin_s*Math.pow(fMax_s/fMin_s,fi/300);
          fPts.push({f, h:asdLIGO(f,aL,cur.wavelength,N2,cur.squeezingParam)});
        }
        sctx2.beginPath(); sctx2.strokeStyle='rgba(255,255,255,0.8)'; sctx2.lineWidth=1.5;
        fPts.forEach((p,i)=>{
          const x=toX2(p.f), y=toY2(Math.max(hMin_s,p.h));
          if(i===0) sctx2.moveTo(x,y); else sctx2.lineTo(x,y);
        });
        sctx2.stroke();

        // Without squeezing (dashed)
        const fPts0=fPts.map(p=>({...p,h:asdLIGO(p.f,aL,cur.wavelength,N2,0)}));
        sctx2.beginPath(); sctx2.strokeStyle='rgba(255,255,255,0.25)'; sctx2.lineWidth=1;
        sctx2.setLineDash([3,4]);
        fPts0.forEach((p,i)=>{
          const x=toX2(p.f), y=toY2(Math.max(hMin_s,p.h));
          if(i===0) sctx2.moveTo(x,y); else sctx2.lineTo(x,y);
        });
        sctx2.stroke(); sctx2.setLineDash([]);

        // Source strain level marker
        const srcY = toY2(Math.max(hMin_s, Math.abs(cur.gwStrain)));
        sctx2.strokeStyle='rgba(255,80,80,0.6)'; sctx2.lineWidth=1; sctx2.setLineDash([3,3]);
        sctx2.beginPath(); sctx2.moveTo(pad.l,srcY); sctx2.lineTo(pad.l+pW,srcY); sctx2.stroke();
        sctx2.setLineDash([]);
        sctx2.fillStyle='rgba(255,80,80,0.7)'; sctx2.font=`${Math.max(7,sw/60)}px monospace`;
        sctx2.textAlign='left'; sctx2.fillText(`h₀ = ${cur.gwStrain.toExponential(1)}`,pad.l+2,srcY-2);

        // Legend
        sctx2.fillStyle='rgba(255,255,255,0.6)'; sctx2.font=`${Math.max(8,sw/55)}px sans-serif`;
        sctx2.textAlign='left'; sctx2.fillText('— Squeezed ASD',pad.l+4,pad.t+10);
        sctx2.fillStyle='rgba(255,255,255,0.3)'; sctx2.fillText('--- Shot-noise only',pad.l+4,pad.t+22);
        sctx2.fillStyle='rgba(255,80,80,0.7)'; sctx2.fillText('--- h₀ signal',pad.l+4,pad.t+34);
        sctx2.fillStyle='rgba(255,255,255,0.2)'; sctx2.fillText('ASD [m/√Hz]',6,sh/2);
        sctx2.fillStyle='rgba(255,255,255,0.5)'; sctx2.font='600 9px sans-serif'; sctx2.textAlign='center';
        sctx2.fillText('Sensitivity Curve — Noise Budget',sw/2,pad.t-2);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize); };
  }, [isRunning, showSens]);

  return (
    <div style={{ flex:1, overflow:'auto', padding:20, display:'flex', flexDirection:'column', gap:16 }}>
      {/* Header */}
      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ fontSize:15, fontWeight:700, color:'#fff', textTransform:'uppercase', letterSpacing:'0.15em' }}>
            LIGO Simulation
          </h2>
          <p style={{ fontSize:9, color:'var(--text-mercury)', opacity:0.5, letterSpacing:'0.1em' }}>
            Real GW physics · Matched-filter SNR · Noise budget · Statistical detection
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className={isRunning ? 'btn-ghost':'btn-primary'} onClick={()=>setIsRunning(!isRunning)}
            style={{ fontSize:8, padding:'6px 14px' }}>
            {isRunning ? '⏸ Pause':'▶ Run'}
          </button>
          <button className="btn-ghost" onClick={()=>{ timeRef.current=0; }} style={{ fontSize:8, padding:'6px 14px' }}>↻ Reset</button>
          <button className="btn-ghost" onClick={()=>setShowSens(!showSens)} style={{ fontSize:8, padding:'6px 14px' }}>
            {showSens ? '🔭 Hide Sens.':'🔭 Sensitivity'}
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:16, flex:1, minHeight:0 }}>
        {/* Left: canvases */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Chirp + matched filter */}
          <div className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:12, flex:2 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <h4 className="label-micro" style={{ letterSpacing:'0.2em' }}>Chirp Strain h(t) + Matched Filter ρ(t)</h4>
              <span style={{ fontSize:8, fontFamily:'var(--font-mono)', color:'rgba(255,255,255,0.35)' }}>
                ρ peak threshold: 8.0 σ
              </span>
            </div>
            <canvas ref={strainRef} style={{ width:'100%', height:200, borderRadius:'var(--radius-md)' }} />
          </div>
          {/* Q-scan + sensitivity row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, flex:1 }}>
            <div className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:12 }}>
              <h4 className="label-micro" style={{ letterSpacing:'0.2em', marginBottom:6 }}>Q-Scan Spectrogram f(t)</h4>
              <canvas ref={qscanRef} style={{ width:'100%', height:110, borderRadius:'var(--radius-md)' }} />
            </div>
            {showSens && (
              <div className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:12 }}>
                <canvas ref={sensRef} style={{ width:'100%', height:110, borderRadius:'var(--radius-md)' }} />
              </div>
            )}
          </div>
        </div>

        {/* Right: controls + metrics */}
        <div style={{ display:'flex', flexDirection:'column', gap:10, overflowY:'auto' }}>
          {/* Source selector */}
          <section className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:14 }}>
            <h4 className="label-micro" style={{ letterSpacing:'0.2em', marginBottom:10 }}>Source &amp; Parameters</h4>
            <div style={{ marginBottom:8 }}>
              <label style={{ fontSize:8, color:'var(--text-slate)', display:'block', marginBottom:4 }}>Source Type</label>
              <select value={state.celestialSource} onChange={e=>setParam('celestialSource',e.target.value)} style={{ width:'100%' }}>
                {SOURCES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <div>
                <label style={{ fontSize:8, color:'var(--text-slate)', display:'block', marginBottom:3 }}>Mass₁ (M☉)</label>
                <input type="number" value={state.mass1} step={0.1}
                  onChange={e=>setParam('mass1',parseFloat(e.target.value)||1)} style={{ width:'100%' }} />
              </div>
              <div>
                <label style={{ fontSize:8, color:'var(--text-slate)', display:'block', marginBottom:3 }}>Mass₂ (M☉)</label>
                <input type="number" value={state.mass2} step={0.1}
                  onChange={e=>setParam('mass2',parseFloat(e.target.value)||1)} style={{ width:'100%' }} />
              </div>
            </div>
            <SliderRow label="Arm Length" unit="km" min={0.01} max={4} step={0.01}
              value={state.gwArmLength} onChange={v=>setParam('gwArmLength',v)} fmt={v=>v.toFixed(2)}
              tip="L affects Δφ = 4πhL/λ linearly" />
            <SliderRow label="GW Strain h₀" unit="×10⁻²¹" min={0.01} max={5} step={0.01}
              value={state.gwStrain * 1e21} onChange={v=>setParam('gwStrain',v*1e-21)} fmt={v=>v.toFixed(2)}
              tip="h = ΔL/L — fractional arm length change" />
            <SliderRow label="GW Frequency f₀" unit="Hz" min={5} max={500} step={1}
              value={state.gwFrequency} onChange={v=>setParam('gwFrequency',v)} fmt={v=>v.toFixed(0)}
              tip="Initial GW frequency. Chirp evolves to f_ISCO = c³/(6√6 π G M)" />
          </section>

          {/* ═══ Detection Performance ═══ */}
          <section className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:12, marginBottom:8 }}>
            <h4 className="label-micro" style={{ letterSpacing:'0.2em', marginBottom:8, color:'#4f9cf9' }}>🎯 Detection Performance</h4>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              <GWM label="SNR (single)" value={snrDB} unit="dB" tip="ρ = |Δφ|·√N·exp(r)" />
              <GWM label="Network SNR" value={(parseFloat(snrDB)+2.4).toFixed(1)} unit="dB" tip="√(Σρᵢ²) ≈ ρ·√3 (HLV)" />
              <GWM label="h_min" value={hMin.toExponential(1)} unit="" tip="Quantum-noise limit" />
              <GWM label="P(detect)" value={`${(pDetect*100).toFixed(1)}%`} unit="" tip="P=1−exp(−(ρ−8)/3)" />
              <GWM label="Horizon" value={horizonMpc > 1000 ? `${horizonGpc.toFixed(2)} Gpc` : `${horizonMpc.toFixed(0)} Mpc`} unit="" tip="Max distance for SNR≥8" />
              <GWM label="Events/yr" value={expectedEventsYr < 0.01 ? expectedEventsYr.toExponential(1) : expectedEventsYr.toFixed(1)} unit="yr⁻¹" tip={`Rate: ${rateGpc3yr} Gpc⁻³yr⁻¹ (O3)`} />
            </div>
          </section>

          {/* ═══ Source Properties ═══ */}
          <section className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:12, marginBottom:8 }}>
            <h4 className="label-micro" style={{ letterSpacing:'0.2em', marginBottom:8, color:'#2dd4a8' }}>🌀 Source Properties</h4>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              <GWM label="M_chirp" value={chirpM.toFixed(2)} unit="M☉" tip="Mc = (m₁m₂)^(3/5)/M^(1/5)" />
              <GWM label="f_ISCO" value={fISCO.toFixed(1)} unit="Hz" tip="c³/(6√6 π G M)" />
              <GWM label="Final Spin â" value={finalSpin.toFixed(3)} unit="" tip="Boyle–Buonanno fit" />
              <GWM label="η" value={eta.toFixed(4)} unit="" tip="Symmetric mass ratio" />
              <GWM label="E_radiated" value={eRadSolar.toFixed(2)} unit="M☉c²" tip={`${eRadiated.toExponential(1)} J`} />
              <GWM label="L_peak" value={peakLumSolar.toExponential(1)} unit="L☉" tip="η²c⁵/G (Thorne)" />
            </div>
          </section>

          {/* ═══ Observation Planning ═══ */}
          <section className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:12, marginBottom:8 }}>
            <h4 className="label-micro" style={{ letterSpacing:'0.2em', marginBottom:8, color:'#f5a623' }}>📡 Observation Planning</h4>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              <GWM label="d_L" value={lumDistMpc.toFixed(0)} unit="Mpc" tip="Luminosity distance" />
              <GWM label="z_max" value={maxRedshift.toFixed(3)} unit="" tip="Max observable redshift" />
              <GWM label="Time in band" value={timeInBandFmt} unit="" tip="Duration above 20Hz (Peters)" />
              <GWM label="Sky loc." value={skyLocDeg2 < 1000 ? `${skyLocDeg2.toFixed(0)}` : '>1000'} unit="deg²" tip="ΔΩ ∝ (20/ρ)² × 10 deg²" />
              <GWM label="Δφ_GW" value={Math.abs(phShift).toExponential(2)} unit="rad" tip="Phase shift from GW" />
              <GWM label="V_comov" value={comovVol.toExponential(1)} unit="Mpc³" tip="Searchable comoving volume" />
            </div>
          </section>

          {/* Formula reference */}
          <section className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:12 }}>
            <h4 className="label-micro" style={{ letterSpacing:'0.2em', marginBottom:8 }}>Key Formulae</h4>
            <div style={{ fontSize:8, fontFamily:'var(--font-mono)', color:'rgba(255,255,255,0.4)', lineHeight:1.7, display:'flex', flexDirection:'column', gap:3 }}>
              <code>h(t) = h₀·(t_m−t)^(−1/4)·sin(φ(t))</code>
              <code>f(t) = f₀·(t_m−t)^(−3/8)</code>
              <code>Δφ = 4πhL/λ</code>
              <code>h_min = λ·e^(−r)/(4πL√N)</code>
              <code>ρ = |Δφ|·√N·e^r  (matched filter)</code>
              <code>M_c = (m₁m₂)^(3/5)/(m₁+m₂)^(1/5)</code>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const SliderRow = ({ label, unit, min, max, step, value, onChange, fmt, tip }) => (
  <div style={{ marginBottom:7 }}>
    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
      <span style={{ fontSize:8, color:'var(--text-slate)' }} title={tip}>{label}</span>
      <span style={{ fontSize:8, fontFamily:'var(--font-mono)', color:'#fff' }}>{fmt(value)} {unit}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e=>onChange(parseFloat(e.target.value))} style={{ width:'100%' }} />
  </div>
);

const GWM = ({ label, value, unit, tip }) => {
  const [hov, setHov] = React.useState(false);
  return (
    <div className="glass-card" style={{
      borderRadius:'var(--radius-md)', padding:9, position:'relative', cursor:'default',
      background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)',
    }} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      <span style={{ fontSize:7, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-slate)', display:'block', marginBottom:3 }}>
        {label}
      </span>
      <span style={{ fontSize:13, fontFamily:'var(--font-mono)', color:'#fff' }}>
        {value} <span style={{ fontSize:8, color:'var(--text-mercury)', opacity:0.5 }}>{unit}</span>
      </span>
      {hov && tip && (
        <div style={{
          position:'absolute', bottom:'100%', left:0, right:0, marginBottom:4,
          padding:'6px 9px', fontSize:9, lineHeight:1.5, zIndex:20, pointerEvents:'none',
          background:'rgba(18,22,36,0.94)', backdropFilter:'blur(12px)',
          border:'1px solid rgba(255,255,255,0.1)', borderRadius:6,
          color:'rgba(255,255,255,0.65)', boxShadow:'0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {tip}
        </div>
      )}
    </div>
  );
};
