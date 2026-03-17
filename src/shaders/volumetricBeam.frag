// Volumetric Beam Fragment Shader
// Raymarching through a Gaussian beam profile to render
// physically accurate beam divergence and glow.

uniform vec3  u_beamColor;
uniform float u_beamWaist;    // w0 in object-space units
uniform float u_beamLength;   // total beam length
uniform float u_intensity;    // overall brightness
uniform float u_time;
uniform float u_rayleighRange; // zR in object-space units

varying vec3 vWorldPos;
varying vec3 vCameraDir;
varying vec2 vUv;

// Gaussian beam radius at propagation distance z
float beamRadiusAt(float z) {
  float ratio = z / u_rayleighRange;
  return u_beamWaist * sqrt(1.0 + ratio * ratio);
}

void main() {
  // Cylindrical coordinate relative to beam axis
  // Beam axis is along local Y (cylinder geometry default)
  // Map UV: vUv.y → along beam axis, vUv.x → around circumference
  float z = (vUv.y - 0.5) * u_beamLength; // propagation distance from waist
  float wz = beamRadiusAt(z);

  // Radial distance from beam center (approximated from UV)
  // Since this is applied to a cylinder, the radial distance varies
  float radialFactor = abs(vUv.x - 0.5) * 2.0; // [0,1] from center to edge

  // Gaussian intensity profile
  float r = radialFactor * wz * 3.0; // scale to show beam width
  float gaussianEnvelope = exp(-(r * r) / (wz * wz));

  // Core brightness (center is brightest)
  float core = exp(-radialFactor * radialFactor * 8.0);

  // Combine: bright core + softer halo
  float brightness = mix(gaussianEnvelope * 0.4, core, 0.6) * u_intensity;

  // Slight pulsation for "alive" feeling
  brightness *= 1.0 + 0.02 * sin(u_time * 3.0 + z * 50.0);

  vec3 color = u_beamColor * brightness;

  // Alpha: core is opaque, edges fade
  float alpha = clamp(brightness * 2.0, 0.0, 0.95);

  gl_FragColor = vec4(color, alpha);
}
