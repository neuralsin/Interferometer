import * as THREE from 'three';

/**
 * Creates a kinematic mirror mount with a reflective surface.
 * @param {string} name - Identifier for the mirror
 */
export const createMirror = (name = 'mirror') => {
  const group = new THREE.Group();
  group.name = name;

  // Mirror reflective surface (disc)
  const mirrorGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.002, 32);
  const mirrorMat = new THREE.MeshStandardMaterial({
    color: 0xeeeeff,
    metalness: 1.0,
    roughness: 0.05,
    envMapIntensity: 1.0,
  });
  const mirrorMesh = new THREE.Mesh(mirrorGeo, mirrorMat);
  mirrorMesh.rotation.z = Math.PI / 2;
  mirrorMesh.castShadow = true;
  mirrorMesh.receiveShadow = true;
  group.add(mirrorMesh);

  // Mount body (rectangular kinematic mount)
  const mountBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.006, 0.028, 0.028),
    new THREE.MeshStandardMaterial({
      color: 0x1e1e2e,
      metalness: 0.7,
      roughness: 0.4,
    })
  );
  mountBody.position.x = -0.005;
  mountBody.castShadow = true;
  group.add(mountBody);

  // Adjustment screws (2 visible knobs)
  const knobGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.008, 12);
  const knobMat = new THREE.MeshStandardMaterial({
    color: 0x444455,
    metalness: 0.9,
    roughness: 0.25,
  });

  const knob1 = new THREE.Mesh(knobGeo, knobMat);
  knob1.position.set(-0.008, 0.008, 0);
  knob1.rotation.z = Math.PI / 2;
  group.add(knob1);

  const knob2 = new THREE.Mesh(knobGeo, knobMat);
  knob2.position.set(-0.008, -0.008, 0);
  knob2.rotation.z = Math.PI / 2;
  group.add(knob2);

  // Base post
  const postGeo = new THREE.CylinderGeometry(0.004, 0.005, 0.015, 12);
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a3a,
    metalness: 0.8,
    roughness: 0.3,
  });
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.set(-0.005, -0.021, 0);
  post.castShadow = true;
  group.add(post);

  return group;
};
