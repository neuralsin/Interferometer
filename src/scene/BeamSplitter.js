import * as THREE from 'three';

/**
 * Creates a beam splitter cube positioned at the origin (intersection point).
 * A semi-transparent glass cube at 45° with a partially reflective coating.
 */
export const createBeamSplitter = () => {
  const group = new THREE.Group();
  group.name = 'BeamSplitter';

  const size = 0.02; // 20mm cube

  // Glass cube
  const cubeGeo = new THREE.BoxGeometry(size, size, size);
  const cubeMat = new THREE.MeshPhysicalMaterial({
    color: 0xc0e0ff,
    metalness: 0.0,
    roughness: 0.05,
    transmission: 0.85,
    thickness: size,
    ior: 1.5,
    transparent: true,
    opacity: 0.4,
    envMapIntensity: 0.5,
  });
  const cube = new THREE.Mesh(cubeGeo, cubeMat);
  cube.position.y = 0.015;
  cube.castShadow = true;
  group.add(cube);

  // Internal diagonal plane (the coating)
  const diagGeo = new THREE.PlaneGeometry(size * 1.414, size);
  const diagMat = new THREE.MeshStandardMaterial({
    color: 0x8ab4f8,
    metalness: 0.6,
    roughness: 0.2,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const diag = new THREE.Mesh(diagGeo, diagMat);
  diag.position.y = 0.015;
  diag.rotation.y = Math.PI / 4;
  group.add(diag);

  // Small mount pedestal
  const mountGeo = new THREE.CylinderGeometry(0.008, 0.01, 0.008, 16);
  const mountMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a3a,
    metalness: 0.8,
    roughness: 0.3,
  });
  const mount = new THREE.Mesh(mountGeo, mountMat);
  mount.position.y = 0.004;
  mount.castShadow = true;
  group.add(mount);

  return group;
};
