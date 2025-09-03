import { describe, it, expect, vi, assert } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import * as fc from 'effect/FastCheck'
import { updatePhysicsWorldSystem } from '../update-physics-world'
import { SpatialGrid, World } from '@/runtime/services'
import { toEntityId } from '@/domain/entity'
import { Collider, Position } from '@/domain/components'
import { SoAResult } from '@/domain/types'
import { positionColliderQuery } from '@/domain/queries'
import { createAABB } from '@/domain/geometry'
import { arbitraryPosition, arbitraryCollider } from '@test/arbitraries'

const arbitraryEntity = fc.record({
  position: arbitraryPosition,
  collider: arbitraryCollider,
})

describe('updatePhysicsWorldSystem', () => {
  it.effect('should adhere to physics world update properties', () =>
    Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(fc.array(arbitraryEntity), async (entities) => {
          const entityIds = entities.map((_, i) => toEntityId(i))
          const soa: SoAResult<typeof positionColliderQuery.components> = {
            entities: entityIds,
            components: {
              position: entities.map((e) => e.position),
              collider: entities.map((e) => e.collider),
            },
          }

          const clearSpy = vi.fn(() => Effect.succeed(undefined))
          const addSpy = vi.fn(() => Effect.succeed(undefined))

          const mockWorld: Partial<World> = {
            querySoA: () => Effect.succeed(soa as any),
          }

          const mockSpatialGrid: SpatialGrid = {
            clear: clearSpy,
            add: addSpy,
            query: () => Effect.succeed([]),
            register: () => Effect.void,
          }

          const testLayer = Layer.merge(
            Layer.succeed(World, mockWorld as World),
            Layer.succeed(SpatialGrid, mockSpatialGrid),
          )

          await Effect.runPromise(updatePhysicsWorldSystem.pipe(Effect.provide(testLayer)))

          assert.strictEqual(clearSpy.mock.calls.length, 1)
          assert.strictEqual(addSpy.mock.calls.length, entities.length)

          entities.forEach((entity, i) => {
            const aabb = createAABB(entity.position, entity.collider)
            assert.deepStrictEqual(addSpy.mock.calls[i], [entityIds[i], aabb])
          })
        }),
      ),
    ),
  )
})