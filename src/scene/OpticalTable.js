import * as THREE from 'three';

/**
 * Creates a realistic optical breadboard / table mesh
 * with a 25mm tapped-hole grid pattern.
 */
export const createOpticalTable = () => {
  const group = new THREE.Group();
  group.name = 'OpticalTable';

  // Table dimensions (meters): 500mm × 500mm × 12mm
  const tableW = 0.5;
  const tableD = 0.5;
  const tableH = 0.012;

  // Main table body
  const tableGeo = new THREE.BoxGeometry(tableW, tableH, tableD);
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    metalness: 0.85,
    roughness: 0.35,
  });
  const tableMesh = new THREE.Mesh(tableGeo, tableMat);
  tableMesh.position.y = -tableH / 2;
  tableMesh.receiveShadow = true;
  group.add(tableMesh);

  // Grid of holes (25mm spacing)
  const holeSpacing = 0.025; // 25mm
  const holeRadius = 0.002;
  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x0d0d18,
    metalness: 0.9,
    roughness: 0.2,
  });
  const holeGeo = new THREE.CylinderGeometry(holeRadius, holeRadius, tableH + 0.001, 8);

  const halfW = tableW / 2 - 0.02;
  const halfD = tableD / 2 - 0.02;

  for (let x = -halfW; x <= halfW; x += holeSpacing) {
    for (let z = -halfD; z <= halfD; z += holeSpacing) {
      const hole = new THREE.Mesh(holeGeo, holeMat);
      hole.position.set(x, -tableH / 2, z);
      group.add(hole);
    }
  }

  // Subtle edge bevel via a slightly larger dark plane underneath
  const basePlate = new THREE.Mesh(
    new THREE.BoxGeometry(tableW + 0.004, 0.003, tableD + 0.004),
    new THREE.MeshStandardMaterial({ color: 0x0a0a14, metalness: 0.9, roughness: 0.4 })
  );
  basePlate.position.y = -tableH - 0.0015;
  basePlate.receiveShadow = true;
  group.add(basePlate);

  return group;
};
