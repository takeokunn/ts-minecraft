import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Option, Schema } from 'effect'
import { SceneService } from './service'
import { SceneState as Scenes, TransitionEffect, SceneTimestampSchema } from './types'

describe('domain/scene/service tag', () => {
  it.effect('provides SceneService via Layer', () =>
    Effect.gen(function* () {
      const mainMenu = Scenes.MainMenu()
      const stub = Layer.succeed(SceneService, {
        transitionTo: () => Effect.succeed(mainMenu),
        current: () => Effect.succeed(mainMenu),
        saveSnapshot: () => Effect.void,
        restoreFrom: () => Effect.succeed(mainMenu),
        registerFailure: () => Effect.succeed(Scenes.Error({
          error: {
            message: 'x',
            stack: Option.none(),
            timestamp: Schema.decodeSync(SceneTimestampSchema)(0),
          },
          recoverable: false,
        })),
        preload: () => Effect.void,
      })

      const result = yield* Effect.service(SceneService).pipe(Layer.provide(stub))
      const next = yield* result.transitionTo(mainMenu, TransitionEffect.Instant({}))
      expect(next).toStrictEqual(mainMenu)
    })
  )
})
