/**
 * Noise Generator Module
 *
 * Provides stochastic noise models for the interferometer simulation:
 * 1. Phase noise (Wiener process / random walk from laser linewidth)
 * 2. 1/f (pink) noise for environmental vibrations
 * 3. Seismic vibration resonances
 * 4. White Gaussian noise
 */

// ---- Box-Muller transform for Gaussian random numbers ----
let spareGaussian = null;

const gaussianRandom = (mean = 0, stddev = 1) => {
  if (spareGaussian !== null) {
    const val = mean + stddev * spareGaussian;
    spareGaussian = null;
    return val;
  }
  let u, v, s;
  do {
    u = Math.random() * 2 - 1;
    v = Math.random() * 2 - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);
  const mul = Math.sqrt(-2 * Math.log(s) / s);
  spareGaussian = v * mul;
  return mean + stddev * u * mul;
};

/**
 * Generate a Wiener process (Brownian motion) time series.
 * Models laser phase noise: φ(t) drifts as a random walk.
 *
 * The diffusion coefficient D = π × Δν (for Lorentzian linewidth Δν).
 * Phase variance: ⟨Δφ²⟩ = 2D × Δt
 *
 * @param {number} numSamples - Number of time steps
 * @param {number} dt - Time step (seconds)
 * @param {number} linewidth - Laser linewidth Δν (Hz)
 * @returns {Float64Array} Phase noise values (radians)
 */
export const wienerPhaseNoise = (numSamples, dt, linewidth) => {
  const D = Math.PI * linewidth; // diffusion coefficient
  const sigma = Math.sqrt(2 * D * dt);
  const noise = new Float64Array(numSamples);
  noise[0] = 0;
  for (let i = 1; i < numSamples; i++) {
    noise[i] = noise[i - 1] + gaussianRandom(0, sigma);
  }
  return noise;
};

/**
 * Generate 1/f (pink) noise using the Voss-McCartney algorithm.
 * Used for environmental/seismic low-frequency vibrations.
 *
 * @param {number} numSamples - Number of samples
 * @param {number} amplitude - Peak amplitude (meters for displacement)
 * @param {number} numOctaves - Number of octave layers (default 8)
 * @returns {Float64Array} Pink noise time series
 */
export const pinkNoise = (numSamples, amplitude = 1e-9, numOctaves = 8) => {
  const noise = new Float64Array(numSamples);
  const octaveValues = new Float64Array(numOctaves);

  // Initialize octave values
  for (let j = 0; j < numOctaves; j++) {
    octaveValues[j] = gaussianRandom();
  }

  for (let i = 0; i < numSamples; i++) {
    // Update octaves at different rates (power-of-two intervals)
    for (let j = 0; j < numOctaves; j++) {
      if (i % (1 << j) === 0) {
        octaveValues[j] = gaussianRandom();
      }
    }
    let sum = 0;
    for (let j = 0; j < numOctaves; j++) {
      sum += octaveValues[j];
    }
    noise[i] = (sum / numOctaves) * amplitude;
  }

  return noise;
};

/**
 * Generate seismic vibration noise with specific resonance peaks.
 * Models mechanical resonances of the optical table/mounts.
 *
 * @param {number} numSamples
 * @param {number} dt - Time step (seconds)
 * @param {number} amplitude - Peak displacement (meters)
 * @param {number[]} resonanceFreqs - Resonance frequencies (Hz)
 * @returns {Float64Array} Seismic displacement noise
 */
export const seismicNoise = (
  numSamples,
  dt,
  amplitude = 1e-9,
  resonanceFreqs = [15, 30, 60, 120]
) => {
  const noise = new Float64Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i * dt;
    let val = 0;
    for (const freq of resonanceFreqs) {
      // Each resonance has random phase and decaying amplitude with frequency
      const phaseOffset = freq * 0.7321; // deterministic-ish phase per freq
      val += (amplitude / Math.sqrt(freq)) * Math.sin(2 * Math.PI * freq * t + phaseOffset);
    }
    // Add broadband floor
    val += gaussianRandom(0, amplitude * 0.1);
    noise[i] = val;
  }

  return noise;
};

/**
 * Generate white Gaussian noise.
 * @param {number} numSamples
 * @param {number} stddev - Standard deviation
 * @returns {Float64Array}
 */
export const whiteNoise = (numSamples, stddev = 1) => {
  const noise = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    noise[i] = gaussianRandom(0, stddev);
  }
  return noise;
};

export { gaussianRandom };
