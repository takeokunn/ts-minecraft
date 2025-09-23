import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import * as fc from 'fast-check'
import { Config } from '../Config'

describe('Config Schema with Effect-TS integration', () => {
  describe('Schema validation with fast-check', () => {
    it.effect('should validate configs within valid ranges', () =>
      Effect.gen(function* () {
        // Create custom arbitrary that generates valid configs
        const validConfigArb = fc.record({
          debug: fc.boolean(),
          fps: fc.double({ min: 0.001, max: 120, noNaN: true }),
          memoryLimit: fc.integer({ min: 1, max: 2048 })
        })

        const assertResult = yield* Effect.try(() =>
          fc.assert(
            fc.property(validConfigArb, (config) => {
              // Should successfully decode valid configs
              const decoded = Schema.decodeUnknownSync(Config)(config)

              expect(decoded.debug).toBe(config.debug)
              expect(decoded.fps).toBeCloseTo(config.fps, 10)
              expect(decoded.memoryLimit).toBe(config.memoryLimit)

              // Verify constraints are met
              expect(decoded.fps).toBeGreaterThan(0)
              expect(decoded.fps).toBeLessThanOrEqual(120)
              expect(decoded.memoryLimit).toBeGreaterThan(0)
              expect(decoded.memoryLimit).toBeLessThanOrEqual(2048)
            }),
            { numRuns: 100 }
          )
        )

        return assertResult
      })
    )

    it.effect('should reject invalid fps values', () =>
      Effect.gen(function* () {
        const invalidFpsArb = fc.record({
          debug: fc.boolean(),
          fps: fc.oneof(
            fc.constant(0),
            fc.constant(-1),
            fc.constant(-100),
            fc.constant(121),
            fc.constant(1000),
            fc.double({ min: -1000, max: -0.001, noNaN: true }),
            fc.double({ min: 120.001, max: 10000, noNaN: true })
          ),
          memoryLimit: fc.integer({ min: 1, max: 2048 })
        })

        yield* Effect.try(() =>
          fc.assert(
            fc.property(invalidFpsArb, (config) => {
              expect(() =>
                Schema.decodeUnknownSync(Config)(config)
              ).toThrow()
            })
          )
        )
      })
    )

    it.effect('should reject invalid memoryLimit values', () =>
      Effect.gen(function* () {
        const invalidMemoryArb = fc.record({
          debug: fc.boolean(),
          fps: fc.double({ min: 0.001, max: 120, noNaN: true }),
          memoryLimit: fc.oneof(
            fc.constant(0),
            fc.constant(-1),
            fc.constant(-100),
            fc.constant(2049),
            fc.constant(10000),
            fc.integer({ min: -1000, max: 0 }),
            fc.integer({ min: 2049, max: 100000 })
          )
        })

        yield* Effect.try(() =>
          fc.assert(
            fc.property(invalidMemoryArb, (config) => {
              expect(() =>
                Schema.decodeUnknownSync(Config)(config)
              ).toThrow()
            })
          )
        )
      })
    )

    it.effect('should handle round-trip encoding', () =>
      Effect.gen(function* () {
        const configArb = fc.record({
          debug: fc.boolean(),
          fps: fc.double({ min: 0.001, max: 120, noNaN: true }),
          memoryLimit: fc.integer({ min: 1, max: 2048 })
        })

        yield* Effect.try(() =>
          fc.assert(
            fc.property(configArb, (config) => {
              const decoded = Schema.decodeUnknownSync(Config)(config)
              const encoded = Schema.encodeSync(Config)(decoded)
              const decodedAgain = Schema.decodeUnknownSync(Config)(encoded)

              expect(decodedAgain).toEqual(decoded)
              expect(decodedAgain.debug).toBe(config.debug)
              expect(decodedAgain.fps).toBeCloseTo(config.fps, 10)
              expect(decodedAgain.memoryLimit).toBe(config.memoryLimit)
            })
          )
        )
      })
    )
  })

  describe('Effect patterns with Config schema', () => {
    it.effect('should work with Effect.all', () =>
      Effect.gen(function* () {
        const configs = [
          { debug: true, fps: 60, memoryLimit: 1024 },
          { debug: false, fps: 30, memoryLimit: 512 },
          { debug: true, fps: 120, memoryLimit: 2048 }
        ]

        const results = yield* Effect.all(
          configs.map(config => Schema.decode(Config)(config))
        )

        expect(results).toHaveLength(3)
        results.forEach((result, i) => {
          const config = configs[i]
          if (config) {
            expect(result.debug).toBe(config.debug)
            expect(result.fps).toBe(config.fps)
            expect(result.memoryLimit).toBe(config.memoryLimit)
          }
        })
      })
    )

    it.effect('should handle validation errors gracefully', () =>
      Effect.gen(function* () {
        const invalidConfig = { debug: true, fps: -10, memoryLimit: 1024 }

        const result = yield* Schema.decode(Config)(invalidConfig).pipe(
          Effect.either
        )

        expect(result._tag).toBe('Left')
      })
    )

    it.effect('should work with concurrent validation', () =>
      Effect.gen(function* () {
        const configs = Array.from({ length: 100 }, (_, i) => ({
          debug: i % 2 === 0,
          fps: Math.min(120, (i % 120) + 1),
          memoryLimit: Math.min(2048, ((i % 20) + 1) * 100)
        }))

        const results = yield* Effect.all(
          configs.map(config => Schema.decode(Config)(config)),
          { concurrency: 'unbounded' }
        )

        expect(results).toHaveLength(100)
        results.forEach((result, i) => {
          const config = configs[i]
          if (config) {
            expect(result.debug).toBe(config.debug)
            expect(result.fps).toBe(config.fps)
            expect(result.memoryLimit).toBe(config.memoryLimit)
          }
        })
      })
    )
  })

  describe('Advanced validation patterns', () => {
    it.effect('should validate boundary values', () =>
      Effect.gen(function* () {
        const boundaryConfigs = [
          { debug: true, fps: 0.001, memoryLimit: 1 },      // minimum values
          { debug: false, fps: 120, memoryLimit: 2048 },    // maximum values
          { debug: true, fps: 60, memoryLimit: 1024 },      // typical values
        ]

        for (const config of boundaryConfigs) {
          const result = yield* Schema.decode(Config)(config)
          expect(result).toBeDefined()
          expect(result.fps).toBeGreaterThan(0)
          expect(result.fps).toBeLessThanOrEqual(120)
          expect(result.memoryLimit).toBeGreaterThan(0)
          expect(result.memoryLimit).toBeLessThanOrEqual(2048)
        }
      })
    )

    it.effect('should handle Schema.is for type checking', () =>
      Effect.gen(function* () {
        const validConfig = { debug: true, fps: 60, memoryLimit: 1024 }
        const invalidConfig = { debug: 'true', fps: 60, memoryLimit: 1024 }

        const isValid = Schema.is(Config)(validConfig)
        const isInvalid = Schema.is(Config)(invalidConfig)

        expect(isValid).toBe(true)
        expect(isInvalid).toBe(false)
      })
    )

    it.effect('should compose with custom refinements', () =>
      Effect.gen(function* () {
        // Create a refined config that requires high fps with high memory
        const HighPerformanceConfig = Config.pipe(
          Schema.filter((config) => {
            // High fps (>60) requires at least 1024MB memory
            if (config.fps > 60) {
              return config.memoryLimit >= 1024
            }
            return true
          }, {
            message: () => "High FPS (>60) requires at least 1024MB memory"
          })
        )

        // Valid high performance config
        const validHighPerf = { debug: true, fps: 90, memoryLimit: 1536 }
        const resultValid = yield* Schema.decode(HighPerformanceConfig)(validHighPerf)
        expect(resultValid.fps).toBe(90)
        expect(resultValid.memoryLimit).toBe(1536)

        // Invalid high performance config (high fps, low memory)
        const invalidHighPerf = { debug: true, fps: 90, memoryLimit: 512 }
        const resultInvalid = yield* Schema.decode(HighPerformanceConfig)(invalidHighPerf).pipe(
          Effect.either
        )
        expect(resultInvalid._tag).toBe('Left')
      })
    )
  })

  describe('Performance testing patterns', () => {
    it.effect('should handle large batch validation efficiently', () =>
      Effect.gen(function* () {
        const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
          debug: i % 3 === 0,
          fps: ((i % 120) + 1),
          memoryLimit: ((i % 2048) + 1)
        }))

        const start = Date.now()

        const results = yield* Effect.all(
          largeBatch.map(config => Schema.decode(Config)(config)),
          { concurrency: 'unbounded', batching: true }
        )

        const elapsed = Date.now() - start

        expect(results).toHaveLength(1000)
        expect(elapsed).toBeLessThan(2000) // Should complete in less than 2 seconds
      })
    )

    it.effect('should efficiently validate with caching patterns', () =>
      Effect.gen(function* () {
        // Create a cached decoder
        const decode = Schema.decodeUnknown(Config)

        const sameConfig = { debug: true, fps: 60, memoryLimit: 1024 }

        // Validate the same config multiple times
        const results = yield* Effect.all(
          Array(100).fill(null).map(() => decode(sameConfig))
        )

        results.forEach(result => {
          expect(result.debug).toBe(true)
          expect(result.fps).toBe(60)
          expect(result.memoryLimit).toBe(1024)
        })
      })
    )
  })
})