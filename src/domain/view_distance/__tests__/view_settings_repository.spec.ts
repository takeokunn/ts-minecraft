import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { createViewControlConfig, toViewDistance } from '../types.js'
import { createViewSettingsRepository } from '../view_settings_repository.js'

describe('view_distance/view_settings_repository', () => {
  const initialConfig = createViewControlConfig({
    minViewDistance: 4,
    maxViewDistance: 40,
    updateIntervalMillis: 32,
    hysteresis: 0.2,
    adaptiveQuality: true,
  })

  it.effect('loads initial configuration', () =>
    Effect.gen(function* () {
      const repository = yield* createViewSettingsRepository(initialConfig)
      const loaded = yield* repository.load()
      expect(loaded.minViewDistance).toBe(4)
      expect(loaded.maxViewDistance).toBe(40)
    })
  )

  it.effect('stores new configuration and tracks history', () =>
    Effect.gen(function* () {
      const repository = yield* createViewSettingsRepository(initialConfig)
      const updatedConfig = createViewControlConfig({
        minViewDistance: 6,
        maxViewDistance: 48,
        updateIntervalMillis: 20,
        hysteresis: 0.15,
        adaptiveQuality: false,
      })

      const saved = yield* repository.save(updatedConfig)
      expect(saved.maxViewDistance).toBe(48)

      const history = yield* repository.history()
      expect(history).toHaveLength(2)
      expect(history[1].adaptiveQuality).toBe(false)
    })
  )

  it.effect('rejects invalid configuration on save', () =>
    Effect.gen(function* () {
      const repository = yield* createViewSettingsRepository(initialConfig)
      const min = yield* toViewDistance(6)
      const max = yield* toViewDistance(30)
      const invalidConfig = {
        minViewDistance: min,
        maxViewDistance: max,
        updateIntervalMillis: -5,
        hysteresis: 0.2,
        adaptiveQuality: false,
      }
      const failure = yield* Effect.flip(repository.save(invalidConfig))
      expect(failure).toHaveProperty('_tag', 'InvalidConfigurationError')
    })
  )
})
