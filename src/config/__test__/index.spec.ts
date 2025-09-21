import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { defaultConfig, validateConfig, loadConfig } from '../index'
import {
  expectEffectSuccess,
  expectSchemaSuccess,
  expectPerformanceTest,
} from '../../test/unified-test-helpers'

describe('Config Module', () => {
  describe('defaultConfig', () => {
    it.effect('should have correct default values', () =>
      Effect.gen(function* () {
        expect(defaultConfig.debug).toBe(false)
        expect(defaultConfig.fps).toBe(60)
        expect(defaultConfig.memoryLimit).toBe(2048)
      })
    )
  })

  describe('validateConfig', () => {
    it.effect('should validate valid config', () =>
      Effect.gen(function* () {
        const validConfig = {
          debug: true,
          fps: 60,
          memoryLimit: 1024,
        }

        const result = yield* validateConfig(validConfig)
        expect(result.debug).toBe(true)
        expect(result.fps).toBe(60)
        expect(result.memoryLimit).toBe(1024)
      })
    )

    it.effect('should reject invalid fps (too high)', () =>
      Effect.gen(function* () {
        const invalidConfig = {
          debug: false,
          fps: 200, // Over 120 limit
          memoryLimit: 1024,
        }

        const result = yield* Effect.either(validateConfig(invalidConfig))
        expect(result._tag).toBe('Left')
      })
    )

    it.effect('should reject invalid fps (negative)', () =>
      Effect.gen(function* () {
        const invalidConfig = {
          debug: false,
          fps: -10,
          memoryLimit: 1024,
        }

        const result = yield* Effect.either(validateConfig(invalidConfig))
        expect(result._tag).toBe('Left')
      })
    )

    it.effect('should reject invalid memoryLimit (too high)', () =>
      Effect.gen(function* () {
        const invalidConfig = {
          debug: false,
          fps: 60,
          memoryLimit: 3000, // Over 2048 limit
        }

        const result = yield* Effect.either(validateConfig(invalidConfig))
        expect(result._tag).toBe('Left')
      })
    )

    it.effect('should reject missing fields', () =>
      Effect.gen(function* () {
        const invalidConfig = {
          debug: false,
          fps: 60,
          // missing memoryLimit
        }

        const result = yield* Effect.either(validateConfig(invalidConfig))
        expect(result._tag).toBe('Left')
      })
    )

    it.effect('should reject wrong types', () =>
      Effect.gen(function* () {
        const invalidConfig = {
          debug: 'not a boolean',
          fps: 60,
          memoryLimit: 1024,
        }

        const result = yield* Effect.either(validateConfig(invalidConfig))
        expect(result._tag).toBe('Left')
      })
    )
  })

  describe('loadConfig', () => {
    it.effect('should load default config successfully', () =>
      Effect.gen(function* () {
        const config = yield* loadConfig

        expect(config.debug).toBe(false)
        expect(config.fps).toBe(60)
        expect(config.memoryLimit).toBe(2048)
      })
    )

    it.effect('should return Effect that can be composed', () =>
      Effect.gen(function* () {
        const config = yield* loadConfig
        const result = { configLoaded: true, fps: config.fps }

        expect(result.configLoaded).toBe(true)
        expect(result.fps).toBe(60)
      })
    )

    it.effect('should maintain performance <50ms for config loading', () =>
      Effect.gen(function* () {
        const start = performance.now()
        const config = yield* loadConfig
        const duration = performance.now() - start

        expect(config.fps).toBe(60)
        expect(config.debug).toBe(false)
        expect(duration).toBeLessThan(50) // <50ms requirement
      })
    )
  })

  describe('Phase 3: Config Schema Validation', () => {
    const ConfigSchema = Schema.Struct({
      debug: Schema.Boolean,
      fps: Schema.Number.pipe(Schema.greaterThan(0), Schema.lessThanOrEqualTo(120)),
      memoryLimit: Schema.Number.pipe(Schema.greaterThan(0), Schema.lessThanOrEqualTo(2048)),
    })

    it.effect('should validate config with schema-based testing', () =>
      Effect.gen(function* () {
        const config = yield* loadConfig
        const validatedConfig = expectSchemaSuccess(ConfigSchema, config)

        expect(validatedConfig.debug).toBe(false)
        expect(validatedConfig.fps).toBe(60)
        expect(validatedConfig.memoryLimit).toBe(2048)
      })
    )
  })
})
