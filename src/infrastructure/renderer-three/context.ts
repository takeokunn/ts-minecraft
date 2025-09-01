import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { createThreeCamera, handleCameraResize, ThreeCamera } from '../camera-three';

// --- Type Definitions ---

export type ThreeContext = {
  readonly scene: THREE.Scene;
  readonly camera: ThreeCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly highlightMesh: THREE.Mesh;
  readonly stats: Stats;
  readonly chunkMeshes: Map<string, THREE.Mesh>;
  readonly instancedMeshes: Map<string, THREE.InstancedMesh>;
};

export type ThreeContextAPI = {
  readonly context: ThreeContext;
  readonly cleanup: () => void;
};

// --- Functions ---

export function createThreeContext(rootElement: HTMLElement): ThreeContextAPI {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  rootElement.appendChild(renderer.domElement);

  const camera = createThreeCamera(renderer.domElement);

  const stats = new Stats();
  rootElement.appendChild(stats.dom);

  const highlightMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.01, 1.01, 1.01),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
    }),
  );
  scene.add(highlightMesh);

  const context: ThreeContext = {
    scene,
    camera,
    renderer,
    highlightMesh,
    stats,
    chunkMeshes: new Map(),
    instancedMeshes: new Map(),
  };

  const onResize = () => handleCameraResize(context.camera, context.renderer);
  window.addEventListener('resize', onResize);

  const cleanup = () => {
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    if (rootElement.contains(renderer.domElement)) {
      rootElement.removeChild(renderer.domElement);
    }
    if (rootElement.contains(stats.dom)) {
      rootElement.removeChild(stats.dom);
    }
  };

  return { context, cleanup };
}
