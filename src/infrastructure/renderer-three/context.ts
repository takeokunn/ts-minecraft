import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import type { ThreeContext as ThreeContextState } from '@/domain/types';
import Stats from 'three/examples/jsm/libs/stats.module.js';

export type ThreeContextAPI = {
  context: ThreeContextState;
  cleanup: () => void;
};

export function createThreeContext(): ThreeContextAPI {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const controls = new PointerLockControls(camera, renderer.domElement);

  const stats = new Stats();
  document.body.appendChild(stats.dom);

  const highlightMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.01, 1.01, 1.01),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
    }),
  );
  scene.add(highlightMesh);

  const context: ThreeContextState = {
    scene,
    camera: {
      camera,
      controls,
    },
    renderer,
    highlightMesh,
    stats,
    chunkMeshes: new Map(),
    instancedMeshes: new Map(),
  };

  const handleResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };

  window.addEventListener('resize', handleResize);

  const cleanup = () => {
    window.removeEventListener('resize', handleResize);
    renderer.dispose();
    if (document.body.contains(renderer.domElement)) {
      document.body.removeChild(renderer.domElement);
    }
    if (document.body.contains(stats.dom)) {
      document.body.removeChild(stats.dom);
    }
  };

  return { context, cleanup };
}
