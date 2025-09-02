import { Effect, Layer, Ref, HashMap } from 'effect'
import { describe, it, expect } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import { positionColliderQuery } from '@/domain/queries'
import { SpatialGrid } from '@/infrastructure/spatial-grid'
import * as World from '@/domain/world'
import { provideTestLayer } from 'test/utils'
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
      expect(block).toBeDefined()

      if (block) {
        const gridState = yield* $(Ref.get(ref))
        expect(gridState.cleared).toBe(true)
        expect(gridState.registered.length).toBe(1)
        expect(gridState.registered[0]?.entityId).toBe(block.entityId)
        const expectedAABB = createAABB(block.position, block.collider)
        expect(gridState.registered[0]?.aabb).toEqual(expectedAABB)
      }
    }).pipe(Effect.provide(provideTestLayer())))
})
