import * as THREE from 'three';
import { rayleighRange, beamRadius } from '../physics/gaussianBeam.js';
import { fringeVisibility } from '../physics/coherenceModel.js';
import fringeVertShader from '../shaders/fringePattern.vert';
import fringeFragShader from '../shaders/fringePattern.frag';

/**
 * Creates the detector screen with a GPU-accelerated ShaderMaterial
 * that computes interference fringes entirely on the GPU.
 */
export const createDetectorScreen = () => {
  const group = new THREE.Group();
  group.name = 'DetectorScreen';

  const screenSize = 0.03; // 30mm physical detector

  // ---- Fringe ShaderMaterial ----
  const fringeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      u_k:            { value: 2 * Math.PI / 632.8e-9 },
      u_opdCenter:    { value: 0.0 },
      u_tiltX:        { value: 0.0 },
      u_tiltY:        { value: 0.0 },
      u_visibility:   { value: 1.0 },
      u_beamRadiusX:  { value: 0.003 },
      u_beamRadiusY:  { value: 0.003 },
      u_phaseNoise:   { value: 0.0 },
      u_time:         { value: 0.0 },
      u_detectorSize: { value: 0.01 },
      u_noiseAmp:     { value: 0.0 },
      u_resolution:   { value: new THREE.Vector2(256, 256) },
    },
    vertexShader: fringeVertShader,
    fragmentShader: fringeFragShader,
    side: THREE.DoubleSide,
  });

  // Detector screen plane
  const screenGeo = new THREE.PlaneGeometry(screenSize, screenSize, 1, 1);
  const screen = new THREE.Mesh(screenGeo, fringeMaterial);
  screen.rotation.x = -Math.PI / 2;
  screen.position.y = 0.001;
  group.add(screen);

  // Detector housing
  const housingGeo = new THREE.BoxGeometry(screenSize + 0.006, 0.008, screenSize + 0.006);
  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    metalness: 0.7,
    roughness: 0.4,
  });
  const housing = new THREE.Mesh(housingGeo, housingMat);
  housing.position.y = -0.004;
  housing.castShadow = true;
  group.add(housing);

  // Status LED
  const ledGeo = new THREE.SphereGeometry(0.0015, 8, 8);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x00ff44 });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(screenSize / 2 + 0.002, 0.002, screenSize / 2);
  group.add(led);

  /**
   * Update shader uniforms from simulation state each frame.
   * ALL fringe computation happens on the GPU via the fragment shader.
   */
  group.userData.updateFringes = (state, elapsed) => {
    const {
      wavelength, laserLinewidth, beamWaist,
      mirror1PosX, mirror1PosZ, mirror2PosX, mirror2PosZ,
      mirror1Tip, mirror2Tip,
      shotNoiseEnabled, detectorArrayWidth,
    } = state;

    const armX = Math.sqrt(mirror1PosX ** 2 + mirror1PosZ ** 2);
    const armY = Math.sqrt(mirror2PosX ** 2 + mirror2PosZ ** 2);
    const opd = 2 * (armX - armY);

    // Gaussian beam radius at detector
    const zR = rayleighRange(beamWaist, wavelength);
    const wzX = beamRadius(beamWaist, armX * 2, zR);
    const wzY = beamRadius(beamWaist, armY * 2, zR);

    // Coherence visibility
    const vis = fringeVisibility(opd, laserLinewidth);

    // Update all uniforms
    const u = fringeMaterial.uniforms;
    u.u_k.value = 2 * Math.PI / wavelength;
    u.u_opdCenter.value = opd;
    u.u_tiltX.value = mirror1Tip;
    u.u_tiltY.value = mirror2Tip;
    u.u_visibility.value = vis;
    u.u_beamRadiusX.value = wzX;
    u.u_beamRadiusY.value = wzY;
    u.u_time.value = elapsed;
    u.u_noiseAmp.value = shotNoiseEnabled ? 0.03 : 0.0;
    u.u_resolution.value.set(detectorArrayWidth, detectorArrayWidth);
  };

  return group;
};
