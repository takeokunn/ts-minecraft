import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { Config } from '../Config'

describe('Config Schema with Effect-TS integration', () => {
  describe('Schema validation with it.prop', () => {
  it.prop('should validate configs within valid ranges', [
  Schema.Struct({
  debug: Schema.Boolean,
  fps: Schema.Int.pipe(Schema.between(1, 120)),
  memoryLimit: Schema.Int.pipe(Schema.between(1, 2048))
})
    ], ({ struct: config })

      Effect.gen(function* () {
        // Should successfully decode valid configs
        const decoded = Schema.decodeUnknownSync(Config)(config)
        expect(decoded.debug).toBe(config.debug)
        expect(decoded.fps).toBeCloseTo(config.fps, 10)
        expect(decoded.memoryLimit).toBe(config.memoryLimit)
        // Verify constraints are met
        expect(decoded.fps).toBeGreaterThan(0)
        expect(decoded.fps).toBeLessThanOrEqual(120)
        expect(decoded.memoryLimit).toBeGreaterThan(0)
        expect(decoded.memoryLimit).toBeLessThanOrEqual(2048)})

    it.prop('should reject invalid fps values', [
      Schema.Struct({
        debug: Schema.Boolean,
        fps: Schema.Union(
          Schema.Literal(0),
          Schema.Literal(-1),
          Schema.Literal(-100),
          Schema.Literal(121),
          Schema.Literal(1000),
          Schema.Number.pipe(Schema.between(-1000, -0.001)),
          Schema.Number.pipe(Schema.between(120.001, 10000))
        ),
        memoryLimit: Schema.Int.pipe(Schema.between(1, 2048))
      })
    ], ({ struct: config })

      Effect.gen(function* () {
        expect(() => Schema.decodeUnknownSync(Config)(config)).toThrow()
      })
    it.prop('should reject invalid memoryLimit values', [
      Schema.Struct({
        debug: Schema.Boolean,
        fps: Schema.Int.pipe(Schema.between(1, 120)),
        memoryLimit: Schema.Union(
          Schema.Literal(0),
          Schema.Literal(-1),
          Schema.Literal(-100),
          Schema.Literal(2049),
          Schema.Literal(10000),
          Schema.Int.pipe(Schema.between(-1000, 0)),
          Schema.Int.pipe(Schema.between(2049, 100000))
        )
      })
    ], ({ struct: config })

      Effect.gen(function* () {
        expect(() => Schema.decodeUnknownSync(Config)(config)).toThrow()
      })
    it.prop('should handle round-trip encoding', [
      Schema.Struct({
        debug: Schema.Boolean,
        fps: Schema.Int.pipe(Schema.between(1, 120)),
        memoryLimit: Schema.Int.pipe(Schema.between(1, 2048))
      })
    ], ({ struct: config })

      Effect.gen(function* () {
        const decoded = Schema.decodeUnknownSync(Config)(config)
        const encoded = Schema.encodeSync(Config)(decoded)
        const decodedAgain = Schema.decodeUnknownSync(Config)(encoded)
        expect(decodedAgain).toEqual(decoded)
        expect(decodedAgain.debug).toBe(config.debug)
        expect(decodedAgain.fps).toBeCloseTo(config.fps, 10)
        expect(decodedAgain.memoryLimit).toBe(config.memoryLimit)
      })
  })

  describe('Effect patterns with Config schema', () => {
  it.effect('should work with Effect.all', () => Effect.gen(function* () {
    const configs = [
    { debug: true, fps: 60, memoryLimit: 1024 },
    { debug: false, fps: 30, memoryLimit: 512 },
    { debug: true, fps: 120, memoryLimit: 2048 },
    ]
    const results = yield* Effect.all(configs.map((config) => Schema.decode(Config)(config)))
    expect(results).toHaveLength(3)
    results.forEach((result, i) => {
    const config = configs[i]
    if (config) {
    expect(result.debug).toBe(config.debug)
    expect(result.fps).toBe(config.fps)
    expect(result.memoryLimit).toBe(config.memoryLimit)
    }
})
  ),
  Effect.gen(function* () {
        const invalidConfig = { debug: true, fps: -10, memoryLimit: 1024 }
        const result = yield* Schema.decode(Config)(invalidConfig).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    it.effect('should work with concurrent validation', () => Effect.gen(function* () {
    const configs = Array.from({ length: 100 }, (_, i) => ({
    debug: i % 2 === 0,
    fps: Math.min(120, (i % 120) + 1),
    memoryLimit: Math.min(2048, ((i % 20) + 1) * 100),
    })
    const results = yield* Effect.all(
    configs.map((config) => Schema.decode(Config)(config)),
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
)
    describe('Advanced validation patterns', () => {
  it.effect('should validate boundary values', () => Effect.gen(function* () {
    const boundaryConfigs = [
    { debug: true, fps: 1, memoryLimit: 1 }, // minimum values
    { debug: false, fps: 120, memoryLimit: 2048 }, // maximum values
    { debug: true, fps: 60, memoryLimit: 1024 }, // typical values
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
),
  Effect.gen(function* () {
        const validConfig = { debug: true, fps: 60, memoryLimit: 1024 }
        const invalidConfig = { debug: 'true', fps: 60, memoryLimit: 1024 }
        const isValid = Schema.is(Config)(validConfig)
        const isInvalid = Schema.is(Config)(invalidConfig)
        expect(isValid).toBe(true)
        expect(isInvalid).toBe(false)
      })
    it.effect('should compose with custom refinements', () => Effect.gen(function* () {
    // Create a refined config that requires high fps with high memory
    const HighPerformanceConfig = Config.pipe(
    Schema.filter(
    (config) => {
    // High fps (>60) requires at least 1024MB memory
    if (config.fps > 60) {
    return config.memoryLimit >= 1024
    }
    return true
    },
    {
    message: () => 'High FPS (>60) requires at least 1024MB memory',
    }
    )
    // Valid high performance config
    const validHighPerf = { debug: true, fps: 90, memoryLimit: 1536 }
    const resultValid = yield* Schema.decode(HighPerformanceConfig)(validHighPerf)
    expect(resultValid.fps).toBe(90)
    expect(resultValid.memoryLimit).toBe(1536)
    // Invalid high performance config (high fps, low memory)
    const invalidHighPerf = { debug: true, fps: 90, memoryLimit: 512 }
    const resultInvalid = yield* Schema.decode(HighPerformanceConfig)(invalidHighPerf).pipe(Effect.either)
    expect(resultInvalid._tag).toBe('Left')
  })
)
  describe('Performance testing patterns', () => {
  it.effect('should handle large batch validation efficiently', () => Effect.gen(function* () {
    const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
    debug: i % 3 === 0,
    fps: (i % 120) + 1,
    memoryLimit: (i % 2048) + 1,
})
    const results = yield* Effect.all(
    largeBatch.map((config) => Schema.decode(Config)(config)),
    { concurrency: 'unbounded', batching: true }
    )
    const elapsed = Date.now() - start
    expect(results).toHaveLength(1000)
    expect(elapsed).toBeLessThan(2000) // Should complete in less than 2 seconds
  })
),
  Effect.gen(function* () {
    // Create a cached decoder
    const decode = Schema.decodeUnknown(Config)
    const sameConfig = { debug: true, fps: 60, memoryLimit: 1024 }
    // Validate the same config multiple times
    const results = yield* Effect.all(
    Array(100)
    .fill(null)
    .map(() => decode(sameConfig))
)
    results.forEach((result) => {
    expect(result.debug).toBe(true)
    expect(result.fps).toBe(60)
    expect(result.memoryLimit).toBe(1024)
  })
  })
})