import * as THREE from 'three';

/**
 * Creates a compensator plate — a thin glass plate inserted in one arm
 * to equalize the glass path length through the beam splitter.
 *
 * The plate introduces an additional optical path: (n - 1) × d
 * where n = refractive index and d = plate thickness.
 */
export const createCompensatorPlate = () => {
  const group = new THREE.Group();
  group.name = 'CompensatorPlate';

  const width = 0.022;
  const height = 0.022;
  const thickness = 0.003;

  // Glass plate
  const plateGeo = new THREE.BoxGeometry(thickness, height, width);
  const plateMat = new THREE.MeshPhysicalMaterial({
    color: 0xd0e8ff,
    metalness: 0.0,
    roughness: 0.05,
    transmission: 0.92,
    thickness: thickness,
    ior: 1.5168, // BK7 glass
    transparent: true,
    opacity: 0.35,
  });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.castShadow = true;
  group.add(plate);

  // Thin frame around the plate
  const frameThickness = 0.002;
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a3a,
    metalness: 0.75,
    roughness: 0.35,
  });

  // Top frame
  const topFrame = new THREE.Mesh(
    new THREE.BoxGeometry(thickness + 0.002, frameThickness, width + 0.002),
    frameMat
  );
  topFrame.position.y = height / 2 + frameThickness / 2;
  group.add(topFrame);

  // Bottom frame
  const bottomFrame = topFrame.clone();
  bottomFrame.position.y = -(height / 2 + frameThickness / 2);
  group.add(bottomFrame);

  // Mount post
  const postGeo = new THREE.CylinderGeometry(0.003, 0.004, 0.015, 12);
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a3a, metalness: 0.8, roughness: 0.3,
  });
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.y = -(height / 2 + frameThickness + 0.0075);
  post.castShadow = true;
  group.add(post);

  // Store physics parameters
  group.userData.physicsParams = {
    refractiveIndex: 1.5168,  // BK7
    thickness: thickness,
    angle: 0,                 // tilt angle (radians)
    opticalPathContribution: (1.5168 - 1) * thickness, // (n-1) × d
  };

  /**
   * Update the optical path contribution based on tilt angle.
   * At angle θ, path = d × (n/cos(θ_refracted) - 1/cos(θ))
   * Approximate for small θ: path ≈ (n-1) × d × (1 + θ²(n+1)/(2n))
   */
  group.userData.updateTilt = (tiltAngle) => {
    const n = group.userData.physicsParams.refractiveIndex;
    const d = group.userData.physicsParams.thickness;
    const tiltFactor = 1 + (tiltAngle * tiltAngle * (n + 1)) / (2 * n);
    group.userData.physicsParams.opticalPathContribution = (n - 1) * d * tiltFactor;
    group.userData.physicsParams.angle = tiltAngle;
  };

  return group;
};
