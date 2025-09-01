import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { updateInstancedMeshes, syncCameraToWorld, updateHighlight } from './updates';
import * as CameraThree from '../camera-three';
import type { ThreeContext, World } from '@/domain/types';
import { EntityId } from '@/domain/entity';
import { CameraState, InstancedMeshRenderable, Position } from '@/domain/components';
import { RaycastResult } from '../raycast-three';

vi.mock('three', async importOriginal => {
  const actualThree = await importOriginal<typeof import('three')>();
  return {
    ...actualThree,
    Object3D: vi.fn(() => ({
      position: new actualThree.Vector3(),
      updateMatrix: vi.fn(),
      matrix: new actualThree.Matrix4(),
    })),
  };
});

vi.mock('../camera-three', () => ({
  syncCameraToComponent: vi.fn(),
}));

const syncCameraToComponentSpy = vi.spyOn(CameraThree, 'syncCameraToComponent');

describe('infrastructure/renderer-three/updates', () => {
  let mockContext: ThreeContext;
  let mockWorld: World;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateInstancedMeshes()', () => {
    it('should update instanced mesh matrices based on world state', () => {
      const mockInstancedMesh = {
        setMatrixAt: vi.fn(),
        instanceMatrix: { needsUpdate: false },
        count: 0,
      };
      mockContext = {
        instancedMeshes: new Map([['player', mockInstancedMesh as any]]),
      } as ThreeContext;

      const entity1 = 1 as EntityId;
      const entity2 = 2 as EntityId;
      mockWorld = {
        entities: new Set([entity1, entity2]),
        components: {
          position: new Map<EntityId, Position>([
            [entity1, { x: 10, y: 11, z: 12 }],
            [entity2, { x: 20, y: 21, z: 22 }],
          ]),
          instancedMeshRenderable: new Map<EntityId, InstancedMeshRenderable>([
            [entity1, { meshType: 'player' }],
            [entity2, { meshType: 'player' }],
          ]),
        },
      } as unknown as World;

      updateInstancedMeshes(mockContext, mockWorld);

      expect(mockInstancedMesh.setMatrixAt).toHaveBeenCalledTimes(2);
      expect(mockInstancedMesh.count).toBe(2);
      expect(mockInstancedMesh.instanceMatrix.needsUpdate).toBe(true);
    });
  });

  describe('syncCameraToWorld()', () => {
    it('should find the player and call syncCameraToComponent', () => {
      mockContext = { camera: {} } as any;
      const playerEid = 5 as EntityId;
      mockWorld = {
        entities: new Set([playerEid]),
        components: {
          player: new Map([[playerEid, {}]]),
          position: new Map<EntityId, Position>([[playerEid, { x: 1, y: 2, z: 3 }]]),
          cameraState: new Map<EntityId, CameraState>([[playerEid, { yaw: 0.5, pitch: -0.2 }]]),
        },
      } as unknown as World;

      syncCameraToWorld(mockContext, mockWorld);

      expect(syncCameraToComponentSpy).toHaveBeenCalledWith(
        mockContext.camera,
        { x: 1, y: 2, z: 3 },
        { yaw: 0.5, pitch: -0.2 },
      );
    });
  });

  describe('updateHighlight()', () => {
    let mockHighlightMesh: {
      visible: boolean;
      position: THREE.Vector3;
    };

    beforeEach(() => {
      mockHighlightMesh = {
        visible: true,
        position: new THREE.Vector3(),
      };
      mockContext = { highlightMesh: mockHighlightMesh } as any;
      mockWorld = {
        components: {
          position: new Map<EntityId, Position>(),
        },
      } as unknown as World;
    });

    it('should hide the highlight mesh if there is no intersection', () => {
      updateHighlight(mockContext, mockWorld, null);
      expect(mockHighlightMesh.visible).toBe(false);
    });

    it('should position and show the highlight mesh if there is an intersection', () => {
      const targetEntity = 10 as EntityId;
      const targetPosition = { x: 10, y: 20, z: 30 };
      mockWorld.components.position.set(targetEntity, targetPosition);

      const raycastResult: RaycastResult = {
        entityId: targetEntity,
        face: { x: 0, y: 1, z: 0 },
        intersection: {} as any,
      };

      updateHighlight(mockContext, mockWorld, raycastResult);

      expect(mockHighlightMesh.visible).toBe(true);
      expect(mockHighlightMesh.position.x).toBe(10.5);
      expect(mockHighlightMesh.position.y).toBe(20.5);
      expect(mockHighlightMesh.position.z).toBe(30.5);
    });
  });
});
