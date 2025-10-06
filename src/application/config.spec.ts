import { describe, expect, it } from '@effect/vitest'
import { Effect, Option, Schema } from 'effect'
import * as FastCheck from 'effect/FastCheck'
import { mergeConfig } from './config'
import { DEFAULT_GAME_APPLICATION_CONFIG, GameApplicationConfig, TargetFramesPerSecond } from './types'

describe('application/config', () => {
  it.effect('merges partial patch deeply', () =>
    Effect.gen(function* () {
      const patched = yield* mergeConfig(
        DEFAULT_GAME_APPLICATION_CONFIG,
        Option.some({
          rendering: { targetFps: 120 },
          debug: { enableLogging: false },
        })
      )

      expect(patched.rendering.targetFps).toEqual(Schema.decodeSync(TargetFramesPerSecond)(120))
      expect(patched.debug.enableLogging).toBe(false)
      expect(patched.performance.enableMetrics).toBe(true)
    })
  )

  it.effect('returns base configuration when patch is none', () =>
    mergeConfig(DEFAULT_GAME_APPLICATION_CONFIG, Option.none()).pipe(
      Effect.tap((config) => expect(config).toEqual(DEFAULT_GAME_APPLICATION_CONFIG))
    )
  )

  it.effect('rejects invalid configuration with descriptive error', () =>
    Effect.gen(function* () {
      const result = yield* mergeConfig(
        DEFAULT_GAME_APPLICATION_CONFIG,
        Option.some({
          rendering: { targetFps: 10 },
        })
      ).pipe(Effect.flip)

      expect(result._tag).toBe('ConfigurationValidationError')
      expect(result.context.operation).toBe('mergeConfigPatch')
      const decoded = Schema.decodeSync(GameApplicationConfig)(DEFAULT_GAME_APPLICATION_CONFIG)
      expect(decoded.rendering.targetFps).toEqual(DEFAULT_GAME_APPLICATION_CONFIG.rendering.targetFps)
    })
  )

  it('mergeConfig composes patches associatively (property)', () => {
    FastCheck.assert(
      FastCheck.property(
        FastCheck.integer({ min: 30, max: 240 }),
        FastCheck.integer({ min: 30, max: 240 }),
        (firstTargetFps, secondTargetFps) => {
          const firstMerge = Effect.runSync(
            mergeConfig(
              DEFAULT_GAME_APPLICATION_CONFIG,
              Option.some({
                rendering: { targetFps: firstTargetFps },
              })
            )
          )
          const sequential = Effect.runSync(
            mergeConfig(
              firstMerge,
              Option.some({
                rendering: { targetFps: secondTargetFps },
              })
            )
          )
          const direct = Effect.runSync(
            mergeConfig(
              DEFAULT_GAME_APPLICATION_CONFIG,
              Option.some({
                rendering: { targetFps: secondTargetFps },
              })
            )
          )
          expect(sequential.rendering.targetFps).toEqual(direct.rendering.targetFps)
        }
      )
    )
  })
})
