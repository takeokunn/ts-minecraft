import { Effect, Layer, Ref, HashMap, HashSet } from 'effect'
import { describe, it, expect, vi } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import { World, WorldLive } from '@/runtime/world'
import { updatePhysicsWorldSystem } from '../update-physics-world'
import { SpatialGridService } from '@/runtime/services'
import { SpatialGrid } from '@/infrastructure/spatial-grid'
import { EntityId } from '@/domain/entity'
import { AABB } from '@/domain/geometry'

class MockSpatialGrid implements SpatialGrid {
  state = Ref.unsafeMake(HashMap.empty<string, HashSet.HashSet<EntityId>>())
  register = vi.fn((_entityId: EntityId, _aabb: AABB) => Effect.void)
  query = (_aabb: AABB) => Effect.succeed([] as ReadonlyArray<EntityId>)
  clear = vi.fn(() => Effect.void)
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
  it('should clear the spatial grid and register all colliders', async () => {
    const mockSpatialGrid = new MockSpatialGrid()
    const MockSpatialGridLayer = Layer.succeed(SpatialGridService, mockSpatialGrid)

    const program = Effect.gen(function* (_) {
      yield* _(setupWorld)
      yield* _(updatePhysicsWorldSystem)
    })

    await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, MockSpatialGridLayer)))

    expect(mockSpatialGrid.clear).toHaveBeenCalledOnce()
    expect(mockSpatialGrid.register).toHaveBeenCalledOnce()
  })
})