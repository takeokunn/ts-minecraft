import { Effect } from 'effect'
import { describe, it, expect } from 'vitest'
import { type EntityId } from '@/domain/entity'
import type { AABB } from '@/domain/geometry'
import { SpatialGrid, SpatialGridLive } from '../spatial-grid'

describe('SpatialGrid', () => {
  it('should register and query entities correctly', () => {
    const program = Effect.gen(function* (_) {
      const grid = yield* _(SpatialGrid)

      const entity1 = 1 as EntityId
      const aabb1: AABB = { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 } // Cell 0,0,0
      yield* _(grid.register(entity1, aabb1))

      const entity2 = 2 as EntityId
      const aabb2: AABB = { minX: 8, minY: 8, minZ: 8, maxX: 9, maxY: 9, maxZ: 9 } // Cell 2,2,2
      yield* _(grid.register(entity2, aabb2))

      // Query for entity 1
      const queryAABB1: AABB = { minX: 0.5, minY: 0.5, minZ: 0.5, maxX: 1.5, maxY: 1.5, maxZ: 1.5 }
      const results1 = yield* _(grid.query(queryAABB1))
      expect(results1).toEqual([entity1])

      // Query for entity 2
      const queryAABB2: AABB = { minX: 8.5, minY: 8.5, minZ: 8.5, maxX: 9.5, maxY: 9.5, maxZ: 9.5 }
      const results2 = yield* _(grid.query(queryAABB2))
      expect(results2).toEqual([entity2])

      // Query for empty space
      const queryAABB3: AABB = { minX: 20, minY: 20, minZ: 20, maxX: 21, maxY: 21, maxZ: 21 }
      const results3 = yield* _(grid.query(queryAABB3))
      expect(results3).toEqual([])

      // Query for both
      const queryAABB4: AABB = { minX: 0, minY: 0, minZ: 0, maxX: 10, maxY: 10, maxZ: 10 }
      const results4 = yield* _(grid.query(queryAABB4))
      expect(new Set(results4)).toEqual(new Set([entity1, entity2]))
    })

    return Effect.runPromise(Effect.provide(program, SpatialGridLive))
  })

  it('should clear the grid', () => {
    const program = Effect.gen(function* (_) {
      const grid = yield* _(SpatialGrid)

      const entity1 = 1 as EntityId
      const aabb1: AABB = { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 }
      yield* _(grid.register(entity1, aabb1))

      let results = yield* _(grid.query(aabb1))
      expect(results).toEqual([entity1])

      yield* _(grid.clear)

      results = yield* _(grid.query(aabb1))
      expect(results).toEqual([])
    })

    return Effect.runPromise(Effect.provide(program, SpatialGridLive))
  })

  it('should handle entities spanning multiple cells', () => {
    const program = Effect.gen(function* (_) {
      const grid = yield* _(SpatialGrid)

      const entity1 = 1 as EntityId
      // This AABB spans multiple cells since CELL_SIZE is 4
      const aabb1: AABB = { minX: 0, minY: 0, minZ: 0, maxX: 5, maxY: 5, maxZ: 5 }
      yield* _(grid.register(entity1, aabb1))

      // Query a small part of the entity's AABB
      const queryAABB: AABB = { minX: 4.5, minY: 4.5, minZ: 4.5, maxX: 5.5, maxY: 5.5, maxZ: 5.5 }
      const results = yield* _(grid.query(queryAABB))
      expect(results).toEqual([entity1])
    })

    return Effect.runPromise(Effect.provide(program, SpatialGridLive))
  })
})
