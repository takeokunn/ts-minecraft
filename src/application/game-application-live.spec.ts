import { Schema } from '@effect/schema'
import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { GameApplication } from './game-application'
import { GameApplicationLive } from './game-application-live'
import { FrameCount, TargetFramesPerSecond } from './types'
import { provideLayers } from '../testing/effect'

const provideApp = <A, E>(effect: Effect.Effect<A, E, GameApplication>) =>
  provideLayers(effect, GameApplicationLive)

describe('GameApplicationLive', () => {
  it.effect('initialize merges configuration overrides', () =>
    provideApp(
      Effect.gen(function* () {
        const service = yield* GameApplication
        yield* service.initialize({ rendering: { targetFps: 90 } })
        const state = yield* service.getState()
        expect(state.lifecycle).toBe('Initialized')
        expect(state.config.rendering.targetFps).toEqual(
          Schema.decodeSync(TargetFramesPerSecond)(90)
        )
      })
    )
  )

  it.effect('start without initialization fails with InvalidStateTransitionError', () =>
    provideApp(
      Effect.gen(function* () {
        const service = yield* GameApplication
        const error = yield* service.start().pipe(Effect.flip)
        expect(error._tag).toBe('InvalidStateTransitionError')
      })
    )
  )

  it.effect('tick updates frame count and fps when running', () =>
    provideApp(
      Effect.gen(function* () {
        const service = yield* GameApplication
        yield* service.initialize()
        yield* service.start()
        yield* service.tick()
        const state = yield* service.getState()
        expect(state.systems.gameLoop.frameCount).toEqual(Schema.decodeSync(FrameCount)(1))
        expect(Number(state.performance.overallFps)).toBeGreaterThan(0)
      })
    )
  )

  it.effect('invalid configuration update reports ConfigurationValidationError', () =>
    provideApp(
      Effect.gen(function* () {
        const service = yield* GameApplication
        yield* service.initialize()
        const error = yield* service
          .updateConfig({ rendering: { targetFps: 10 } })
          .pipe(Effect.flip)
        expect(error._tag).toBe('ConfigurationValidationError')
      })
    )
  )
})
