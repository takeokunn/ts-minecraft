import { Effect } from 'effect'
import { describe, it, assert } from '@effect/vitest'
import { EntityId } from '@/domain/types'
import { SpatialGridLive } from '../spatial-grid'
import { SpatialGrid } from '@/runtime/services'
import { AABB } from '@/domain/geometry'

describe('SpatialGrid', () => {
  it.effect('should add and query entities correctly', () =>
    Effect.gen(function* (_) {
      const grid = yield* _(SpatialGrid)

      const entity1 = EntityId(1)
      const aabb1: AABB = { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 }
      yield* _(grid.add(entity1, aabb1))

      const entity2 = EntityId(2)
      const aabb2: AABB = { minX: 8, minY: 8, minZ: 8, maxX: 9, maxY: 9, maxZ: 9 }
      yield* _(grid.add(entity2, aabb2))

      const queryAABB1: AABB = { minX: 0.5, minY: 0.5, minZ: 0.5, maxX: 1.5, maxY: 1.5, maxZ: 1.5 }
      const results1 = yield* _(grid.query(queryAABB1))
      assert.deepStrictEqual(results1, [entity1])
    }).pipe(Effect.provide(SpatialGridLive)))

  it.effect('should clear the grid', () =>
    Effect.gen(function* (_) {
      const grid = yield* _(SpatialGrid)
      const entity1 = EntityId(1)
      const aabb1: AABB = { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 }
      yield* _(grid.add(entity1, aabb1))
      yield* _(grid.clear())
      const results = yield* _(grid.query(aabb1))
      assert.deepStrictEqual(results, [])
    }).pipe(Effect.provide(SpatialGridLive)))
})
