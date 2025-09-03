import { Effect } from 'effect'
import { describe, it, assert } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { SpatialGridLive } from '../spatial-grid'
import { SpatialGrid } from '@/runtime/services'
import { AABB as AABBArb, EntityIdArb } from '@test/arbitraries'
import { type AABB } from '@/domain/geometry'

// Helper to check if two AABBs intersect
const intersects = (a: AABB, b: AABB) => {
  return (
    a.minX <= b.maxX &&
    a.maxX >= b.minX &&
    a.minY <= b.maxY &&
    a.maxY >= b.minY &&
    a.minZ <= b.maxZ &&
    a.maxZ >= b.minZ
  )
}

describe('SpatialGrid', () => {
  it.effect('should find all added entities that intersect with the query AABB', () =>
    Effect.gen(function* (_) {
      const gen = fc.tuple(fc.array(fc.tuple(EntityIdArb, AABBArb)), AABBArb)

      yield* _(
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(gen, ([entities, queryAABB]) =>
              Effect.gen(function* (_) {
                const grid = yield* _(SpatialGrid)
                yield* _(grid.clear())

                // Use a Map to handle potential duplicate entity IDs from fc
                const entityMap = new Map(entities)

                for (const [entityId, aabb] of entityMap.entries()) {
                  yield* _(grid.add(entityId, aabb))
                }

                const results = yield* _(grid.query(queryAABB))
                const resultSet = new Set(results)

                for (const [entityId, aabb] of entityMap.entries()) {
                  if (intersects(aabb, queryAABB)) {
                    assert.isTrue(resultSet.has(entityId), `Expected to find entity ${entityId}`)
                  } else {
                    assert.isFalse(resultSet.has(entityId), `Expected not to find entity ${entityId}`)
                  }
                }
              }).pipe(Effect.provide(SpatialGridLive), Effect.runPromise),
            ),
          ),
        ),
      )
    }))

  it.effect('should return no results after clearing the grid', () =>
    Effect.gen(function* (_) {
      const gen = fc.tuple(fc.array(fc.tuple(EntityIdArb, AABBArb)), AABBArb)

      yield* _(
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(gen, ([entities, queryAABB]) =>
              Effect.gen(function* (_) {
                const grid = yield* _(SpatialGrid)
                yield* _(grid.clear())

                const entityMap = new Map(entities)
                for (const [entityId, aabb] of entityMap.entries()) {
                  yield* _(grid.add(entityId, aabb))
                }

                yield* _(grid.clear())
                const results = yield* _(grid.query(queryAABB))
                assert.isEmpty(results)
              }).pipe(Effect.provide(SpatialGridLive), Effect.runPromise),
            ),
          ),
        ),
      )
    }))

  it.effect('should handle entities exactly on cell boundaries', () =>
    Effect.gen(function* (_) {
      // CELL_SIZE is 4
      const boundaryAABB = AABBArb.map((aabb) => ({
        ...aabb,
        minX: 0,
        maxX: 4,
        minY: -4,
        maxY: 0,
        minZ: 8,
        maxZ: 12,
      }))
      const queryAABB = { minX: 3.9, minY: -0.1, minZ: 11.9, maxX: 4.1, maxY: 0.1, maxZ: 12.1 }

      yield* _(
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(EntityIdArb, boundaryAABB, (entityId, aabb) =>
              Effect.gen(function* (_) {
                const grid = yield* _(SpatialGrid)
                yield* _(grid.clear())
                yield* _(grid.add(entityId, aabb))
                const results = yield* _(grid.query(queryAABB))
                assert.include(results, entityId)
              }).pipe(Effect.provide(SpatialGridLive), Effect.runPromise),
            ),
          ),
        ),
      )
    }))
})