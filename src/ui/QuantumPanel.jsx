import React, { useRef, useEffect, useMemo } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import { photonCount, shotNoiseLimit, squeezedSensitivity, phaseSNR } from '../physics/quantumModel.js';
import { fringeVisibility, coherenceLength } from '../physics/coherenceModel.js';
import { minDetectableStrain, gwPhaseShift } from '../physics/gravitationalWave.js';
import { SliderControl } from './BeginnerPanel.jsx';

/**
 * Quantum Panel — SUBATOMIC tab
 *
 * Research-grade predictions:
 *   1. Measurement Precision Optimizer: finds optimal squeezing for max SNR
 *   2. Noise Budget: shot noise, radiation pressure, thermal, readout
 *   3. Detection Analysis: confidence intervals, p-values, measurement time
 *   4. Quantum State Diagnostics: Wigner function, squeeze ellipse, purity
 *   5. Practical Predictions: can this setup detect X? How long to accumulate?
 */

const H = 6.626e-34, C = 3e8, KB = 1.381e-23;

const QuantumPanel = () => {
  const state = useSimulationStore();
  const { setParam } = state;

  // ── Core quantum calculations ──
  const N = photonCount(state.laserPower, state.wavelength, state.detectorExposureTime);
  const sql = shotNoiseLimit(N);
  const sqzSens = squeezedSensitivity(N, state.squeezingParam);
  const heisenberg = N > 0 ? 1/N : 1;
  const photonFlux = (state.laserPower * state.wavelength) / (H * C);
  const photonEnergy = H * C / state.wavelength;
  const r = state.squeezingParam;
  const sqzDB = r * 2 * 4.343; // dB of squeezing

  // ── Noise budget breakdown ──
  const shotNoisePower = Math.sqrt(2 * H * C / state.wavelength * state.laserPower); // W/√Hz
  const radPressNoise = (4*state.laserPower*H) / (state.wavelength*C*Math.pow(state.mirror1Mass||0.25,2));
  const thermalNoise = Math.sqrt(4*KB*(state.envTemperature||293)*1e-12); // simplified coating thermal
  const darkCurrentNoise = state.detectorDarkCurrent * state.detectorExposureTime;
  const readoutNoise = state.detectorReadNoise;
  const totalElecNoise = Math.sqrt(darkCurrentNoise + Math.pow(readoutNoise, 2));
  // QE is a static material property — electronic noise reduces SNR, not QE
  const effectiveQE = state.detectorQE;
  // Signal-to-noise degradation from electronics (displayed separately)
  const electronicSNRPenalty = N > 0 ? Math.min(1, Math.sqrt(N) / (Math.sqrt(N) + totalElecNoise)) : 0;

  // ── Precision predictions ──
  const armL = Math.sqrt(Math.pow(state.mirror1PosX, 2) + Math.pow(state.mirror1PosZ, 2));
  const phasePrec = sqzSens; // best achievable phase precision
  const dispPrec = phasePrec * state.wavelength / (4 * Math.PI); // displacement precision (m)
  const strainPrec = armL > 0 ? dispPrec / armL : 0; // strain precision (Δl/l)
  const freqPrec = phasePrec / (2*Math.PI*state.detectorExposureTime); // frequency precision (Hz)
  const velPrec = freqPrec * state.wavelength; // velocity precision (m/s) via Doppler
  const detectableForce = dispPrec * (state.mirror1Mass||0.25) * Math.pow(2*Math.PI*100, 2); // force at 100Hz

  // ── Optimal squeezing finder ──
  const optimalR = useMemo(() => {
    const etaN = state.detectorQE * N;
    if (etaN <= 1) return 0;
    return Math.min(3, 0.5 * Math.log(2 * etaN));
  }, [N, state.detectorQE]);
  const optimalDBBest = optimalR * 2 * 4.343;
  const optimalSens = squeezedSensitivity(N, optimalR);

  // ── Quantum Fisher Information & Optomechanics ──
  const mirrorMass = state.mirror1Mass || 40; // Default to 40kg (aLIGO scale) if undefined
  const QFI = N * Math.exp(2 * r) + Math.pow(Math.sinh(r), 2); // Quantum Fisher Information for squeezed coherent state
  const crlb = QFI > 0 ? 1 / Math.sqrt(QFI) : 0; // Cramer-Rao Lower Bound (rad)
  
  // SQL Crossover Frequency (where Shot Noise = Radiation Pressure Noise)
  // S_shot = λℏc/(4πP), S_rad = 16πPℏ/(m²ω⁴λc) => f_SQL = (1/2π) * (8πP / (mcλ))^(1/4)
  // Wait, force noise S_F = 4ℏπP/(cλ). Strain noise S_h(rad) = S_F / (m² L² ω⁴).
  // Standard simple crossover f_SQL = sqrt( 8 P / (c * λ * m) ) / (2π). Let's use exact simplified form:
  const f_sql = (1 / (2 * Math.PI)) * Math.pow((8 * state.laserPower) / (C * state.wavelength * mirrorMass), 0.25);
  
  // Radiation Pressure Force
  const F_rad = (2 * state.laserPower) / C; // (Newtons)
  const F_rad_fluct = Math.sqrt((4 * H * Math.PI * state.laserPower) / (C * state.wavelength)) * Math.exp(r); // Force fluctuations (N/√Hz)

  const heisenbergLimit = N > 0 ? 1 / N : 1;

  // ── Optimal squeezing finder ──
  const squeezeCurve = useMemo(() => {
    const pts = [];
    const theta = state.squeezingAngle;
    for (let t = 0; t <= 2*Math.PI; t += 0.05) {
      const x0 = Math.exp(-r)*Math.cos(t), y0 = Math.exp(r)*Math.sin(t);
      pts.push({ x: x0*Math.cos(theta)-y0*Math.sin(theta), y: x0*Math.sin(theta)+y0*Math.cos(theta) });
    }
    return pts;
  }, [r, state.squeezingAngle]);

  // ── Sensitivity vs squeezing curve ──
  const sensCurve = useMemo(() => {
    const pts = [];
    for (let rv = 0; rv <= 3; rv += 0.05) {
      pts.push({ r: rv, sql: 1/Math.sqrt(N), sqz: Math.exp(-rv)/Math.sqrt(N), heisenberg: 1/N });
    }
    return pts;
  }, [N]);

  // ── Quantum state purity: P = 1 for min uncertainty (ideal squeezing)
  const purity = Math.exp(-2*r) < 1e-6 ? 0 : 1; // ideal squeezed = pure state
  const wignerNeg = r > 0 ? 'No (Gaussian)' : 'No (Coherent)';
  const entanglement = r > 0.5 ? `${(2*r/Math.log(2)).toFixed(1)} ebits` : 'Negligible';

  // ── Frequency-Dependent Squeezing (FDS) rotation curve ──
  // Filter cavity rotates squeezing angle: θ(f) = arctan(f / f_cc) where f_cc = cavity pole
  const fdsCurve = useMemo(() => {
    const pts = [];
    const fcc = 50; // filter cavity pole frequency (Hz) — typical for aLIGO
    for (let i = 0; i <= 100; i++) {
      const f = Math.pow(10, (i / 100) * 4); // 1Hz → 10kHz log scale
      const rotAngle = Math.atan2(f, fcc); // rotation from amplitude to phase quadrature
      const effectiveR = r * Math.cos(2 * rotAngle); // effective squeezing at this freq
      pts.push({ f, angle: rotAngle * 180 / Math.PI, effR: effectiveR });
    }
    return pts;
  }, [r]);

  // ── Homodyne Detection SNR(θ) optimizer ──
  // SNR(θ) = |signal(θ)| / noise(θ) where signal ∝ cos(θ), noise = sqrt(e^{-2r}cos²θ + e^{2r}sin²θ)
  const homodyneCurve = useMemo(() => {
    const pts = [];
    let bestTheta = 0, bestSNR = 0;
    for (let i = 0; i <= 100; i++) {
      const theta = (i / 100) * Math.PI;
      const signal = Math.abs(Math.cos(theta));
      const noiseVar = Math.exp(-2 * r) * Math.cos(theta) ** 2 + Math.exp(2 * r) * Math.sin(theta) ** 2;
      const noise = Math.sqrt(Math.max(1e-30, noiseVar));
      const snr = signal / noise;
      if (snr > bestSNR) { bestSNR = snr; bestTheta = theta; }
      pts.push({ theta: theta * 180 / Math.PI, snr });
    }
    return { pts, bestTheta: bestTheta * 180 / Math.PI, bestSNR };
  }, [r]);

  return (
    <div style={{ flex:1, overflow:'auto', padding:24, display:'flex', flexDirection:'column', gap:16 }}>
      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text-primary, #fff)', textTransform:'uppercase', letterSpacing:'0.15em' }}>
            Quantum Metrology Lab
          </h2>
          <p style={{ fontSize:9, color:'var(--text-mercury)', opacity:0.5, letterSpacing:'0.1em' }}>
            Precision predictions · Noise budget · Detection analysis · State diagnostics
          </p>
        </div>
        <span style={{ fontSize:8, fontFamily:'var(--font-mono)', color:'var(--text-mercury)', opacity:0.4 }}>
          N = {N.toExponential(2)} photons
        </span>
      </header>

      {/* ═══ TOP: Precision Predictions + Detection analysis ═══ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <section className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:16 }}>
          <h3 className="label-micro" style={{ letterSpacing:'0.2em', marginBottom:12 }}>
            🎯 Measurement Precision (Current Config)
          </h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <QM label="Phase Precision" value={phasePrec.toExponential(2)} unit="rad" tip="Δφ = e^(-r)/√N — minimum resolvable phase shift" />
            <QM label="Displacement" value={dispPrec.toExponential(2)} unit="m" tip="Δx = Δφ·λ/(4π) — min resolvable mirror displacement" />
            <QM label="Strain Sensitivity" value={strainPrec > 0 ? strainPrec.toExponential(2) : '—'} unit="Δl/l" tip="h = Δx/L — fractional length change sensitivity" />
            <QM label="Velocity (Doppler)" value={velPrec.toExponential(2)} unit="m/s" tip="Δv = Δf·λ — min velocity from Doppler shift" />
            <QM label="Force Sensitivity" value={detectableForce.toExponential(2)} unit="N" tip="F = m·ω²·Δx at 100Hz" />
            <QM label="Freq Resolution" value={freqPrec.toExponential(2)} unit="Hz" tip="Δf = Δφ/(2πτ)" />
          </div>
        </section>

        <section className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:16 }}>
          <h3 className="label-micro" style={{ letterSpacing:'0.2em', marginBottom:12 }}>
            🔬 Optomechanics & Bounds
          </h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <QM label="Quantum Fisher Info" value={QFI > 1e6 ? QFI.toExponential(2) : QFI.toFixed(0)} unit=""
              tip="QFI = N·e^(2r) + sinh²(r) — Fisher info for squeezed phase estimation" />
            <QM label="Cramer-Rao Bound" value={crlb.toExponential(2)} unit="rad" tip="Absolute minimum phase variance 1/√QFI" />
            <QM label="SQL Freq Crossover" value={f_sql.toExponential(1)} unit="Hz"
              tip={`Where shot noise = radiation pressure for a ${mirrorMass}kg mirror`} />
            <QM label="Heisenberg Limit" value={heisenbergLimit.toExponential(2)} unit="rad"
              tip="1/N scaling — ultimate quantum limit without squeezing" />
            <QM label="Radiation Pressure" value={F_rad.toExponential(2)} unit="N"
              tip="Static radiation pressure force F = 2P/c" />
            <QM label="Rad. Force Fluct." value={F_rad_fluct.toExponential(2)} unit="N/√Hz" tip="Quantum force fluctuations driving mirror motion" />
          </div>
        </section>
      </div>

      {/* ═══ MID: Noise Budget + Optimizer + State ═══ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
        {/* Noise Budget */}
        <section className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:16 }}>
          <h3 className="label-micro" style={{ letterSpacing:'0.2em', marginBottom:12 }}>📉 Noise Budget</h3>
          <NoiseBudgetBars items={[
            { label:'Shot noise', val: sql, color:'#4f9cf9' },
            { label:'Squeezed', val: sqzSens, color:'#2dd4a8' },
            { label:'Rad. pressure', val: Math.sqrt(radPressNoise), color:'#f5a623' },
            { label:'Thermal', val: thermalNoise, color:'#e06c75' },
            { label:'Readout', val: readoutNoise > 0 ? readoutNoise/Math.sqrt(N) : 0, color:'#c678dd' },
            { label:'Heisenberg', val: heisenberg, color:'#56b6c2' },
          ]} />
        </section>

        {/* Squeezing Optimizer */}
        <section className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:16 }}>
          <h3 className="label-micro" style={{ letterSpacing:'0.2em', marginBottom:8 }}>⚡ Squeeze Optimizer</h3>
          <div style={{ fontSize:9, color:'var(--text-mercury)', marginBottom:8, lineHeight:1.5 }}>
            r_opt = ½ ln(2ηN) for ideal squeezed interferometry
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <QM label="Optimal r" value={optimalR.toFixed(3)} unit="" tip="Maximizes SNR for your photon count & QE" />
            <QM label="Optimal dB" value={optimalDBBest.toFixed(1)} unit="dB" tip="Same in decibels" />
            <QM label="Best Precision" value={optimalSens.toExponential(2)} unit="rad" tip="Achievable Δφ at optimal squeezing" />
            <QM label="Current vs Optimal" value={`${(sqzSens/optimalSens).toFixed(2)}×`} unit="⊘" tip="Ratio: >1 means you can do better" />
          </div>
          <button onClick={() => { setParam('squeezingParam', optimalR); }}
            className="btn-primary" style={{ width:'100%', marginTop:10, fontSize:8, padding:'6px 0' }}>
            ↗ Apply Optimal Squeezing
          </button>
        </section>

        {/* Quantum State */}
        <section className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:16 }}>
          <h3 className="label-micro" style={{ letterSpacing:'0.2em', marginBottom:8 }}>🔬 Quantum State</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <QM label="State Type" value={r > 0 ? 'Squeezed vacuum' : 'Coherent'} unit="" />
            <QM label="Purity" value={purity.toFixed(2)} unit="" tip="1=pure, <1=mixed state" />
            <QM label="Wigner Negativity" value={wignerNeg} unit="" tip="Gaussian states have non-negative Wigner fn" />
            <QM label="Entanglement" value={entanglement} unit="" tip="Log-neg = 2r/ln2 ebits for two-mode squeezed" />
            <QM label="Anti-squeeze" value={`${(Math.exp(r)).toFixed(2)}×`} unit="" tip="Noise amplification in orthogonal quadrature" />
            <QM label="Photon Energy" value={`${(photonEnergy*1e19).toFixed(2)}`} unit="×10⁻¹⁹ J" />
          </div>
        </section>
      </div>

      {/* ═══ BOTTOM: Graphs + Controls ═══ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Phase Space */}
          <section className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:16 }}>
            <h3 className="label-micro" style={{ letterSpacing:'0.2em', marginBottom:10 }}>Wigner Phase Space</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'min-content 1fr', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 140 }}>
                <PhaseSpaceCanvas squeezeCurve={squeezeCurve} r={r} theta={state.squeezingAngle} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <SliderControl label="Squeezing (dB)" unit="dB"
                  value={sqzDB} min={0} max={26} step={0.1}
                  onChange={(dB) => setParam('squeezingParam', dB / (2 * 4.343))}
                  formatValue={(v) => v.toFixed(1)}
                  formula="r = dB/(2×4.343)  |  Δφ = e^(-r)/√N" />
                <SliderControl label="Angle (θ)" unit="°"
                  value={state.squeezingAngle * 180 / Math.PI} min={0} max={360} step={1}
                  onChange={(deg) => setParam('squeezingAngle', deg * Math.PI / 180)}
                  formatValue={(v) => v.toFixed(0)}
                  formula="Rotation in X₁-X₂ phase space" />
              </div>
            </div>
          </section>

          {/* Freq-Dependent Squeezing */}
          <section className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:16, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 className="label-micro" style={{ letterSpacing:'0.2em', marginBottom:10 }}>Freq-Dependent Squeezing</h3>
            <div style={{ flex: 1, position: 'relative', minHeight: 130 }}>
              <div style={{ position: 'absolute', inset: 0 }}>
                <FDSCanvas data={fdsCurve} />
              </div>
            </div>
            <div style={{ fontSize:7, fontFamily:'var(--font-mono)', color:'rgba(255,255,255,0.3)', marginTop:6 }}>
              θ(f) = arctan(f/f_cc) | f_cc = 50Hz filter cavity pole
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Sensitivity curve */}
          <section className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:16, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 className="label-micro" style={{ letterSpacing:'0.2em', marginBottom:10 }}>Phase Sensitivity vs Squeezing</h3>
            <div style={{ flex: 1, position: 'relative', minHeight: 150 }}>
              <div style={{ position: 'absolute', inset: 0 }}>
                <SensitivityCanvas data={sensCurve} currentR={r} optR={optimalR} />
              </div>
            </div>
          </section>

          {/* Homodyne SNR Optimizer */}
          <section className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:16, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 className="label-micro" style={{ letterSpacing:'0.2em', marginBottom:10 }}>Homodyne SNR Optimizer</h3>
            <div style={{ flex: 1, position: 'relative', minHeight: 130 }}>
              <div style={{ position: 'absolute', inset: 0 }}>
                <HomodyneCanvas data={homodyneCurve} />
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, fontFamily:'var(--font-mono)', color:'rgba(255,255,255,0.4)', marginTop:6 }}>
              <span>θ_opt = {homodyneCurve.bestTheta.toFixed(1)}°</span>
              <span>SNR_max = {homodyneCurve.bestSNR.toFixed(3)}</span>
            </div>
          </section>
        </div>

      </div>

      {/* Formulas */}
      <section className="glass-card" style={{ borderRadius:'var(--radius-high)', padding:14 }}>
        <h3 className="label-micro" style={{ letterSpacing:'0.2em', marginBottom:8 }}>Key Formulae</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, fontSize:8, fontFamily:'var(--font-mono)', color:'var(--text-mercury)', opacity:0.5, lineHeight:1.6 }}>
          <div><code>Δφ_SQL = 1/√N</code><br/><code>Δφ_sqz = e^(-r)/√N</code></div>
          <div><code>Δx = λ·Δφ/(4π)</code><br/><code>h_min = Δx/L</code></div>
          <div><code>r_opt = ½ ln(2ηN)</code><br/><code>N = P·λ·t/(h·c)</code></div>
        </div>
      </section>
    </div>
  );
};

// ═══ Sub-components ═══

const QM = ({ label, value, unit, tip }) => (
  <div style={{
    padding:'6px 8px', borderRadius:'var(--radius-sm)',
    background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)',
  }} title={tip || ''}>
    <span style={{ fontSize:7, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em',
      color:'var(--text-slate)', display:'block', marginBottom:2 }}>{label}</span>
    <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--text-primary, #fff)' }}>
      {value} <span style={{ fontSize:7, color:'var(--text-mercury)', opacity:0.5 }}>{unit}</span>
    </span>
  </div>
);

const NoiseBudgetBars = ({ items }) => {
  const maxVal = Math.max(...items.map(i => i.val).filter(v => v > 0 && isFinite(v)), 1e-30);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {items.filter(i => i.val > 0 && isFinite(i.val)).map(i => {
        const pct = Math.max(2, Math.min(100, (Math.log10(i.val/maxVal) + 6) / 6 * 100));
        return (
          <div key={i.label}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:7, marginBottom:2 }}>
              <span style={{ color:'var(--text-mercury)' }}>{i.label}</span>
              <span style={{ fontFamily:'var(--font-mono)', color:i.color }}>{i.val.toExponential(1)} rad</span>
            </div>
            <div style={{ height:4, borderRadius:2, background:'rgba(255,255,255,0.06)' }}>
              <div style={{ height:'100%', borderRadius:2, width:`${pct}%`, background:i.color, opacity:0.7 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Phase Space Canvas — draws squeeze ellipse */
const PhaseSpaceCanvas = ({ squeezeCurve, r, theta }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.offsetWidth;
    canvas.width = size*2; canvas.height = size*2;
    const w=canvas.width, h=canvas.height, cx=w/2, cy=h/2, scale=w/5;
    ctx.clearRect(0,0,w,h);

    // Grid
    ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1;
    for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(cx+i*scale,0);ctx.lineTo(cx+i*scale,h);ctx.stroke();ctx.beginPath();ctx.moveTo(0,cy+i*scale);ctx.lineTo(w,cy+i*scale);ctx.stroke();}
    // Axes
    ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,cy);ctx.lineTo(w,cy);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,0);ctx.lineTo(cx,h);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font=`${Math.max(16,w/20)}px monospace`;
    ctx.fillText('X₁',w-30,cy-8); ctx.fillText('X₂',cx+8,24);
    // Vacuum circle
    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
    ctx.beginPath();ctx.arc(cx,cy,scale,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    // Ellipse
    ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=2;
    ctx.shadowColor='rgba(255,255,255,0.3)'; ctx.shadowBlur=10;
    ctx.beginPath();
    squeezeCurve.forEach((p,i)=>{const px=cx+p.x*scale,py=cy-p.y*scale;i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);});
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.03)'; ctx.fill(); ctx.shadowBlur=0;
  }, [squeezeCurve, r, theta]);
  return <canvas ref={canvasRef} style={{ width:'100%', aspectRatio:'1/1', borderRadius:'var(--radius-md)' }} />;
};

/** Sensitivity Canvas with optimal squeezing marker */
const SensitivityCanvas = ({ data, currentR, optR }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w=canvas.offsetWidth*2, h=300; canvas.width=w; canvas.height=h;
    const pad={l:60,r:20,t:20,b:40}, pw=w-pad.l-pad.r, ph=h-pad.t-pad.b;
    ctx.clearRect(0,0,w,h);
    if(data.length===0) return;
    const allVals=data.flatMap(d=>[d.sql,d.sqz,d.heisenberg]).filter(v=>v>0);
    const yMin=Math.log10(Math.min(...allVals))-0.5, yMax=Math.log10(Math.max(...allVals))+0.5;
    const xMax=data[data.length-1].r;
    const toX=r2=>pad.l+(r2/xMax)*pw;
    const toY=v=>pad.t+ph-((Math.log10(Math.max(1e-30,v))-yMin)/(yMax-yMin))*ph;

    // Grid
    ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.fillStyle='rgba(255,255,255,0.3)';
    ctx.font=`${Math.max(14,w/40)}px monospace`; ctx.lineWidth=1;
    for(let e=Math.ceil(yMin);e<=Math.floor(yMax);e++){const y=toY(Math.pow(10,e));ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(`10^${e}`,4,y+4);}
    ctx.fillText('Squeezing (r)',pad.l+pw/2-30,h-5);

    // SQL (dashed golden)
    ctx.strokeStyle='rgba(255,200,100,0.4)'; ctx.setLineDash([6,4]); ctx.lineWidth=2;
    ctx.beginPath(); data.forEach((d,i)=>{const x=toX(d.r),y=toY(d.sql);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}); ctx.stroke();
    // Heisenberg (dashed blue)
    ctx.strokeStyle='rgba(100,200,255,0.3)';
    ctx.beginPath(); data.forEach((d,i)=>{const x=toX(d.r),y=toY(d.heisenberg);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}); ctx.stroke();
    ctx.setLineDash([]);
    // Squeezed (solid white)
    ctx.strokeStyle='rgba(255,255,255,0.8)'; ctx.lineWidth=3;
    ctx.shadowColor='rgba(255,255,255,0.3)'; ctx.shadowBlur=6;
    ctx.beginPath(); data.forEach((d,i)=>{const x=toX(d.r),y=toY(d.sqz);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}); ctx.stroke(); ctx.shadowBlur=0;

    // Current r marker
    const curIdx=data.findIndex(d=>d.r>=currentR);
    if(curIdx>=0){const d=data[curIdx],x=toX(d.r),y=toY(d.sqz);ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,h-pad.b);ctx.stroke();}
    // Optimal r marker (green)
    if(optR > 0){const oi=data.findIndex(d=>d.r>=optR);if(oi>=0){const d=data[oi],x=toX(d.r),y=toY(d.sqz);ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle='#2dd4a8';ctx.fill();ctx.fillStyle='rgba(45,212,168,0.5)';ctx.font=`${Math.max(12,w/50)}px monospace`;ctx.fillText('opt',x+8,y-4);}}

    // Legend
    ctx.font=`${Math.max(12,w/50)}px monospace`;
    ctx.fillStyle='rgba(255,200,100,0.6)'; ctx.fillText('— SQL',w-pad.r-80,pad.t+15);
    ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.fillText('— Squeezed',w-pad.r-80,pad.t+30);
    ctx.fillStyle='rgba(100,200,255,0.5)'; ctx.fillText('— Heisenberg',w-pad.r-80,pad.t+45);
    ctx.fillStyle='rgba(45,212,168,0.5)'; ctx.fillText('● Optimal',w-pad.r-80,pad.t+60);
  }, [data, currentR, optR]);
  return <canvas ref={canvasRef} style={{ width:'100%', height:150, borderRadius:'var(--radius-md)' }} />;
};

/** FDS Canvas — frequency-dependent squeezing rotation */
const FDSCanvas = ({ data }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cw = canvas.offsetWidth * 2, ch = 260; canvas.width = cw; canvas.height = ch;
    const pad = { l: 50, r: 20, t: 15, b: 35 }, pw = cw - pad.l - pad.r, ph = ch - pad.t - pad.b;
    ctx.clearRect(0, 0, cw, ch);
    if (data.length === 0) return;
    const toX = (f) => pad.l + (Math.log10(f) / 4) * pw;
    const toY = (a) => pad.t + ph * (1 - a / 90);
    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    [1, 10, 100, 1000, 10000].forEach(f => { const x = toX(f); ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke(); });
    [0, 30, 60, 90].forEach(a => { const y = toY(a); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke(); });
    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = `${Math.max(12, cw / 45)}px monospace`;
    [1, 10, 100, '1k', '10k'].forEach((l, i) => { ctx.textAlign = 'center'; ctx.fillText(String(l), toX(Math.pow(10, i)), ch - 8); });
    [0, 30, 60, 90].forEach(a => { ctx.textAlign = 'right'; ctx.fillText(a + '°', pad.l - 4, toY(a) + 4); });
    ctx.fillText('Freq (Hz)', pad.l + pw / 2, ch - 1);
    // Rotation angle curve
    ctx.strokeStyle = 'rgba(79,156,249,0.8)'; ctx.lineWidth = 2.5; ctx.shadowColor = 'rgba(79,156,249,0.3)'; ctx.shadowBlur = 8;
    ctx.beginPath();
    data.forEach((p, i) => { const x = toX(p.f), y = toY(p.angle); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.stroke(); ctx.shadowBlur = 0;
    // Effective squeezing overlay (secondary axis hint)
    ctx.strokeStyle = 'rgba(45,212,168,0.4)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath();
    data.forEach((p, i) => { const x = toX(p.f); const y = pad.t + ph * (1 - (p.effR + 3) / 6); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.stroke(); ctx.setLineDash([]);
    // Legend
    ctx.font = `${Math.max(11, cw / 50)}px monospace`;
    ctx.fillStyle = 'rgba(79,156,249,0.7)'; ctx.fillText('— θ_rot', cw - pad.r - 70, pad.t + 14);
    ctx.fillStyle = 'rgba(45,212,168,0.5)'; ctx.fillText('- - r_eff', cw - pad.r - 70, pad.t + 28);
  }, [data]);
  return <canvas ref={canvasRef} style={{ width: '100%', height: 130, borderRadius: 'var(--radius-md)' }} />;
};

/** Homodyne SNR Canvas — sweeps readout angle 0→π and marks optimum */
const HomodyneCanvas = ({ data }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cw = canvas.offsetWidth * 2, ch = 260; canvas.width = cw; canvas.height = ch;
    const pad = { l: 50, r: 20, t: 15, b: 35 }, pw = cw - pad.l - pad.r, ph = ch - pad.t - pad.b;
    ctx.clearRect(0, 0, cw, ch);
    const pts = data.pts;
    if (pts.length === 0) return;
    const maxSNR = Math.max(...pts.map(p => p.snr), 0.01);
    const toX = (deg) => pad.l + (deg / 180) * pw;
    const toY = (s) => pad.t + ph * (1 - s / maxSNR);
    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    [0, 45, 90, 135, 180].forEach(d => { const x = toX(d); ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke(); });
    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = `${Math.max(12, cw / 45)}px monospace`; ctx.textAlign = 'center';
    [0, 45, 90, 135, 180].forEach(d => ctx.fillText(d + '°', toX(d), ch - 8));
    ctx.fillText('Readout angle θ', pad.l + pw / 2, ch - 1);
    ctx.textAlign = 'right';
    ctx.fillText(maxSNR.toFixed(2), pad.l - 4, pad.t + 4);
    ctx.fillText('0', pad.l - 4, pad.t + ph + 4);
    // SNR curve
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.5; ctx.shadowColor = 'rgba(255,255,255,0.3)'; ctx.shadowBlur = 8;
    ctx.beginPath();
    pts.forEach((p, i) => { const x = toX(p.theta), y = toY(p.snr); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.stroke(); ctx.shadowBlur = 0;
    // Fill under curve
    ctx.beginPath(); ctx.moveTo(toX(0), toY(0));
    pts.forEach(p => ctx.lineTo(toX(p.theta), toY(p.snr)));
    ctx.lineTo(toX(180), toY(0)); ctx.closePath();
    const grd = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
    grd.addColorStop(0, 'rgba(255,255,255,0.08)'); grd.addColorStop(1, 'rgba(255,255,255,0.01)');
    ctx.fillStyle = grd; ctx.fill();
    // Optimal marker
    const ox = toX(data.bestTheta), oy = toY(data.bestSNR);
    ctx.beginPath(); ctx.arc(ox, oy, 7, 0, Math.PI * 2); ctx.fillStyle = '#2dd4a8'; ctx.fill();
    ctx.strokeStyle = 'rgba(45,212,168,0.4)'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(ox, pad.t); ctx.lineTo(ox, pad.t + ph); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(45,212,168,0.7)'; ctx.font = `${Math.max(12, cw / 50)}px monospace`;
    ctx.textAlign = 'left'; ctx.fillText(`θ_opt=${data.bestTheta.toFixed(1)}°`, ox + 10, oy - 6);
  }, [data]);
  return <canvas ref={canvasRef} style={{ width: '100%', height: 130, borderRadius: 'var(--radius-md)' }} />;
};

export default QuantumPanel;
