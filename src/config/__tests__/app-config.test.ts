import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Effect } from 'effect'
import * as S from 'effect/Schema'
import {
  AppConfigSchema,
  LoggingConfigSchema,
  FeatureFlagsSchema,
  StorageConfigSchema,
  SecurityConfigSchema,
  APP_CONFIG,
  type AppConfig,
} from '../app-config'

describe('AppConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('LoggingConfigSchema', () => {
    it('should validate correct logging configuration', async () => {
      const validConfig = {
        level: 'debug' as const,
        enableConsole: true,
        enableRemote: false,
      }

      const result = await Effect.runPromise(S.decodeUnknown(LoggingConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should accept all valid log levels', async () => {
      const levels = ['error', 'warn', 'info', 'debug'] as const
      
      for (const level of levels) {
        const config = {
          level,
          enableConsole: true,
          enableRemote: false,
        }
        
        const result = await Effect.runPromise(S.decodeUnknown(LoggingConfigSchema)(config))
        expect(result.level).toBe(level)
      }
    })

    it('should reject invalid log level', async () => {
      const invalidConfig = {
        level: 'invalid',
        enableConsole: true,
        enableRemote: false,
      }

      await expect(
        Effect.runPromise(S.decodeUnknown(LoggingConfigSchema)(invalidConfig))
      ).rejects.toThrow()
    })

    it('should reject missing required fields', async () => {
      const invalidConfigs = [
        { enableConsole: true, enableRemote: false },
        { level: 'info', enableRemote: false },
        { level: 'info', enableConsole: true },
        {},
      ]

      for (const config of invalidConfigs) {
        await expect(
          Effect.runPromise(S.decodeUnknown(LoggingConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should reject non-boolean values for enable flags', async () => {
      const invalidConfigs = [
        { level: 'info', enableConsole: 'true', enableRemote: false },
        { level: 'info', enableConsole: true, enableRemote: 'false' },
        { level: 'info', enableConsole: 1, enableRemote: 0 },
      ]

      for (const config of invalidConfigs) {
        await expect(
          Effect.runPromise(S.decodeUnknown(LoggingConfigSchema)(config))
        ).rejects.toThrow()
      }
    })
  })

  describe('FeatureFlagsSchema', () => {
    it('should validate correct feature flags', async () => {
      const validConfig = {
        enableMultiplayer: false,
        enableWebGPU: true,
        enableWasm: true,
        enableServiceWorker: false,
        enableHotReload: true,
      }

      const result = await Effect.runPromise(S.decodeUnknown(FeatureFlagsSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should reject missing feature flags', async () => {
      const incompleteConfigs = [
        { enableMultiplayer: false }, // missing other flags
        { enableWebGPU: true, enableWasm: true }, // missing other flags
        {}, // empty object
      ]

      for (const config of incompleteConfigs) {
        await expect(
          Effect.runPromise(S.decodeUnknown(FeatureFlagsSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should reject non-boolean feature flag values', async () => {
      const invalidConfig = {
        enableMultiplayer: 'false',
        enableWebGPU: 1,
        enableWasm: true,
        enableServiceWorker: false,
        enableHotReload: true,
      }

      await expect(
        Effect.runPromise(S.decodeUnknown(FeatureFlagsSchema)(invalidConfig))
      ).rejects.toThrow()
    })
  })

  describe('StorageConfigSchema', () => {
    it('should validate correct storage configuration', async () => {
      const validConfig = {
        enableLocalStorage: true,
        enableIndexedDB: true,
        maxCacheSize: 500,
      }

      const result = await Effect.runPromise(S.decodeUnknown(StorageConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should reject negative maxCacheSize', async () => {
      const invalidConfig = {
        enableLocalStorage: true,
        enableIndexedDB: true,
        maxCacheSize: -100,
      }

      await expect(
        Effect.runPromise(S.decodeUnknown(StorageConfigSchema)(invalidConfig))
      ).rejects.toThrow()
    })

    it('should reject zero maxCacheSize', async () => {
      const invalidConfig = {
        enableLocalStorage: true,
        enableIndexedDB: true,
        maxCacheSize: 0,
      }

      await expect(
        Effect.runPromise(S.decodeUnknown(StorageConfigSchema)(invalidConfig))
      ).rejects.toThrow()
    })

    it('should accept positive maxCacheSize values', async () => {
      const validSizes = [1, 100, 500, 1000, 2048]
      
      for (const size of validSizes) {
        const config = {
          enableLocalStorage: true,
          enableIndexedDB: true,
          maxCacheSize: size,
        }
        
        const result = await Effect.runPromise(S.decodeUnknown(StorageConfigSchema)(config))
        expect(result.maxCacheSize).toBe(size)
      }
    })

    it('should reject non-numeric maxCacheSize', async () => {
      const invalidConfig = {
        enableLocalStorage: true,
        enableIndexedDB: true,
        maxCacheSize: '500',
      }

      await expect(
        Effect.runPromise(S.decodeUnknown(StorageConfigSchema)(invalidConfig))
      ).rejects.toThrow()
    })
  })

  describe('SecurityConfigSchema', () => {
    it('should validate correct security configuration', async () => {
      const validConfig = {
        enableCSP: true,
        allowedOrigins: ['https://example.com', 'https://api.example.com'],
      }

      const result = await Effect.runPromise(S.decodeUnknown(SecurityConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should accept empty allowedOrigins array', async () => {
      const validConfig = {
        enableCSP: false,
        allowedOrigins: [],
      }

      const result = await Effect.runPromise(S.decodeUnknown(SecurityConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should accept wildcard in allowedOrigins', async () => {
      const validConfig = {
        enableCSP: false,
        allowedOrigins: ['*'],
      }

      const result = await Effect.runPromise(S.decodeUnknown(SecurityConfigSchema)(validConfig))
      expect(result.allowedOrigins).toEqual(['*'])
    })

    it('should reject non-array allowedOrigins', async () => {
      const invalidConfig = {
        enableCSP: true,
        allowedOrigins: 'https://example.com',
      }

      await expect(
        Effect.runPromise(S.decodeUnknown(SecurityConfigSchema)(invalidConfig))
      ).rejects.toThrow()
    })

    it('should reject non-string items in allowedOrigins', async () => {
      const invalidConfig = {
        enableCSP: true,
        allowedOrigins: ['https://example.com', 123, null],
      }

      await expect(
        Effect.runPromise(S.decodeUnknown(SecurityConfigSchema)(invalidConfig))
      ).rejects.toThrow()
    })
  })

  describe('AppConfigSchema', () => {
    it('should validate complete correct app configuration', async () => {
      const validConfig = {
        appName: 'TS Minecraft Test',
        version: '1.0.0',
        debug: true,
        environment: 'development' as const,
        apiUrl: 'https://api.example.com',
        logging: {
          level: 'debug' as const,
          enableConsole: true,
          enableRemote: false,
        },
        features: {
          enableMultiplayer: false,
          enableWebGPU: true,
          enableWasm: true,
          enableServiceWorker: false,
          enableHotReload: true,
        },
        storage: {
          enableLocalStorage: true,
          enableIndexedDB: true,
          maxCacheSize: 500,
        },
        security: {
          enableCSP: false,
          allowedOrigins: ['*'],
        },
      }

      const result = await Effect.runPromise(S.decodeUnknown(AppConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should validate configuration without optional apiUrl', async () => {
      const validConfig = {
        appName: 'TS Minecraft Test',
        version: '1.0.0',
        debug: false,
        environment: 'production' as const,
        logging: {
          level: 'warn' as const,
          enableConsole: false,
          enableRemote: true,
        },
        features: {
          enableMultiplayer: true,
          enableWebGPU: true,
          enableWasm: true,
          enableServiceWorker: true,
          enableHotReload: false,
        },
        storage: {
          enableLocalStorage: true,
          enableIndexedDB: true,
          maxCacheSize: 200,
        },
        security: {
          enableCSP: true,
          allowedOrigins: ['https://example.com'],
        },
      }

      const result = await Effect.runPromise(S.decodeUnknown(AppConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should accept all valid environment values', async () => {
      const environments = ['development', 'production', 'test'] as const
      
      for (const environment of environments) {
        const config = {
          appName: 'Test App',
          version: '1.0.0',
          debug: false,
          environment,
          logging: {
            level: 'info' as const,
            enableConsole: true,
            enableRemote: false,
          },
          features: {
            enableMultiplayer: false,
            enableWebGPU: false,
            enableWasm: false,
            enableServiceWorker: false,
            enableHotReload: false,
          },
          storage: {
            enableLocalStorage: true,
            enableIndexedDB: false,
            maxCacheSize: 100,
          },
          security: {
            enableCSP: false,
            allowedOrigins: [],
          },
        }
        
        const result = await Effect.runPromise(S.decodeUnknown(AppConfigSchema)(config))
        expect(result.environment).toBe(environment)
      }
    })

    it('should reject invalid environment values', async () => {
      const invalidConfig = {
        appName: 'Test App',
        version: '1.0.0',
        debug: false,
        environment: 'staging',
        logging: {
          level: 'info',
          enableConsole: true,
          enableRemote: false,
        },
        features: {
          enableMultiplayer: false,
          enableWebGPU: false,
          enableWasm: false,
          enableServiceWorker: false,
          enableHotReload: false,
        },
        storage: {
          enableLocalStorage: true,
          enableIndexedDB: false,
          maxCacheSize: 100,
        },
        security: {
          enableCSP: false,
          allowedOrigins: [],
        },
      }

      await expect(
        Effect.runPromise(S.decodeUnknown(AppConfigSchema)(invalidConfig))
      ).rejects.toThrow()
    })

    it('should reject empty appName', async () => {
      const invalidConfig = {
        appName: '',
        version: '1.0.0',
        debug: false,
        environment: 'development' as const,
        logging: {
          level: 'info' as const,
          enableConsole: true,
          enableRemote: false,
        },
        features: {
          enableMultiplayer: false,
          enableWebGPU: false,
          enableWasm: false,
          enableServiceWorker: false,
          enableHotReload: false,
        },
        storage: {
          enableLocalStorage: true,
          enableIndexedDB: false,
          maxCacheSize: 100,
        },
        security: {
          enableCSP: false,
          allowedOrigins: [],
        },
      }

      await expect(
        Effect.runPromise(S.decodeUnknown(AppConfigSchema)(invalidConfig))
      ).rejects.toThrow()
    })

    it('should reject empty version', async () => {
      const invalidConfig = {
        appName: 'Test App',
        version: '',
        debug: false,
        environment: 'development' as const,
        logging: {
          level: 'info' as const,
          enableConsole: true,
          enableRemote: false,
        },
        features: {
          enableMultiplayer: false,
          enableWebGPU: false,
          enableWasm: false,
          enableServiceWorker: false,
          enableHotReload: false,
        },
        storage: {
          enableLocalStorage: true,
          enableIndexedDB: false,
          maxCacheSize: 100,
        },
        security: {
          enableCSP: false,
          allowedOrigins: [],
        },
      }

      await expect(
        Effect.runPromise(S.decodeUnknown(AppConfigSchema)(invalidConfig))
      ).rejects.toThrow()
    })

    it('should reject missing required nested configurations', async () => {
      const incompleteConfigs = [
        {
          appName: 'Test App',
          version: '1.0.0',
          debug: false,
          environment: 'development',
          // missing logging, features, storage, security
        },
        {
          appName: 'Test App',
          version: '1.0.0',
          debug: false,
          environment: 'development',
          logging: { level: 'info', enableConsole: true, enableRemote: false },
          // missing features, storage, security
        },
      ]

      for (const config of incompleteConfigs) {
        await expect(
          Effect.runPromise(S.decodeUnknown(AppConfigSchema)(config))
        ).rejects.toThrow()
      }
    })
  })


  describe('APP_CONFIG Export', () => {
    it('should export a valid APP_CONFIG based on environment', () => {
      expect(APP_CONFIG).toBeDefined()
      expect(APP_CONFIG.appName).toBe('TS Minecraft')
      expect(APP_CONFIG.version).toBe('1.0.0')
      expect(['development', 'production', 'test']).toContain(APP_CONFIG.environment)
      
      // Validate that the exported config passes schema validation
      expect(() => S.decodeUnknownSync(AppConfigSchema)(APP_CONFIG)).not.toThrow()
    })

    it('should have valid logging configuration', () => {
      expect(APP_CONFIG.logging).toBeDefined()
      expect(['error', 'warn', 'info', 'debug']).toContain(APP_CONFIG.logging.level)
      expect(typeof APP_CONFIG.logging.enableConsole).toBe('boolean')
      expect(typeof APP_CONFIG.logging.enableRemote).toBe('boolean')
    })

    it('should have valid feature flags', () => {
      expect(APP_CONFIG.features).toBeDefined()
      expect(typeof APP_CONFIG.features.enableMultiplayer).toBe('boolean')
      expect(typeof APP_CONFIG.features.enableWebGPU).toBe('boolean')
      expect(typeof APP_CONFIG.features.enableWasm).toBe('boolean')
      expect(typeof APP_CONFIG.features.enableServiceWorker).toBe('boolean')
      expect(typeof APP_CONFIG.features.enableHotReload).toBe('boolean')
    })

    it('should have valid storage configuration', () => {
      expect(APP_CONFIG.storage).toBeDefined()
      expect(typeof APP_CONFIG.storage.enableLocalStorage).toBe('boolean')
      expect(typeof APP_CONFIG.storage.enableIndexedDB).toBe('boolean')
      expect(APP_CONFIG.storage.maxCacheSize).toBeGreaterThan(0)
      expect(typeof APP_CONFIG.storage.maxCacheSize).toBe('number')
    })

    it('should have valid security configuration', () => {
      expect(APP_CONFIG.security).toBeDefined()
      expect(typeof APP_CONFIG.security.enableCSP).toBe('boolean')
      expect(Array.isArray(APP_CONFIG.security.allowedOrigins)).toBe(true)
      APP_CONFIG.security.allowedOrigins.forEach((origin) => {
        expect(typeof origin).toBe('string')
      })
    })
  })

  describe('Environment-specific Configurations', () => {
    const originalMode = import.meta.env.MODE

    it('should use development config in development mode', () => {
      // Note: In a real test, you might need to mock import.meta.env
      // This test assumes the current environment or tests the exported constant
      if (APP_CONFIG.environment === 'development') {
        expect(APP_CONFIG.debug).toBe(true)
        expect(APP_CONFIG.logging.level).toBe('debug')
        expect(APP_CONFIG.logging.enableConsole).toBe(true)
        expect(APP_CONFIG.logging.enableRemote).toBe(false)
        expect(APP_CONFIG.features.enableHotReload).toBe(true)
        expect(APP_CONFIG.security.enableCSP).toBe(false)
        expect(APP_CONFIG.security.allowedOrigins).toEqual(['*'])
      }
    })

    it('should validate production config structure', () => {
      // Test production config values if available
      if (APP_CONFIG.environment === 'production') {
        expect(APP_CONFIG.debug).toBe(false)
        expect(APP_CONFIG.logging.level).toBe('warn')
        expect(APP_CONFIG.logging.enableConsole).toBe(false)
        expect(APP_CONFIG.logging.enableRemote).toBe(true)
        expect(APP_CONFIG.features.enableHotReload).toBe(false)
        expect(APP_CONFIG.security.enableCSP).toBe(true)
        expect(APP_CONFIG.storage.maxCacheSize).toBe(200)
      }
    })

    it('should validate test config structure', () => {
      // Test config values if available
      if (APP_CONFIG.environment === 'test') {
        expect(APP_CONFIG.debug).toBe(false)
        expect(APP_CONFIG.logging.level).toBe('error')
        expect(APP_CONFIG.logging.enableConsole).toBe(false)
        expect(APP_CONFIG.logging.enableRemote).toBe(false)
        expect(APP_CONFIG.features.enableHotReload).toBe(false)
      }
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed nested objects', async () => {
      const malformedConfigs = [
        {
          appName: 'Test',
          version: '1.0.0',
          debug: false,
          environment: 'development',
          logging: 'invalid', // should be object
          features: {},
          storage: {},
          security: {},
        },
        {
          appName: 'Test',
          version: '1.0.0',
          debug: false,
          environment: 'development',
          logging: { level: 'info', enableConsole: true, enableRemote: false },
          features: [], // should be object
          storage: {},
          security: {},
        },
      ]

      for (const config of malformedConfigs) {
        await expect(
          Effect.runPromise(S.decodeUnknown(AppConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should handle extra properties gracefully', async () => {
      const configWithExtra = {
        appName: 'Test App',
        version: '1.0.0',
        debug: false,
        environment: 'development' as const,
        extraProperty: 'should be ignored',
        logging: {
          level: 'info' as const,
          enableConsole: true,
          enableRemote: false,
          extraLogProp: 'ignored',
        },
        features: {
          enableMultiplayer: false,
          enableWebGPU: false,
          enableWasm: false,
          enableServiceWorker: false,
          enableHotReload: false,
        },
        storage: {
          enableLocalStorage: true,
          enableIndexedDB: false,
          maxCacheSize: 100,
        },
        security: {
          enableCSP: false,
          allowedOrigins: [],
        },
      }

      // Schema validation should either accept (and possibly strip extra properties)
      // or reject extra properties depending on schema configuration
      // This test documents the expected behavior
      const result = await Effect.runPromise(S.decodeUnknown(AppConfigSchema)(configWithExtra))
      expect(result.appName).toBe('Test App')
      expect(result.version).toBe('1.0.0')
      // Extra properties should not be present in result
      expect('extraProperty' in result).toBe(false)
    })
  })
})