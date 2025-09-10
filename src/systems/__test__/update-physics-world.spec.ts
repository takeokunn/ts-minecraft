import { describe, it, assert } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { updatePhysicsWorldSystem } from '../update-physics-world'
import { World, SpatialGrid } from '@/runtime/services'
import { WorldLive } from '@/infrastructure/world'
import { SpatialGridLive } from '@/infrastructure/spatial-grid'

const TestLayer = WorldLive.pipe(
  Layer.provideMerge(SpatialGridLive)
)

describe('updatePhysicsWorldSystem', () => {
  it.effect('should run without errors', () =>
    Effect.gen(function* (_) {
      // Simply test that the system runs without throwing errors
      yield* _(updatePhysicsWorldSystem)
      assert.isOk(true)
    }).pipe(Effect.provide(TestLayer))
  )
})