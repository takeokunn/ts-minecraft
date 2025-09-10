import { describe, it, assert } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import { updateTargetSystem } from '../update-target-system'
import { Raycast } from '@/runtime/services'
import { WorldLive } from '@/infrastructure/world'

const RaycastTest = Layer.succeed(
  Raycast,
  Raycast.of({
    raycast: () => Effect.succeed(Option.none()),
  })
)

const TestLayer = Layer.mergeAll(WorldLive, RaycastTest)

describe('updateTargetSystem', () => {
  it.effect('should run without errors', () =>
    Effect.gen(function* (_) {
      // Simply test that the system runs without throwing errors
      yield* _(updateTargetSystem)
      assert.isOk(true)
    }).pipe(Effect.provide(TestLayer))
  )
})