// Fringe Pattern Fragment Shader
// Computes I(x,y) = |E1 + E2|^2 with partial coherence on the GPU.

uniform float u_k;             // wavenumber 2π/λ
uniform float u_opdCenter;     // central optical path difference
uniform float u_tiltX;         // mirror tilt X (radians)
uniform float u_tiltY;         // mirror tilt Y (radians)
uniform float u_visibility;    // fringe visibility |γ(τ)| ∈ [0,1]
uniform float u_beamRadiusX;   // Gaussian beam radius in arm X at detector
uniform float u_beamRadiusY;   // Gaussian beam radius in arm Y at detector
uniform float u_phaseNoise;    // instantaneous phase noise (radians)
uniform float u_time;          // elapsed time for animation
uniform float u_detectorSize;  // physical detector size in meters
uniform float u_noiseAmp;      // shot noise amplitude [0,1]
uniform vec2  u_resolution;    // texture resolution (pixels)

varying vec2 vUv;

// High quality pseudo-random for GPU noise
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Box-Muller transform for Gaussian noise on GPU
float gaussNoise(vec2 seed) {
  float u1 = max(hash(seed), 1e-6);
  float u2 = hash(seed + vec2(1.7, 3.1));
  return sqrt(-2.0 * log(u1)) * cos(6.28318530718 * u2);
}

void main() {
  // Map UV to physical coordinates centered on detector
  float halfSize = u_detectorSize * 0.5;
  float x = (vUv.x - 0.5) * u_detectorSize;
  float y = (vUv.y - 0.5) * u_detectorSize;
  float r = sqrt(x * x + y * y);

  // Gaussian amplitude envelopes
  float ampX = exp(-(r * r) / (u_beamRadiusX * u_beamRadiusX));
  float ampY = exp(-(r * r) / (u_beamRadiusY * u_beamRadiusY));

  float I1 = ampX * ampX;
  float I2 = ampY * ampY;

  // Local OPD from tilt
  float opdLocal = u_opdCenter + 2.0 * (u_tiltX * x + u_tiltY * y);

  // Phase
  float phase = u_k * opdLocal + u_phaseNoise;

  // Interference with partial coherence
  float intensity = I1 + I2 + 2.0 * sqrt(I1 * I2) * u_visibility * cos(phase);
  intensity = intensity / 4.0; // normalize to [0,1]

  // Apply shot noise on GPU
  if (u_noiseAmp > 0.0) {
    vec2 noiseSeed = gl_FragCoord.xy + vec2(u_time * 60.0, u_time * 37.0);
    float noise = gaussNoise(noiseSeed) * u_noiseAmp;
    intensity += noise;
  }

  intensity = clamp(intensity, 0.0, 1.0);

  gl_FragColor = vec4(vec3(intensity), 1.0);
}
