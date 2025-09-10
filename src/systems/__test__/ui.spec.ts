import { describe, it, assert } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { uiSystem } from '../ui'
import { UIService } from '@/runtime/services'
import { WorldLive } from '@/infrastructure/world'

const UIServiceTest = Layer.succeed(
  UIService,
  UIService.of({
    updateHotbar: () => Effect.void,
    updateCrosshair: () => Effect.void,
  })
)

const TestLayer = Layer.mergeAll(WorldLive, UIServiceTest)

describe('uiSystem', () => {
  it.effect('should run without errors', () =>
    Effect.gen(function* (_) {
      // Simply test that the system runs without throwing errors
      yield* _(uiSystem)
      assert.isOk(true)
    }).pipe(Effect.provide(TestLayer))
  )
})