import { Effect } from 'effect'
import { describe, it, assert } from '@effect/vitest'
import { SpatialGridLive } from '../spatial-grid'
import { SpatialGrid } from '@/runtime/services'
import { type AABB } from '@/domain/geometry'
import { toEntityId } from '@/core/entities/entity'

describe('SpatialGrid', () => {
  it.effect('should add and find entities in grid', () =>
    Effect.gen(function* (_) {
      const grid = yield* _(SpatialGrid)
      yield* _(grid.clear())

      const entityId = toEntityId(1)
      const aabb: AABB = {
        minX: 0, maxX: 1,
        minY: 0, maxY: 1, 
        minZ: 0, maxZ: 1,
      }

      yield* _(grid.add(entityId, aabb))
      
      const results = yield* _(grid.query(aabb))
      assert.include(results, entityId)
    }).pipe(Effect.provide(SpatialGridLive)))

  it.effect('should clear all entities from grid', () =>
    Effect.gen(function* (_) {
      const grid = yield* _(SpatialGrid)
      yield* _(grid.clear())

      const entityId = toEntityId(1)
      const aabb: AABB = {
        minX: 0, maxX: 1,
        minY: 0, maxY: 1,
        minZ: 0, maxZ: 1,
      }

      yield* _(grid.add(entityId, aabb))
      yield* _(grid.clear())
      
      const results = yield* _(grid.query(aabb))
      assert.isEmpty(results)
    }).pipe(Effect.provide(SpatialGridLive)))

  it.effect('should handle non-intersecting queries', () =>
    Effect.gen(function* (_) {
      const grid = yield* _(SpatialGrid)
      yield* _(grid.clear())

      const entityId = toEntityId(1)
      const entityAABB: AABB = {
        minX: 0, maxX: 1,
        minY: 0, maxY: 1,
        minZ: 0, maxZ: 1,
      }
      const queryAABB: AABB = {
        minX: 10, maxX: 11,
        minY: 10, maxY: 11,
        minZ: 10, maxZ: 11,
      }

      yield* _(grid.add(entityId, entityAABB))
      
      const results = yield* _(grid.query(queryAABB))
      assert.notInclude(results, entityId)
    }).pipe(Effect.provide(SpatialGridLive)))
})