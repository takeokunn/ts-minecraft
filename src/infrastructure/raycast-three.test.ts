import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fc } from '@fast-check/vitest';
import * as THREE from 'three';
import { castRay } from './raycast-three';
import type { ThreeContext, World } from '@/domain/types';
import { EntityId } from '@/domain/entity';
import { Position } from '@/domain/components';

const mockSetFromCamera = vi.fn();
const mockIntersectObjects = vi.fn();

vi.mock('three', async importOriginal => {
  const actualThree = await importOriginal<typeof import('three')>();
  return {
    ...actualThree,
    Raycaster: vi.fn(() => ({
      setFromCamera: mockSetFromCamera,
      intersectObjects: mockIntersectObjects,
    })),
  };
});

const blockPositionArbitrary = fc.record({
  x: fc.integer({ min: -100, max: 100 }),
  y: fc.integer({ min: -100, max: 100 }),
  z: fc.integer({ min: -100, max: 100 }),
});

const unitVectorArbitrary = fc
  .constantFrom(
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
  )
  .map(v => new THREE.Vector3(v.x, v.y, v.z));

const intersectionPointArbitrary = fc
  .record({
    blockPos: blockPositionArbitrary,
    normal: unitVectorArbitrary,
  })
  .map(({ blockPos, normal }) => {
    const point = new THREE.Vector3(
      blockPos.x + 0.5 + normal.x * 0.5,
      blockPos.y + 0.5 + normal.y * 0.5,
      blockPos.z + 0.5 + normal.z * 0.5,
    );
    return { point, blockPos, normal };
  });

describe('infrastructure/raycast-three', () => {
  let mockContext: ThreeContext;
  let mockWorld: World;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {
      scene: { children: [] } as unknown as THREE.Scene,
      camera: { camera: {} } as any,
    } as ThreeContext;
    mockWorld = {
      tags: { terrainBlock: new Set() },
      components: {
        position: new Map<EntityId, Position>(),
      },
    } as unknown as World;
  });

  const setupMockWorld = (entityId: EntityId, pos: { x: number; y: number; z: number }) => {
    (mockWorld.tags.terrainBlock as Set<EntityId>).add(entityId);
    mockWorld.components.position.set(entityId, pos);
  };

  it('should return a correct RaycastResult when a block is hit within reach (PBT)', () => {
    fc.assert(
      fc.property(
        intersectionPointArbitrary,
        fc.float({ min: 0.1, max: 8 }),
        (intersectionData, distance) => {
          const { point, blockPos, normal } = intersectionData;
          const targetEntityId = 1 as EntityId;
          setupMockWorld(targetEntityId, blockPos);

          const mockIntersection = {
            distance,
            object: { userData: { type: 'chunk' } },
            point,
            face: { normal },
          };
          mockIntersectObjects.mockReturnValue([mockIntersection]);

          const result = castRay(mockContext, mockWorld);

          expect(result).toBeDefined();
          expect(result?.entityId).toBe(targetEntityId);
          expect(result?.face).toEqual({ x: normal.x, y: normal.y, z: normal.z });
          expect(mockSetFromCamera).toHaveBeenCalledWith(
            expect.any(THREE.Vector2),
            mockContext.camera.camera,
          );
        },
      ),
    );
  });

  it('should return undefined for various failure conditions (PBT)', () => {
    fc.assert(
      fc.property(
        intersectionPointArbitrary,
        fc.float({ min: 8.01, max: 100 }),
        fc.string().filter(s => s !== 'chunk'),
        fc.boolean(),
        (intersectionData, distance, wrongType, noIntersects) => {
          const { point, blockPos, normal } = intersectionData;
          setupMockWorld(1 as EntityId, blockPos);

          const mockIntersection = {
            distance: noIntersects ? 5 : distance,
            object: { userData: { type: noIntersects ? 'chunk' : wrongType } },
            point,
            face: { normal },
          };
          mockIntersectObjects.mockReturnValue(noIntersects ? [] : [mockIntersection]);

          const result = castRay(mockContext, mockWorld);

          expect(result).toBeUndefined();
        },
      ),
    );
  });

  it('should return undefined if a chunk is hit but no matching entity is found', () => {
    fc.assert(
      fc.property(intersectionPointArbitrary, fc.float({ min: 0.1, max: 8 }), (intersectionData, distance) => {
        const { point, normal } = intersectionData;
        const mockIntersection = {
          distance,
          object: { userData: { type: 'chunk' } },
          point,
          face: { normal },
        };
        mockIntersectObjects.mockReturnValue([mockIntersection]);

        const result = castRay(mockContext, mockWorld);

        expect(result).toBeUndefined();
      }),
    );
  });
});
