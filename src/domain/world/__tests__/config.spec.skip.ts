import { describe, expect, it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import * as fc from 'effect/FastCheck'
import {
  WorldDomainConfigSchema,
  createWorldDomainConfig,
  defaultWorldDomainConfig,
  selectWorldDomainConfig,
} from '../config'

describe('domain/world/config', () => {
  it('default config matches schema and balanced mode', () => {
    const decoded = Schema.decodeUnknownEither(WorldDomainConfigSchema)(defaultWorldDomainConfig)
    expect(decoded._tag).toBe('Right')
    expect(defaultWorldDomainConfig.performanceMode).toBe('balanced')
  })

  it.effect('performance config disables validations', () =>
    Effect.gen(function* () {
      const performance = yield* selectWorldDomainConfig('performance')
      expect(performance.performanceMode).toBe('performance')
      expect(performance.enableDomainValidation).toBe(false)
      expect(performance.enableFactoryValidation).toBe(false)
    })
  )

  it.prop([fc.boolean(), fc.boolean(), fc.boolean()])(
    'createWorldDomainConfig respects toggles',
    ([events, metrics, validation]) =>
      Effect.gen(function* () {
        const config = yield* createWorldDomainConfig({
          enableDomainEvents: events,
          enablePerformanceMetrics: metrics,
          enableDomainValidation: validation,
        })
        expect(config.enableDomainEvents).toBe(events)
        expect(config.enablePerformanceMetrics).toBe(metrics)
        expect(config.enableDomainValidation).toBe(validation)
      })
  )
})
