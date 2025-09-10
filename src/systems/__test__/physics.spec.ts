import { describe, it, assert } from '@effect/vitest'
import { Effect, Layer, Ref } from 'effect'
import { physicsSystem } from '../physics'
import { World, Clock } from '@/runtime/services'
import { WorldLive } from '@/infrastructure/world'

const ClockTest = Layer.effect(
  Clock,
  Effect.gen(function* () {
    const deltaTime = yield* Ref.make(0.016) // 60 FPS
    const callbacks = yield* Ref.make<ReadonlyArray<() => Effect.Effect<void>>>([])
    
    return Clock.of({
      deltaTime,
      onFrame: (callback) => Ref.update(callbacks, (cbs) => [...cbs, callback]),
    })
  })
)

const TestLayer = Layer.mergeAll(WorldLive, ClockTest)

describe('physicsSystem', () => {
  it.effect('should run without errors', () =>
    Effect.gen(function* (_) {
      // Simply test that the system runs without throwing errors
      yield* _(physicsSystem)
      assert.isOk(true)
    }).pipe(Effect.provide(TestLayer))
  )
})