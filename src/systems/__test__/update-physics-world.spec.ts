import { describe, it, expect, vi } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { updatePhysicsWorldSystem } from '../update-physics-world'
import { SpatialGrid, World } from '@/runtime/services'
import { EntityId, toEntityId } from '@/domain/entity'
import { Collider, Position } from '@/domain/components'
import { SoA } from '@/domain/world'
import { positionColliderQuery } from '@/domain/queries'
import { createAABB } from '@/domain/geometry'

describe('updatePhysicsWorldSystem', () => {
  it.effect('should clear the spatial grid and add all colliders', () =>
    Effect.gen(function* ($) {
      const entityId1 = toEntityId(1)
      const entityId2 = toEntityId(2)
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

      const clearMock = vi.fn(() => Effect.succeed(undefined))
      const addMock = vi.fn(() => Effect.succeed(undefined))

      const mockWorld: Partial<World> = {
        querySoA: () => Effect.succeed(soa),
      }

      const mockSpatialGrid: SpatialGrid = {
        clear: clearMock,
        add: addMock,
        query: () => Effect.succeed([]),
      }

      const testLayer = Layer.merge(
        Layer.succeed(World, mockWorld as World),
        Layer.succeed(SpatialGrid, mockSpatialGrid),
      )

      yield* $(updatePhysicsWorldSystem.pipe(Effect.provide(testLayer)))

      expect(clearMock).toHaveBeenCalledTimes(1)
      expect(addMock).toHaveBeenCalledTimes(2)

      const aabb1 = createAABB(position1, collider1)
      const aabb2 = createAABB(position2, collider2)

      expect(addMock).toHaveBeenCalledWith(entityId1, aabb1)
      expect(addMock).toHaveBeenCalledWith(entityId2, aabb2)
    }))
})
