import { Effect, Layer, Ref, HashMap, HashSet } from 'effect'
import { describe, it } from '@effect/vitest'
import * as Assert from '@effect/test/Assert'
import { createArchetype } from '@/domain/archetypes'
import { positionColliderQuery } from '@/domain/queries'
import { SpatialGrid } from '@/infrastructure/spatial-grid'
import * as World from '@/runtime/world-pure'
import { provideTestWorld } from 'test/utils'
import { updatePhysicsWorldSystem } from '../update-physics-world'
import { AABB } from '@/domain/geometry'
import { EntityId } from '@/domain/entity'
import { SpatialGridService } from '@/runtime/services'

type MockGridState = {
  cleared: boolean
  registered: { entityId: EntityId; aabb: AABB }[]
}

const MockSpatialGrid = (ref: Ref.Ref<MockGridState>) =>
  Layer.succeed(
    SpatialGridService,
    SpatialGrid.of({
      state: Ref.unsafeMake(HashMap.empty()),
      clear: Ref.update(ref, (s) => ({ ...s, cleared: true })),
      register: (entityId, aabb) => Ref.update(ref, (s) => ({ ...s, registered: [...s.registered, { entityId, aabb }] })),
      query: () => Effect.succeed([]),
    }),
  )

const setupWorld = () =>
  Effect.gen(function* ($) {
    const blockArchetype = createArchetype({
      type: 'block',
      pos: { x: 0, y: 0, z: 0 },
      blockType: 'dirt',
    })
    yield* $(World.addArchetype(blockArchetype))
  })

describe('updatePhysicsWorldSystem', () => {
  it('should clear the spatial grid and register colliders', () =>
    Effect.gen(function* ($) {
      const ref = yield* $(Ref.make<MockGridState>({ cleared: false, registered: [] }))
      const MockSpatialGridLayer = MockSpatialGrid(ref)

      yield* $(setupWorld())
      yield* $(Effect.provide(updatePhysicsWorldSystem, MockSpatialGridLayer))

      const colliders = yield* $(World.query(positionColliderQuery))
      const block = colliders[0]
      yield* $(Assert.isDefined(block))

      const gridState = yield* $(Ref.get(ref))
      yield* $(Assert.isTrue(gridState.cleared))
      yield* $(Assert.strictEqual(gridState.registered.length, 1))
      yield* $(Assert.strictEqual(gridState.registered[0]?.entityId, block.entityId))
      yield* $(Assert.isTrue(gridState.registered[0]?.aabb instanceof AABB))
    }).pipe(Effect.provide(provideTestWorld())))
})