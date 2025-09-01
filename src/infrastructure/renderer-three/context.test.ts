import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createThreeContext } from './context';
import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';

vi.mock('three', async importOriginal => {
  const actualThree = await importOriginal<typeof import('three')>();
  return {
    ...actualThree,
    Scene: vi.fn(() => ({ add: vi.fn() })),
    PerspectiveCamera: vi.fn(() => ({
      aspect: 0,
      updateProjectionMatrix: vi.fn(),
    })),
    WebGLRenderer: vi.fn(() => ({
      setSize: vi.fn(),
      dispose: vi.fn(),
      domElement: document.createElement('canvas'),
    })),
    BoxGeometry: vi.fn(),
    MeshBasicMaterial: vi.fn(),
    Mesh: vi.fn(),
  };
});

vi.mock('three/examples/jsm/controls/PointerLockControls.js', () => ({
  PointerLockControls: vi.fn(),
}));

vi.mock('three/examples/jsm/libs/stats.module.js', () => ({
  default: vi.fn(() => ({
    dom: document.createElement('div'),
  })),
}));

describe('infrastructure/renderer-three/context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();
    window.addEventListener = vi.fn();
    window.removeEventListener = vi.fn();
  });

  it('should create a Three.js context without errors', () => {
    const { context } = createThreeContext();

    expect(context).toBeDefined();
    expect(THREE.Scene).toHaveBeenCalled();
    expect(THREE.PerspectiveCamera).toHaveBeenCalled();
    expect(THREE.WebGLRenderer).toHaveBeenCalled();
    expect(Stats).toHaveBeenCalled();
    expect(document.body.appendChild).toHaveBeenCalledTimes(2);
    expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(context.scene).toBeInstanceOf(THREE.Scene);
    expect(context.renderer).toBeInstanceOf(THREE.WebGLRenderer);
    expect(context.chunkMeshes).toBeInstanceOf(Map);
  });

  it('should clean up resources when cleanup is called', () => {
    const { context, cleanup } = createThreeContext();
    const mockRendererInstance = context.renderer;

    cleanup();

    expect(window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(mockRendererInstance.dispose).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalledTimes(2);
  });
});