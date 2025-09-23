import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'
import { Config } from '../Config'

describe('Config Schema', () => {
  describe('Valid configurations', () => {
    it('should validate minimal valid config', () => {
      const validConfig = {
        debug: false,
        fps: 1,
        memoryLimit: 1,
      }

      const result = Schema.decodeUnknownSync(Config)(validConfig)
      expect(result).toEqual(validConfig)
    })

    it('should validate typical config values', () => {
      const validConfig = {
        debug: true,
        fps: 60,
        memoryLimit: 2048,
      }

      const result = Schema.decodeUnknownSync(Config)(validConfig)
      expect(result).toEqual(validConfig)
    })

    it('should validate maximum values', () => {
      const validConfig = {
        debug: false,
        fps: 120,
        memoryLimit: 2048,
      }

      const result = Schema.decodeUnknownSync(Config)(validConfig)
      expect(result).toEqual(validConfig)
    })

    it('should reject decimal fps values', () => {
      const invalidConfig = {
        debug: true,
        fps: 59.94, // Common video fps but not allowed (must be integer)
        memoryLimit: 1024,
      }

      expect(() => Schema.decodeUnknownSync(Config)(invalidConfig)).toThrow()
    })
  })

  describe('Invalid configurations', () => {
    it('should reject missing fields', () => {
      const invalidConfigs = [
        { debug: true, fps: 60 }, // missing memoryLimit
        { debug: true, memoryLimit: 1024 }, // missing fps
        { fps: 60, memoryLimit: 1024 }, // missing debug
        {}, // missing all fields
      ]

      invalidConfigs.forEach((config) => {
        expect(() => Schema.decodeUnknownSync(Config)(config)).toThrow()
      })
    })

    it('should reject wrong types', () => {
      const invalidConfigs = [
        { debug: 'true', fps: 60, memoryLimit: 1024 }, // debug as string
        { debug: true, fps: '60', memoryLimit: 1024 }, // fps as string
        { debug: true, fps: 60, memoryLimit: '1024' }, // memoryLimit as string
        { debug: 1, fps: 60, memoryLimit: 1024 }, // debug as number
      ]

      invalidConfigs.forEach((config) => {
        expect(() => Schema.decodeUnknownSync(Config)(config)).toThrow()
      })
    })

    it('should reject fps out of range', () => {
      const invalidConfigs = [
        { debug: true, fps: 0, memoryLimit: 1024 }, // fps = 0
        { debug: true, fps: -1, memoryLimit: 1024 }, // negative fps
        { debug: true, fps: -10, memoryLimit: 1024 }, // very negative fps
        { debug: true, fps: 121, memoryLimit: 1024 }, // fps > 120
        { debug: true, fps: 1000, memoryLimit: 1024 }, // very high fps
      ]

      invalidConfigs.forEach((config) => {
        expect(() => Schema.decodeUnknownSync(Config)(config)).toThrow()
      })
    })

    it('should reject memoryLimit out of range', () => {
      const invalidConfigs = [
        { debug: true, fps: 60, memoryLimit: 0 }, // memoryLimit = 0
        { debug: true, fps: 60, memoryLimit: -1 }, // negative memoryLimit
        { debug: true, fps: 60, memoryLimit: -100 }, // very negative
        { debug: true, fps: 60, memoryLimit: 2049 }, // over 2048 limit
        { debug: true, fps: 60, memoryLimit: 10000 }, // very high
      ]

      invalidConfigs.forEach((config) => {
        expect(() => Schema.decodeUnknownSync(Config)(config)).toThrow()
      })
    })

    it('should accept extra properties (Effect-TS Schema behavior)', () => {
      const configWithExtra = {
        debug: true,
        fps: 60,
        memoryLimit: 1024,
        extraField: 'is allowed and ignored',
      }

      // Effect-TS Schema.Struct allows extra properties by default
      const result = Schema.decodeUnknownSync(Config)(configWithExtra)
      expect(result.debug).toBe(true)
      expect(result.fps).toBe(60)
      expect(result.memoryLimit).toBe(1024)
      // extraField is not included in the result
      expect('extraField' in result).toBe(false)
    })
  })

  describe('Schema properties', () => {
    it('should have correct Type inference', () => {
      type ConfigType = typeof Config.Type

      // This is a compile-time test - if it compiles, the types are correct
      const config: ConfigType = {
        debug: true,
        fps: 60,
        memoryLimit: 1024,
      }

      expect(config).toBeDefined()
    })

    it('should be usable with Schema.is', () => {
      const validConfig = {
        debug: false,
        fps: 30,
        memoryLimit: 512,
      }

      const invalidConfig = {
        debug: 'false',
        fps: 30,
        memoryLimit: 512,
      }

      expect(Schema.is(Config)(validConfig)).toBe(true)
      expect(Schema.is(Config)(invalidConfig)).toBe(false)
    })

    it('should provide meaningful error messages', () => {
      const invalidConfig = {
        debug: true,
        fps: -5,
        memoryLimit: 3000,
      }

      try {
        Schema.decodeUnknownSync(Config)(invalidConfig)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect(String(error)).toContain('fps') // Should mention fps issue
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle null and undefined', () => {
      expect(() => Schema.decodeUnknownSync(Config)(null)).toThrow()
      expect(() => Schema.decodeUnknownSync(Config)(undefined)).toThrow()
    })

    it('should handle arrays and primitive values', () => {
      expect(() => Schema.decodeUnknownSync(Config)([])).toThrow()
      expect(() => Schema.decodeUnknownSync(Config)('string')).toThrow()
      expect(() => Schema.decodeUnknownSync(Config)(123)).toThrow()
      expect(() => Schema.decodeUnknownSync(Config)(true)).toThrow()
    })

    it('should handle boundary values correctly', () => {
      // Test exact boundary values
      const boundaryConfigs = [
        { debug: true, fps: 1, memoryLimit: 1 }, // minimum values
        { debug: false, fps: 120, memoryLimit: 2048 }, // maximum values
      ]

      boundaryConfigs.forEach((config) => {
        expect(() => Schema.decodeUnknownSync(Config)(config)).not.toThrow()
      })
    })
  })
})
