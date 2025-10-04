import { describe, it, expect } from '@effect/vitest'
import { Effect } from 'effect'
import {
  WorldDomainLayer,
  WorldDomainPerformanceLayer,
  WorldDomainQualityLayer,
  WorldDomainTestLayer,
} from '../layers'
import { defaultWorldDomainConfig, selectWorldDomainConfig } from '../config'

describe('domain/world/layers', () => {
  it.effect('default layer composes successfully', () =>
    Effect.gen(function* () {
      const layer = WorldDomainLayer(defaultWorldDomainConfig)
      const result = yield* Effect.provide(Effect.void, layer)
      expect(result).toBeUndefined()
    })
  )

  it.effect('performance layer disables validation services', () =>
    Effect.gen(function* () {
      const config = yield* selectWorldDomainConfig('performance')
      expect(config.enableDomainValidation).toBe(false)
      const result = yield* Effect.provide(Effect.void, WorldDomainPerformanceLayer)
      expect(result).toBeUndefined()
    })
  )

  it.effect('quality layer enables validation services', () =>
    Effect.gen(function* () {
      const config = yield* selectWorldDomainConfig('quality')
      expect(config.enableDomainValidation).toBe(true)
      const result = yield* Effect.provide(Effect.void, WorldDomainQualityLayer)
      expect(result).toBeUndefined()
    })
  )

  it.effect('test layer remains lightweight', () =>
    Effect.gen(function* () {
      const result = yield* Effect.provide(Effect.void, WorldDomainTestLayer)
      expect(result).toBeUndefined()
    })
  )
})
