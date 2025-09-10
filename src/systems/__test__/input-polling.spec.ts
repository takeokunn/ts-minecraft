import { describe, it, assert } from '@effect/vitest'
import { Effect, Layer, Ref } from 'effect'
import { inputPollingSystem } from '../input-polling'
import { World, InputManager } from '@/runtime/services'
import { WorldLive } from '@/infrastructure/world'

const InputManagerTest = Layer.effect(
  InputManager,
  Effect.gen(function* () {
    const isLocked = yield* Ref.make(false)
    return InputManager.of({
      isLocked,
      getState: () => Effect.succeed({
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        place: false,
        destroy: false,
      }),
      getMouseState: () => Effect.succeed({
        dx: 0,
        dy: 0,
      }),
    })
  })
)

const TestLayer = Layer.mergeAll(WorldLive, InputManagerTest)

describe('inputPollingSystem', () => {
  it.effect('should run without errors', () =>
    Effect.gen(function* (_) {
      // Simply test that the system runs without throwing errors
      yield* _(inputPollingSystem)
      assert.isOk(true)
    }).pipe(Effect.provide(TestLayer))
  )
})