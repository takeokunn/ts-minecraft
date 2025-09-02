import { Effect, Layer, Ref, HashMap, HashSet } from 'effect'
import { describe, it, expect, vi } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import { World, WorldLive } from '@/runtime/world'
import { updatePhysicsWorldSystem } from '../update-physics-world'
import { SpatialGridService } from '@/runtime/services'
import { SpatialGrid } from '@/infrastructure/spatial-grid'
import { EntityId } from '@/domain/entity'
import { AABB, createAABB } from '@/domain/geometry'
import { positionColliderQuery } from '@/domain/queries'

const createMockSpatialGrid = () => {
  const registerFn = vi.fn((_entityId: EntityId, _aabb: AABB) => Effect.void)
  const clearFn = vi.fn()

  const mock: SpatialGrid = {
    state: Ref.unsafeMake(HashMap.empty<string, HashSet.HashSet<EntityId>>()),
    register: registerFn,
    query: (_aabb: AABB) => Effect.succeed([] as ReadonlyArray<EntityId>),
    clear: Effect.sync(clearFn),
  }

  return {
    mock,
    spies: {
      register: registerFn,
      clear: clearFn,
    },
  }
}

const setupWorld = Effect.gen(function* (_) {
  const world = yield* _(World)
  const blockArchetype = createArchetype({
    type: 'block',
    pos: { x: 0, y: 0, z: 0 },
    blockType: 'stone',
  })
  yield* _(world.addArchetype(blockArchetype))
})

describe('updatePhysicsWorldSystem', () => {
  it('should clear the spatial grid and register all colliders with correct AABBs', async () => {
    const { mock: mockSpatialGrid, spies } = createMockSpatialGrid()
    const MockSpatialGridLayer = Layer.succeed(SpatialGridService, mockSpatialGrid)

    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      yield* _(setupWorld)
      yield* _(updatePhysicsWorldSystem)

      const colliders = yield* _(world.query(positionColliderQuery))
      const block = colliders[0]!
      const expectedAABB = createAABB(block.position, block.collider)

      expect(spies.clear).toHaveBeenCalledOnce()
      expect(spies.register).toHaveBeenCalledOnce()
      expect(spies.register).toHaveBeenCalledWith(block.entityId, expectedAABB)
    })

    await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, MockSpatialGridLayer)))
  })
})
