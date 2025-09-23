import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { Config } from '../Config'

describe('Config Schema', () => {
  describe('Valid configurations', () => {
  it.effect('should validate minimal valid config', () => Effect.gen(function* () {
    const validConfig = {
    debug: false,
    fps: 1,
    memoryLimit: 1,
    }
    const result = Schema.decodeUnknownSync(Config)(validConfig)
    expect(result).toEqual(validConfig)
})
),
  Effect.gen(function* () {
        const validConfig = {
          debug: true,
          fps: 60,
          memoryLimit: 2048,
        }
        const result = Schema.decodeUnknownSync(Config)(validConfig)
        expect(result).toEqual(validConfig)
      })
    it.effect('should validate maximum values', () => Effect.gen(function* () {
    const validConfig = {
    debug: false,
    fps: 120,
    memoryLimit: 2048,
    }
    const result = Schema.decodeUnknownSync(Config)(validConfig)
    expect(result).toEqual(validConfig)
  })
),
    Effect.gen(function* () {
    const invalidConfig = {
    debug: true,
    fps: 59.94, // Common video fps but not allowed (must be integer)
    memoryLimit: 1024,
    }
    expect(() => Schema.decodeUnknownSync(Config)(invalidConfig)).toThrow()
    })
    })

    describe('Invalid configurations', () => {
  it.effect('should reject missing fields', () => Effect.gen(function* () {
    const invalidConfigs = [
    { debug: true, fps: 60 }, // missing memoryLimit
    { debug: true, memoryLimit: 1024 }, // missing fps
    { fps: 60, memoryLimit: 1024 }, // missing debug
    { debug: true }, // missing fps and memoryLimit
    { fps: 60 }, // missing debug and memoryLimit
    { memoryLimit: 1024 }, // missing debug and fps
    {}, // missing all fields
    ]
    for (const config of invalidConfigs) {
    expect(() => Schema.decodeUnknownSync(Config)(config)).toThrow()
    }
})
),
  Effect.gen(function* () {
        const invalidConfigs = [
          { debug: false, fps: 0, memoryLimit: 1024 }, // fps too low
          { debug: false, fps: -1, memoryLimit: 1024 }, // negative fps
          { debug: false, fps: 121, memoryLimit: 1024 }, // fps too high
          { debug: false, fps: 1000, memoryLimit: 1024 }, // way too high
        ]

        for (const config of invalidConfigs) {
          expect(() => Schema.decodeUnknownSync(Config)(config)).toThrow()
        }
      })
    it.effect('should reject out-of-range memoryLimit values', () => Effect.gen(function* () {
    const invalidConfigs = [
    { debug: false, fps: 60, memoryLimit: 0 }, // memory too low
    { debug: false, fps: 60, memoryLimit: -1 }, // negative memory
    { debug: false, fps: 60, memoryLimit: 2049 }, // memory too high
    { debug: false, fps: 60, memoryLimit: 10000 }, // way too high
    ]
    for (const config of invalidConfigs) {
    expect(() => Schema.decodeUnknownSync(Config)(config)).toThrow()
    }
  })
),
    Effect.gen(function* () {
    const invalidConfigs = [
    { debug: 'true', fps: 60, memoryLimit: 1024 }, // string debug
    { debug: 1, fps: 60, memoryLimit: 1024 }, // number debug
    { debug: false, fps: '60', memoryLimit: 1024 }, // string fps
    { debug: false, fps: true, memoryLimit: 1024 }, // boolean fps
    { debug: false, fps: 60, memoryLimit: '1024' }, // string memoryLimit
    { debug: false, fps: 60, memoryLimit: true }, // boolean memoryLimit
    'invalid', // string instead of object
    123, // number instead of object
    null, // null
    undefined, // undefined
    ]

    for (const config of invalidConfigs) {
    expect(() => Schema.decodeUnknownSync(Config)(config)).toThrow()
    }
    })
    })

    describe('Edge cases', () => {
  it.effect('should handle boundary values correctly', () => Effect.gen(function* () {
    // Test exact boundary values
    const boundaryConfigs = [
    { debug: true, fps: 1, memoryLimit: 1 }, // minimum values
    { debug: false, fps: 120, memoryLimit: 2048 }, // maximum values
    ]
    for (const config of boundaryConfigs) {
    const result = Schema.decodeUnknownSync(Config)(config)
    expect(result).toEqual(config)
    }
})
),
  Effect.gen(function* () {
        const configWithExtra = {
          debug: true,
          fps: 60,
          memoryLimit: 1024,
          extraField: 'should be ignored',
          anotherExtra: 123,
        }

        const result = Schema.decodeUnknownSync(Config)(configWithExtra)
        expect(result).toEqual({
          debug: true,
          fps: 60,
          memoryLimit: 1024,
        })
      })
    it.effect('should handle special number values', () => Effect.gen(function* () {
    const invalidConfigs = [
    { debug: false, fps: NaN, memoryLimit: 1024 },
    { debug: false, fps: Infinity, memoryLimit: 1024 },
    { debug: false, fps: -Infinity, memoryLimit: 1024 },
    { debug: false, fps: 60, memoryLimit: NaN },
    { debug: false, fps: 60, memoryLimit: Infinity },
    { debug: false, fps: 60, memoryLimit: -Infinity },
    ]
    for (const config of invalidConfigs) {
    expect(() => Schema.decodeUnknownSync(Config)(config)).toThrow()
    }
  })
)
})