import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import * as fc from 'effect/FastCheck'
import { defaultWorldDomainConfig } from '../config'
import { WorldDomainHelpers } from '../helpers'
import { WorldDomainTestLayer } from '../layers'
import { makeWorldClockTestLayer } from '../time'

describe('domain/world/helpers', () => {
  const clockLayer = makeWorldClockTestLayer(1_700_000_000_000)
  const testLayer = Layer.mergeAll(WorldDomainTestLayer, clockLayer)

  it.effect('createQuickWorld produces deterministic metadata under fixed clock', () =>
    Effect.gen(function* () {
      const world = yield* WorldDomainHelpers.createQuickWorld()
      expect(world.metadata.createdAt.getTime()).toBe(1_700_000_000_000)
      expect(world.metadata.version).toBe('1.0.0')
    }).pipe(Layer.provide(testLayer))
  )

  it.effect('validateWorldData succeeds for minimal valid payload', () =>
    Effect.gen(function* () {
      const result = yield* WorldDomainHelpers.validateWorldData({
        seed: 42,
        generator: {},
        biomeSystem: {},
      })
      expect(result.isValid).toBe(true)
    })
  )

  it.effect('exportWorldMetadata yields safe defaults on invalid data', () =>
    Effect.gen(function* () {
      const metadata = yield* WorldDomainHelpers.exportWorldMetadata({})
      expect(metadata.name).toBe('Invalid World')
      expect(metadata.version).toBe('unknown')
    }).pipe(Layer.provide(clockLayer))
  )

  it.prop([fc.constantFrom('performance', 'quality', 'balanced' as const)])(
    'optimizeWorldSettings aligns toggles with performance mode',
    ([mode]) =>
      Effect.gen(function* () {
        const result = yield* WorldDomainHelpers.optimizeWorldSettings({
          ...defaultWorldDomainConfig,
          performanceMode: mode,
        })
        if (mode === 'performance') {
          expect(result.enableDomainValidation).toBe(false)
        }
        if (mode === 'quality') {
          expect(result.debugMode).toBe(true)
        }
      })
  )
})
