import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import * as THREE from 'three';
import { processRenderQueue } from './commands';
import type { ThreeContext, RenderCommand, RenderQueue } from '@/domain/types';

vi.mock('three', async importOriginal => {
  const actualThree = await importOriginal<typeof import('three')>();
  return {
    ...actualThree,
    MeshStandardMaterial: vi.fn(),
    TextureLoader: vi.fn(() => ({
      load: vi.fn(),
    })),
    BufferGeometry: vi.fn(() => ({
      setAttribute: vi.fn(),
      setIndex: vi.fn(),
      computeBoundingSphere: vi.fn(),
      dispose: vi.fn(),
    })),
    Mesh: vi.fn(() => ({
      name: '',
      geometry: new THREE.BufferGeometry(),
    })),
    BufferAttribute: vi.fn(),
  };
});

describe('infrastructure/renderer-three/commands', () => {
  let mockContext: ThreeContext;
  let mockScene: {
    add: Mock;
    remove: Mock;
  };
  let renderQueue: RenderQueue;

  beforeEach(() => {
    vi.clearAllMocks();

    mockScene = {
      add: vi.fn(),
      remove: vi.fn(),
    };

    mockContext = {
      scene: mockScene as any,
      chunkMeshes: new Map(),
    } as unknown as ThreeContext;

    renderQueue = [];
  });

  describe('UpsertChunk Command', () => {
    const upsertCommand: RenderCommand = {
      _tag: 'UpsertChunk',
      chunkX: 0,
      chunkZ: 0,
      mesh: {
        positions: new Float32Array([1, 2, 3]),
        normals: new Float32Array([4, 5, 6]),
        uvs: new Float32Array([7, 8]),
        indices: new Uint32Array([9, 10, 11]),
      },
    };

    it('should create and add a new mesh if one does not exist', () => {
      renderQueue.push(upsertCommand);
      processRenderQueue(mockContext, renderQueue);

      expect(mockContext.chunkMeshes.size).toBe(1);
      const mesh = mockContext.chunkMeshes.get('0,0');
      expect(mesh).toBeDefined();
      expect(mockScene.add).toHaveBeenCalledWith(mesh);
      expect(mesh?.geometry.setAttribute).toHaveBeenCalledTimes(3);
      expect(mesh?.geometry.setIndex).toHaveBeenCalledTimes(1);
      expect(renderQueue.length).toBe(0);
    });

    it('should update an existing mesh if one exists', () => {
      const existingMesh = new THREE.Mesh();
      mockContext.chunkMeshes.set('0,0', existingMesh);
      renderQueue.push(upsertCommand);

      processRenderQueue(mockContext, renderQueue);

      expect(mockContext.chunkMeshes.size).toBe(1);
      expect(mockScene.add).not.toHaveBeenCalled();
      expect(existingMesh.geometry.setAttribute).toHaveBeenCalledTimes(3);
      expect(existingMesh.geometry.setIndex).toHaveBeenCalledTimes(1);
    });
  });

  describe('RemoveChunk Command', () => {
    const removeCommand: RenderCommand = {
      _tag: 'RemoveChunk',
      chunkX: 1,
      chunkZ: 1,
    };

    it('should remove the mesh, dispose geometry, and delete from map if it exists', () => {
      const existingMesh = new THREE.Mesh();
      mockContext.chunkMeshes.set('1,1', existingMesh);
      renderQueue.push(removeCommand);

      processRenderQueue(mockContext, renderQueue);

      expect(mockScene.remove).toHaveBeenCalledWith(existingMesh);
      expect(existingMesh.geometry.dispose).toHaveBeenCalled();
      expect(mockContext.chunkMeshes.has('1,1')).toBe(false);
      expect(renderQueue.length).toBe(0);
    });

    it('should do nothing if the mesh to remove does not exist', () => {
      renderQueue.push(removeCommand);
      processRenderQueue(mockContext, renderQueue);

      expect(mockScene.remove).not.toHaveBeenCalled();
      expect(mockContext.chunkMeshes.size).toBe(0);
    });
  });
});
