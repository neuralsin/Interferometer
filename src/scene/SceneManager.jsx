import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import useSimulationStore from '../store/simulationStore.js';
import { createOpticalTable } from './OpticalTable.js';
import { createBeamSplitter } from './BeamSplitter.js';
import { createMirror } from './Mirror.js';
import { createLaserBeams } from './LaserBeam.js';
import { createDetectorScreen } from './DetectorScreen.js';
import { createCompensatorPlate } from './CompensatorPlate.js';
import { wavelengthToColor } from '../physics/basicInterference.js';

const GRID_SNAP = 0.025; // 25mm snap

/** Snap a position to the 25mm optical-table grid */
const snapToGrid = (position) => {
  position.x = Math.round(position.x / GRID_SNAP) * GRID_SNAP;
  position.z = Math.round(position.z / GRID_SNAP) * GRID_SNAP;
};

const SceneManager = () => {
  const containerRef = useRef(null);
  const cleanupRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // ---- Scene ----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a12);

    // ---- Camera ----
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 100);
    camera.position.set(0.4, 0.35, 0.5);
    camera.lookAt(0, 0, 0);

    // ---- Renderer ----
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // ---- Orbit Controls ----
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;
    orbitControls.minDistance = 0.1;
    orbitControls.maxDistance = 3;
    orbitControls.maxPolarAngle = Math.PI / 2 + 0.2;
    orbitControls.target.set(0, 0, 0);

    // ---- Transform Controls (Drag & Drop) ----
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode('translate');
    transformControls.setSpace('world');
    transformControls.showY = false; // constrain to table plane (X/Z only)
    scene.add(transformControls);

    // Disable orbit while dragging
    transformControls.addEventListener('dragging-changed', (event) => {
      orbitControls.enabled = !event.value;
    });

    // Snap to grid on transform end
    transformControls.addEventListener('objectChange', () => {
      const obj = transformControls.object;
      if (obj) snapToGrid(obj.position);
    });

    // ---- Lighting ----
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xfff5e6, 0.8);
    mainLight.position.set(0.5, 1, 0.5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xd0e0ff, 0.3);
    fillLight.position.set(-0.5, 0.5, -0.5);
    scene.add(fillLight);

    const overheadLight = new THREE.PointLight(0xfff8f0, 0.4, 3);
    overheadLight.position.set(0, 1, 0);
    scene.add(overheadLight);

    // ---- Post Processing ----
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height), 0.6, 0.3, 0.9
    );
    composer.addPass(bloomPass);

    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.material.uniforms['resolution'].value.set(1 / width, 1 / height);
    composer.addPass(fxaaPass);

    // ---- Build Optical Components ----
    const table = createOpticalTable();
    scene.add(table);

    const beamSplitter = createBeamSplitter();
    scene.add(beamSplitter);

    const mirrorX = createMirror('mirrorX');
    mirrorX.position.set(0.175, 0.015, 0);
    scene.add(mirrorX);

    const mirrorY = createMirror('mirrorY');
    mirrorY.position.set(0, 0.015, -0.175);
    mirrorY.rotation.y = Math.PI / 2;
    scene.add(mirrorY);

    const beams = createLaserBeams();
    scene.add(beams);

    const detector = createDetectorScreen();
    detector.position.set(0, 0.015, 0.175);
    scene.add(detector);

    // Compensator plate in arm Y
    const compensator = createCompensatorPlate();
    compensator.position.set(0, 0.015, -0.075);
    compensator.rotation.y = Math.PI / 2;
    scene.add(compensator);

    // ---- Draggable objects ----
    const draggableObjects = [mirrorX, mirrorY, detector, compensator];

    // Raycaster for click-to-select
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let selectedObject = null;

    const onPointerDown = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // Check all draggable groups
      for (const group of draggableObjects) {
        const intersects = raycaster.intersectObjects(group.children, true);
        if (intersects.length > 0) {
          if (selectedObject !== group) {
            selectedObject = group;
            transformControls.attach(group);
          }
          return;
        }
      }

      // Clicked empty space — deselect
      if (selectedObject) {
        transformControls.detach();
        selectedObject = null;
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // Keyboard shortcuts for transform modes
    const onKeyDown = (event) => {
      switch (event.key) {
        case 'g': transformControls.setMode('translate'); break;
        case 'r': transformControls.setMode('rotate'); break;
        case 'Escape': transformControls.detach(); selectedObject = null; break;
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // ---- Animation Loop ----
    const clock = new THREE.Clock();
    let animFrame = null;

    const animate = () => {
      animFrame = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      orbitControls.update();

      const state = useSimulationStore.getState();
      const color = wavelengthToColor(state.wavelength);

      // Update volumetric beam shaders
      beams.traverse((child) => {
        if (child.isMesh && child.userData.isVolumetric && child.material.uniforms) {
          child.material.uniforms.u_beamColor.value.set(color);
          child.material.uniforms.u_time.value = elapsed;
        }
      });

      // Update detector fringe shader
      if (detector.userData.updateFringes) {
        detector.userData.updateFringes(state, elapsed);
      }

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
      fxaaPass.material.uniforms['resolution'].value.set(1 / w, 1 / h);
    };
    window.addEventListener('resize', onResize);

    // ---- Cleanup ----
    cleanupRef.current = () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      cancelAnimationFrame(animFrame);
      orbitControls.dispose();
      transformControls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    };

    return () => cleanupRef.current?.();
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default SceneManager;
