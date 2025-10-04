import { Schema } from '@effect/schema'
import { describe, expect, it } from '@effect/vitest'
import { Context, Effect, Layer } from 'effect'
import * as Option from 'effect/Option'
import { GameApplication } from './game-application'
import { GameApplicationLive } from './game-application-live'
import { Milliseconds, TargetFramesPerSecond } from './types'

describe('application/GameApplicationLive', () => {
  const provideApp = <A, E>(program: Effect.Effect<A, E, typeof GameApplication>): Effect.Effect<A, E> =>
    Effect.scoped(
      Layer.build(GameApplicationLive).pipe(
        Effect.flatMap((context) =>
          program.pipe(Effect.provideService(GameApplication, Context.get(context, GameApplication)))
        )
      )
    )

  it.effect('executes lifecycle operations coherently', () =>
    provideApp(
      Effect.gen(function* () {
        const app = yield* GameApplication
        yield* app.initialize(Option.none())
        yield* app.start()
        yield* app.pause()
        yield* app.resume()
        yield* app.stop()
        const lifecycle = yield* app.getLifecycleState()
        expect(lifecycle).toBe('Stopped')
      })
    )
  )

  it.effect('updates configuration and advances ticks', () =>
    provideApp(
      Effect.gen(function* () {
        const app = yield* GameApplication
        yield* app.initialize(Option.none())
        yield* app.start()
        yield* app.updateConfig({ rendering: { targetFps: 144 } })
        yield* app.tick(Option.some(Schema.decodeSync(Milliseconds)(16)))
        const state = yield* app.getState()
        expect(state.config.rendering.targetFps).toEqual(Schema.decodeSync(TargetFramesPerSecond)(144))
        expect(state.systems.gameLoop.frameCount).toBeGreaterThan(0)
        const health = yield* app.healthCheck()
        expect(health.gameLoop.status).toBe('healthy')
      })
    )
  )

  it.effect('applies default tick delta when none is provided', () =>
    provideApp(
      Effect.gen(function* () {
        const app = yield* GameApplication
        yield* app.initialize(Option.none())
        yield* app.start()
        yield* app.tick(Option.none())
        const state = yield* app.getState()
        expect(state.systems.gameLoop.frameCount).toBeGreaterThan(0)
      })
    )
  )
})
