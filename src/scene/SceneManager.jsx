import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import useSimulationStore from '../store/simulationStore.js';
import { createOpticalTable } from './OpticalTable.js';
import { createDetectorScreen } from './DetectorScreen.js';
import { wavelengthToColor } from '../physics/basicInterference.js';

/**
 * SceneManager — 3D Michelson Interferometer viewport
 * Uses near-top-down camera so the interferometer layout is clearly readable.
 * All beam paths update dynamically from store mirror positions.
 */
const SceneManager = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // ---- Scene ----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1525);

    // ---- Camera (near-top-down for readable interferometer layout) ----
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, 100);
    camera.position.set(0, 0.55, 0.15);
    camera.lookAt(0, 0, -0.02);

    // ---- Renderer ----
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.8;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // ---- Controls ----
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.15;
    controls.maxDistance = 2;
    controls.target.set(0, 0, -0.02);

    // ---- Lighting (bright enough to see all components clearly) ----
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const mainLight = new THREE.DirectionalLight(0xfff8f0, 1.2);
    mainLight.position.set(0.3, 1.2, 0.4);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(2048, 2048);
    scene.add(mainLight);
    const fillLight = new THREE.DirectionalLight(0xd0e0ff, 0.6);
    fillLight.position.set(-0.5, 0.8, -0.3);
    scene.add(fillLight);
    const bsSpot = new THREE.PointLight(0xffffff, 0.8, 0.6);
    bsSpot.position.set(0, 0.15, 0);
    scene.add(bsSpot);

    // ---- Post Processing ----
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.5, 0.2, 0.85));

    // ---- Optical Table ----
    const table = createOpticalTable();
    scene.add(table);

    // ---- Create Optical Components ----
    const TH = 0.015; // table height
    const beamColor = new THREE.Color(0xff3333);

    // Beam Splitter (glass cube at origin, rotated 45°)
    const bsGroup = new THREE.Group();
    bsGroup.name = 'BeamSplitter';
    const bsSize = 0.028;
    const bsCube = new THREE.Mesh(
      new THREE.BoxGeometry(bsSize, bsSize, bsSize),
      new THREE.MeshPhysicalMaterial({
        color: 0xd0eaff, metalness: 0.1, roughness: 0.05,
        transmission: 0.7, thickness: bsSize, ior: 1.5,
        transparent: true, opacity: 0.55,
      })
    );
    bsCube.rotation.y = Math.PI / 4;
    bsCube.position.y = TH;
    bsCube.castShadow = true;
    bsGroup.add(bsCube);
    // BS coating diagonal
    const bsDiag = new THREE.Mesh(
      new THREE.PlaneGeometry(bsSize * 1.414, bsSize),
      new THREE.MeshStandardMaterial({ color: 0xa0c4ff, metalness: 0.5, roughness: 0.15, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    bsDiag.rotation.y = Math.PI / 4;
    bsDiag.position.y = TH;
    bsGroup.add(bsDiag);
    scene.add(bsGroup);

    // Mirror 1 (X-arm, along +X axis)
    const mirror1Group = createMirrorMesh('M1');
    mirror1Group.position.set(0.175, TH, 0);
    scene.add(mirror1Group);

    // Mirror 2 (Y-arm, along -Z axis)
    const mirror2Group = createMirrorMesh('M2');
    mirror2Group.position.set(0, TH, -0.175);
    mirror2Group.rotation.y = Math.PI / 2;
    scene.add(mirror2Group);

    // Laser Source (left of BS)
    const sourceGroup = new THREE.Group();
    sourceGroup.name = 'LaserSource';
    const srcBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.02, 0.025),
      new THREE.MeshStandardMaterial({ color: 0x2a2a40, metalness: 0.6, roughness: 0.35 })
    );
    srcBox.position.set(-0.22, TH, 0);
    srcBox.castShadow = true;
    sourceGroup.add(srcBox);
    // Emitter dot
    const srcDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.003, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff3300, emissiveIntensity: 2 })
    );
    srcDot.position.set(-0.205, TH + 0.002, 0);
    sourceGroup.add(srcDot);
    scene.add(sourceGroup);

    // Detector (below BS, along +Z axis)
    const detector = createDetectorScreen();
    detector.position.set(0, TH, 0.175);
    scene.add(detector);

    // ---- Dynamic Beam Segments (cylinders that update from store) ----
    const beamRadius = 0.004;
    const beamMat = () => new THREE.MeshStandardMaterial({
      color: beamColor, emissive: beamColor, emissiveIntensity: 2.5,
      transparent: true, opacity: 0.95, depthWrite: false,
    });

    const beamSegments = {};
    const createBeamSegment = (name) => {
      const geo = new THREE.CylinderGeometry(beamRadius, beamRadius, 1, 8);
      const mesh = new THREE.Mesh(geo, beamMat());
      mesh.name = name;
      scene.add(mesh);
      beamSegments[name] = mesh;
      return mesh;
    };

    // Create all 6 beam segments
    createBeamSegment('beam_source_bs');     // Source → BS
    createBeamSegment('beam_bs_m1');         // BS → Mirror1
    createBeamSegment('beam_m1_bs');         // Mirror1 → BS (return)
    createBeamSegment('beam_bs_m2');         // BS → Mirror2
    createBeamSegment('beam_m2_bs');         // Mirror2 → BS (return)
    createBeamSegment('beam_bs_detector');   // BS → Detector

    // Glow beam segments (wider, dimmer, for glow effect)
    const glowMat = () => new THREE.MeshBasicMaterial({
      color: beamColor, transparent: true, opacity: 0.08,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const glowSegments = {};
    const createGlowSegment = (name) => {
      const geo = new THREE.CylinderGeometry(beamRadius * 3, beamRadius * 3, 1, 8);
      const mesh = new THREE.Mesh(geo, glowMat());
      scene.add(mesh);
      glowSegments[name] = mesh;
      return mesh;
    };
    createGlowSegment('beam_source_bs');
    createGlowSegment('beam_bs_m1');
    createGlowSegment('beam_m1_bs');
    createGlowSegment('beam_bs_m2');
    createGlowSegment('beam_m2_bs');
    createGlowSegment('beam_bs_detector');

    /** Update a beam segment to connect two points */
    const updateBeam = (name, from, to) => {
      const seg = beamSegments[name];
      const glow = glowSegments[name];
      if (!seg) return;
      const dir = new THREE.Vector3().subVectors(to, from);
      const len = dir.length();
      const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
      const axis = new THREE.Vector3(0, 1, 0);
      const quat = new THREE.Quaternion().setFromUnitVectors(axis, dir.normalize());

      seg.position.copy(mid);
      seg.quaternion.copy(quat);
      seg.scale.set(1, len, 1);

      if (glow) {
        glow.position.copy(mid);
        glow.quaternion.copy(quat);
        glow.scale.set(1, len, 1);
      }
    };

    // ---- HTML Labels (CSS3D-like overlay) ----
    const labelContainer = document.createElement('div');
    labelContainer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
    container.appendChild(labelContainer);

    const labels = {};
    const createLabel = (name, text) => {
      const el = document.createElement('div');
      el.textContent = text;
      el.style.cssText = `
        position:absolute; font-family:'JetBrains Mono',monospace; font-size:9px; font-weight:700;
        color:rgba(255,255,255,0.6); text-transform:uppercase; letter-spacing:0.12em;
        padding:3px 8px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1);
        border-radius:4px; white-space:nowrap; transform:translate(-50%,-100%);
      `;
      labelContainer.appendChild(el);
      labels[name] = el;
    };
    createLabel('source', 'SOURCE_MODULE');
    createLabel('bs', 'BS-1');
    createLabel('m1', 'REF_MIRROR_M1');
    createLabel('m2', 'END_MIRROR_M2');
    createLabel('detector', 'DETECTOR_OUTPUT');

    /** Project 3D position to 2D screen coordinates for labels */
    const project = (pos3d, label) => {
      const v = pos3d.clone().project(camera);
      const x = (v.x * 0.5 + 0.5) * container.clientWidth;
      const y = (-v.y * 0.5 + 0.5) * container.clientHeight;
      label.style.left = `${x}px`;
      label.style.top = `${y - 8}px`;
      label.style.display = (v.z > 1) ? 'none' : 'block';
    };

    // ---- Animation Loop ----
    const clock = new THREE.Clock();
    let animFrame = null;

    const animate = () => {
      animFrame = requestAnimationFrame(animate);
      controls.update();
      const elapsed = clock.getElapsedTime();
      const state = useSimulationStore.getState();

      if (state.simulationPaused) {
        composer.render();
        return;
      }

      const color = wavelengthToColor(state.wavelength);
      const threeColor = new THREE.Color(color);

      // Update beam color from wavelength
      Object.values(beamSegments).forEach(seg => {
        seg.material.color.copy(threeColor);
        seg.material.emissive.copy(threeColor);
      });
      Object.values(glowSegments).forEach(seg => seg.material.color.copy(threeColor));
      srcDot.material.color.copy(threeColor);
      srcDot.material.emissive.copy(threeColor);

      // Sync mirror positions from store
      mirror1Group.position.set(state.mirror1PosX, TH, state.mirror1PosZ);
      mirror2Group.position.set(state.mirror2PosX, TH, state.mirror2PosZ);
      mirror2Group.rotation.y = Math.PI / 2;

      // Update beam paths from mirror positions
      const bsPos = new THREE.Vector3(0, TH, 0);
      const srcPos = new THREE.Vector3(-0.22, TH, 0);
      const m1Pos = new THREE.Vector3(state.mirror1PosX, TH, state.mirror1PosZ);
      const m2Pos = new THREE.Vector3(state.mirror2PosX, TH, state.mirror2PosZ);
      const detPos = new THREE.Vector3(0, TH, 0.175);

      updateBeam('beam_source_bs', srcPos, bsPos);
      updateBeam('beam_bs_m1', bsPos, m1Pos);
      updateBeam('beam_m1_bs', m1Pos, bsPos);
      updateBeam('beam_bs_m2', bsPos, m2Pos);
      updateBeam('beam_m2_bs', m2Pos, bsPos);
      updateBeam('beam_bs_detector', bsPos, detPos);

      // Update detector fringes
      if (detector.userData.updateFringes) {
        detector.userData.updateFringes(state, elapsed);
      }

      // Emitter dot pulse
      srcDot.material.emissiveIntensity = 1.5 + 0.5 * Math.sin(elapsed * 3);

      // Update HTML labels
      project(new THREE.Vector3(-0.22, TH + 0.02, 0), labels.source);
      project(new THREE.Vector3(0, TH + 0.025, 0), labels.bs);
      project(new THREE.Vector3(state.mirror1PosX, TH + 0.025, state.mirror1PosZ), labels.m1);
      project(new THREE.Vector3(state.mirror2PosX, TH + 0.025, state.mirror2PosZ), labels.m2);
      project(new THREE.Vector3(0, TH + 0.02, 0.175), labels.detector);

      composer.render();
    };
    animate();

    // ---- Resize ----
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // ---- Cleanup ----
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animFrame);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      if (container.contains(labelContainer)) container.removeChild(labelContainer);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />;
};

/** Helper: create a mirror mesh group */
function createMirrorMesh(name) {
  const group = new THREE.Group();
  group.name = name;

  // Reflective surface (larger disc for visibility)
  const mirrorGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.003, 32);
  const mirrorMat = new THREE.MeshStandardMaterial({
    color: 0xf0f0ff, metalness: 1.0, roughness: 0.02,
    envMapIntensity: 1.5,
  });
  const mirrorMesh = new THREE.Mesh(mirrorGeo, mirrorMat);
  mirrorMesh.rotation.z = Math.PI / 2;
  mirrorMesh.castShadow = true;
  group.add(mirrorMesh);

  // Mount body (larger, brighter)
  const mountBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.008, 0.035, 0.035),
    new THREE.MeshStandardMaterial({ color: 0x303050, metalness: 0.6, roughness: 0.4 })
  );
  mountBody.position.x = -0.007;
  mountBody.castShadow = true;
  group.add(mountBody);

  // Base post
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.007, 0.015, 12),
    new THREE.MeshStandardMaterial({ color: 0x3a3a50, metalness: 0.7, roughness: 0.3 })
  );
  post.position.set(-0.007, -0.025, 0);
  post.castShadow = true;
  group.add(post);

  return group;
}

export default SceneManager;
