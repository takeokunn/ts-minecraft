import { describe, it, expect, vi, beforeEach } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { updatePhysicsWorldSystem } from '../update-physics-world'
import { SpatialGrid, World } from '@/runtime/services'
import { EntityId } from '@/domain/entity'
import { Collider, Position } from '@/domain/components'
import { SoA } from '@/domain/world'
import { positionColliderQuery } from '@/domain/queries'
import { Box3 } from 'three'

const mockWorld: Partial<World> = {
  querySoA: vi.fn(),
}

const mockSpatialGrid: Partial<SpatialGrid> = {
  clear: vi.fn(),
  add: vi.fn(),
}

const worldLayer = Layer.succeed(World, mockWorld as World)
const spatialGridLayer = Layer.succeed(SpatialGrid, mockSpatialGrid as SpatialGrid)
const testLayer = worldLayer.pipe(Layer.provide(spatialGridLayer))

describe('updatePhysicsWorldSystem', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it.effect('should clear the spatial grid and add all colliders', () =>
    Effect.gen(function* (_) {
      const entityId1 = EntityId('1')
      const entityId2 = EntityId('2')
      const position1 = new Position({ x: 0, y: 0, z: 0 })
      const collider1 = new Collider({ width: 1, height: 1, depth: 1 })
      const position2 = new Position({ x: 10, y: 10, z: 10 })
      const collider2 = new Collider({ width: 2, height: 2, depth: 2 })

      const soa: SoA<typeof positionColliderQuery> = {
        entities: [entityId1, entityId2],
        components: {
          position: [position1, position2],
          collider: [collider1, collider2],
        },
      }

      vi.spyOn(mockWorld, 'querySoA').mockReturnValue(Effect.succeed(soa))
      vi.spyOn(mockSpatialGrid, 'clear').mockReturnValue(Effect.succeed(undefined))
      vi.spyOn(mockSpatialGrid, 'add').mockReturnValue(Effect.succeed(undefined))

      yield* _(updatePhysicsWorldSystem)

      expect(mockSpatialGrid.clear).toHaveBeenCalledTimes(1)
      expect(mockSpatialGrid.add).toHaveBeenCalledTimes(2)

      const aabb1 = new Box3().setFromCenterAndSize(
        { x: 0, y: 0.5, z: 0 } as any,
        { x: 1, y: 1, z: 1 } as any,
      )
      const aabb2 = new Box3().setFromCenterAndSize(
        { x: 10, y: 11, z: 10 } as any,
        { x: 2, y: 2, z: 2 } as any,
      )

      expect(vi.mocked(mockSpatialGrid.add).mock.calls[0][0]).toBe(entityId1)
      expect(vi.mocked(mockSpatialGrid.add).mock.calls[0][1].min).toEqual(aabb1.min)
      expect(vi.mocked(mockSpatialGrid.add).mock.calls[0][1].max).toEqual(aabb1.max)
      expect(vi.mocked(mockSpatialGrid.add).mock.calls[1][0]).toBe(entityId2)
      expect(vi.mocked(mockSpatialGrid.add).mock.calls[1][1].min).toEqual(aabb2.min)
      expect(vi.mocked(mockSpatialGrid.add).mock.calls[1][1].max).toEqual(aabb2.max)
    }).pipe(Effect.provide(testLayer)))
})