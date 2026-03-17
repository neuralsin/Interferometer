import * as THREE from 'three';
import { rayleighRange } from '../physics/gaussianBeam.js';
import volumetricVert from '../shaders/volumetricBeam.vert';
import volumetricFrag from '../shaders/volumetricBeam.frag';

/**
 * Creates the laser beam paths for the Michelson Interferometer
 * using volumetric ShaderMaterial for Gaussian beam rendering.
 */
export const createLaserBeams = () => {
  const group = new THREE.Group();
  group.name = 'LaserBeams';

  const defaultColor = new THREE.Color(0xff3333);
  const beamWaist = 0.5e-3;
  const wavelength = 632.8e-9;
  const zR = rayleighRange(beamWaist, wavelength);

  // Scale zR to scene units (meters → scene scale)
  const sceneZR = zR; // scene is in meters

  const createVolumetricBeam = (start, end, name) => {
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const direction = dir.clone().normalize();

    const beamRadius = 0.004; // visual cylinder radius

    // Core beam with volumetric shader
    const coreGeo = new THREE.CylinderGeometry(beamRadius, beamRadius, length, 16, 1, true);
    const coreMat = new THREE.ShaderMaterial({
      uniforms: {
        u_beamColor:     { value: defaultColor.clone() },
        u_beamWaist:     { value: 0.001 },
        u_beamLength:    { value: length },
        u_intensity:     { value: 1.5 },
        u_time:          { value: 0 },
        u_rayleighRange: { value: Math.max(sceneZR, 0.01) },
      },
      vertexShader: volumetricVert,
      fragmentShader: volumetricFrag,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.copy(midpoint);
    core.userData.isBeam = true;
    core.userData.isVolumetric = true;
    core.name = name;

    // Orient to beam direction
    const axis = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, direction);
    core.quaternion.copy(quaternion);

    return core;
  };

  const bsPos = new THREE.Vector3(0, 0.015, 0);
  const tableHeight = 0.015;

  // 1. Incoming: laser source → BS
  const laserPos = new THREE.Vector3(-0.22, tableHeight, 0);
  group.add(createVolumetricBeam(laserPos, bsPos, 'beam_incoming'));

  // 2. Transmitted: BS → Mirror X
  const mirrorXPos = new THREE.Vector3(0.18, tableHeight, 0);
  group.add(createVolumetricBeam(bsPos, mirrorXPos, 'beam_arm_x'));

  // 3. Reflected: BS → Mirror Y
  const mirrorYPos = new THREE.Vector3(0, tableHeight, -0.18);
  group.add(createVolumetricBeam(bsPos, mirrorYPos, 'beam_arm_y'));

  // 4. Return: Mirror X → BS
  group.add(createVolumetricBeam(mirrorXPos, bsPos, 'beam_return_x'));

  // 5. Return: Mirror Y → BS
  group.add(createVolumetricBeam(mirrorYPos, bsPos, 'beam_return_y'));

  // 6. Output: BS → Detector
  const detectorPos = new THREE.Vector3(0, tableHeight, 0.18);
  group.add(createVolumetricBeam(bsPos, detectorPos, 'beam_to_detector'));

  // Laser source emitter
  const emitterGeo = new THREE.BoxGeometry(0.015, 0.012, 0.012);
  const emitterMat = new THREE.MeshStandardMaterial({
    color: 0x222233, metalness: 0.8, roughness: 0.3,
    emissive: 0x330000, emissiveIntensity: 0.3,
  });
  const emitter = new THREE.Mesh(emitterGeo, emitterMat);
  emitter.position.set(-0.23, tableHeight, 0);
  emitter.castShadow = true;
  group.add(emitter);

  // Laser housing label
  const labelGeo = new THREE.BoxGeometry(0.02, 0.003, 0.008);
  const labelMat = new THREE.MeshStandardMaterial({
    color: 0x880000, emissive: 0x440000, emissiveIntensity: 0.8,
  });
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.position.set(-0.23, tableHeight + 0.009, 0);
  group.add(label);

  return group;
};
