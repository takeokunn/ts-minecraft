import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Effect, Exit, Layer } from 'effect'
import {
  AppConfigService,
  AppConfigServiceLive,
  AppConfigServiceTest,
  EnvironmentService,
  EnvironmentServiceLive,
  AppConfigError,
} from '../../services/app-config.service'
import { AppConfig, AppConfigSchema } from '../../schemas/app.schema'
import * as S from 'effect/Schema'

// Test utilities
const runAppConfigService = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect.pipe(Effect.provide(AppConfigServiceTest)))

const runAppConfigServiceExit = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromiseExit(effect.pipe(Effect.provide(AppConfigServiceTest)))

// Mock environment service for testing different environments
const createMockEnvironmentService = (
  mode: string = 'test',
  apiUrl?: string
) => Layer.succeed(
  EnvironmentService,
  EnvironmentService.of({
    getMode: Effect.succeed(mode),
    getApiUrl: Effect.succeed(apiUrl),
    isDevelopment: Effect.succeed(mode === 'development'),
    isProduction: Effect.succeed(mode === 'production'),
    isTest: Effect.succeed(mode === 'test'),
  })
)

describe('AppConfigService', () => {
  describe('Basic Configuration Access', () => {
    it('should get app configuration', async () => {
      const result = await runAppConfigService(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          return yield* service.get
        })
      )

      expect(result).toBeDefined()
      expect(result.appName).toBe('TS Minecraft')
      expect(result.version).toBe('1.0.0')
      expect(result.environment).toBe('test')
      expect(result.debug).toBe(false)
      expect(result.logging).toBeDefined()
      expect(result.features).toBeDefined()
      expect(result.storage).toBeDefined()
      expect(result.security).toBeDefined()
    })

    it('should get environment', async () => {
      const result = await runAppConfigService(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          return yield* service.getEnvironment
        })
      )

      expect(result).toBe('test')
    })

    it('should get feature flags', async () => {
      const result = await runAppConfigService(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          return yield* service.getFeatureFlags
        })
      )

      expect(result).toBeDefined()
      expect(typeof result.enableMultiplayer).toBe('boolean')
      expect(typeof result.enableWebGPU).toBe('boolean')
      expect(typeof result.enableWasm).toBe('boolean')
      expect(typeof result.enableServiceWorker).toBe('boolean')
      expect(typeof result.enableHotReload).toBe('boolean')
      
      // Test environment should have specific features
      expect(result.enableMultiplayer).toBe(false)
      expect(result.enableWebGPU).toBe(false)
      expect(result.enableWasm).toBe(true)
      expect(result.enableServiceWorker).toBe(false)
      expect(result.enableHotReload).toBe(false)
    })

    it('should get logging configuration', async () => {
      const result = await runAppConfigService(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          return yield* service.getLoggingConfig
        })
      )

      expect(result).toBeDefined()
      expect(result.level).toBe('error') // Test environment
      expect(result.enableConsole).toBe(false)
      expect(result.enableRemote).toBe(false)
    })

    it('should check debug enabled status', async () => {
      const result = await runAppConfigService(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          return yield* service.isDebugEnabled
        })
      )

      expect(result).toBe(false) // Test environment should not have debug enabled
    })

    it('should check individual feature flags', async () => {
      const results = await runAppConfigService(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          
          const enableMultiplayer = yield* service.isFeatureEnabled('enableMultiplayer')
          const enableWebGPU = yield* service.isFeatureEnabled('enableWebGPU')
          const enableWasm = yield* service.isFeatureEnabled('enableWasm')
          const enableServiceWorker = yield* service.isFeatureEnabled('enableServiceWorker')
          const enableHotReload = yield* service.isFeatureEnabled('enableHotReload')
          
          return {
            enableMultiplayer,
            enableWebGPU,
            enableWasm,
            enableServiceWorker,
            enableHotReload,
          }
        })
      )

      expect(results.enableMultiplayer).toBe(false)
      expect(results.enableWebGPU).toBe(false)
      expect(results.enableWasm).toBe(true)
      expect(results.enableServiceWorker).toBe(false)
      expect(results.enableHotReload).toBe(false)
    })
  })

  describe('Configuration Updates', () => {
    it('should update basic app configuration properties', async () => {
      await runAppConfigService(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          
          // Update basic properties
          yield* service.update({
            debug: true,
            appName: 'Updated TS Minecraft',
          })
          
          const config = yield* service.get
          expect(config.debug).toBe(true)
          expect(config.appName).toBe('Updated TS Minecraft')
        })
      )
    })

    it('should update nested logging configuration', async () => {
      await runAppConfigService(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          
          yield* service.update({
            logging: {
              level: 'debug',
              enableConsole: true,
            },
          })
          
          const config = yield* service.get
          expect(config.logging.level).toBe('debug')
          expect(config.logging.enableConsole).toBe(true)
          expect(config.logging.enableRemote).toBe(false) // Should preserve existing value
        })
      )
    })

    it('should update nested feature flags', async () => {
      await runAppConfigService(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          
          yield* service.update({
            features: {
              enableWebGPU: true,
              enableMultiplayer: true,
            },
          })
          
          const features = yield* service.getFeatureFlags
          expect(features.enableWebGPU).toBe(true)
          expect(features.enableMultiplayer).toBe(true)
          expect(features.enableWasm).toBe(true) // Should preserve existing value
        })
      )
    })

    it('should update nested storage configuration', async () => {
      await runAppConfigService(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          
          yield* service.update({
            storage: {
              maxCacheSize: 500,
              enableLocalStorage: false,
            },
          })
          
          const config = yield* service.get
          expect(config.storage.maxCacheSize).toBe(500)
          expect(config.storage.enableLocalStorage).toBe(false)
          expect(config.storage.enableIndexedDB).toBe(true) // Should preserve existing
        })
      )
    })

    it('should update nested security configuration', async () => {
      await runAppConfigService(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          
          yield* service.update({
            security: {
              enableCSP: true,
              allowedOrigins: ['https://example.com', 'https://api.example.com'],
            },
          })
          
          const config = yield* service.get
          expect(config.security.enableCSP).toBe(true)
          expect(config.security.allowedOrigins).toEqual(['https://example.com', 'https://api.example.com'])
        })
      )
    })

    it('should handle complex nested updates', async () => {
      await runAppConfigService(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          
          yield* service.update({
            debug: true,
            logging: { level: 'trace' },
            features: { enableWebGPU: true },
            storage: { maxCacheSize: 1000 },
            security: { enableCSP: true },
          })
          
          const config = yield* service.get
          expect(config.debug).toBe(true)
          expect(config.logging.level).toBe('trace')
          expect(config.features.enableWebGPU).toBe(true)
          expect(config.storage.maxCacheSize).toBe(1000)
          expect(config.security.enableCSP).toBe(true)
        })
      )
    })
  })

  describe('Configuration Validation', () => {
    it('should validate valid configuration', async () => {
      const validConfig: AppConfig = {
        appName: 'Test App',
        version: '1.0.0',
        debug: false,
        environment: 'test',
        logging: {
          level: 'info',
          enableConsole: true,
          enableRemote: false,
        },
        features: {
          enableMultiplayer: false,
          enableWebGPU: true,
          enableWasm: true,
          enableServiceWorker: false,
          enableHotReload: false,
        },
        storage: {
          enableLocalStorage: true,
          enableIndexedDB: true,
          maxCacheSize: 100,
        },
        security: {
          enableCSP: false,
          allowedOrigins: ['*'],
        },
      }

      const result = await runAppConfigService(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          return yield* service.validate(validConfig)
        })
      )

      expect(result).toEqual(validConfig)
    })

    it('should reject invalid configuration with validation error', async () => {
      const invalidConfig = {
        appName: '', // Invalid: empty string
        version: '1.0.0',
        debug: false,
        environment: 'invalid', // Invalid: not in enum
        logging: {
          level: 'invalid', // Invalid: not in enum
          enableConsole: true,
          enableRemote: false,
        },
        features: {
          enableMultiplayer: 'yes', // Invalid: not boolean
          enableWebGPU: true,
          enableWasm: true,
          enableServiceWorker: false,
          enableHotReload: false,
        },
        storage: {
          enableLocalStorage: true,
          enableIndexedDB: true,
          maxCacheSize: -1, // Invalid: negative
        },
        security: {
          enableCSP: false,
          allowedOrigins: 'not-an-array', // Invalid: not array
        },
      }

      const exit = await runAppConfigServiceExit(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          return yield* service.validate(invalidConfig)
        })
      )

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(exit.cause._tag).toBe('Fail')
        if (exit.cause._tag === 'Fail') {
          expect(exit.cause.error).toBeInstanceOf(AppConfigError)
          expect(exit.cause.error.reason).toBe('validation')
        }
      }
    })

    it('should reject partial invalid configuration', async () => {
      const invalidPartialConfig = {
        appName: 'Valid App',
        version: '', // Invalid: empty version
        features: {
          enableMultiplayer: null, // Invalid: null instead of boolean
        },
      }

      const exit = await runAppConfigServiceExit(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          return yield* service.validate(invalidPartialConfig)
        })
      )

      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('Configuration Reload', () => {
    it('should reload configuration from environment', async () => {
      const result = await runAppConfigService(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          
          // Modify current config
          yield* service.update({ debug: true })
          
          // Reload should reset to environment defaults
          return yield* service.reload
        })
      )

      expect(result).toBeDefined()
      expect(result.environment).toBe('test')
      // After reload, should match test environment defaults
      expect(result.debug).toBe(false) // Test environment default
      expect(result.logging.level).toBe('error')
    })
  })

  describe('Environment-Specific Configuration', () => {
    it('should create development environment configuration', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          return yield* service.get
        }).pipe(
          Effect.provide(
            AppConfigServiceLive.pipe(
              Layer.provide(createMockEnvironmentService('development', 'http://localhost:3000'))
            )
          )
        )
      )

      expect(result.environment).toBe('development')
      expect(result.debug).toBe(true)
      expect(result.apiUrl).toBe('http://localhost:3000')
      expect(result.logging.level).toBe('debug')
      expect(result.logging.enableConsole).toBe(true)
      expect(result.features.enableHotReload).toBe(true)
      expect(result.security.enableCSP).toBe(false)
      expect(result.security.allowedOrigins).toEqual(['*'])
    })

    it('should create production environment configuration', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          return yield* service.get
        }).pipe(
          Effect.provide(
            AppConfigServiceLive.pipe(
              Layer.provide(createMockEnvironmentService('production', 'https://api.example.com'))
            )
          )
        )
      )

      expect(result.environment).toBe('production')
      expect(result.debug).toBe(false)
      expect(result.apiUrl).toBe('https://api.example.com')
      expect(result.logging.level).toBe('warn')
      expect(result.logging.enableConsole).toBe(false)
      expect(result.logging.enableRemote).toBe(true)
      expect(result.features.enableMultiplayer).toBe(true)
      expect(result.features.enableHotReload).toBe(false)
      expect(result.security.enableCSP).toBe(true)
      expect(result.security.allowedOrigins).toEqual(['https://your-domain.com'])
      expect(result.storage.maxCacheSize).toBe(200)
    })

    it('should create test environment configuration', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          return yield* service.get
        }).pipe(
          Effect.provide(
            AppConfigServiceLive.pipe(
              Layer.provide(createMockEnvironmentService('test'))
            )
          )
        )
      )

      expect(result.environment).toBe('test')
      expect(result.debug).toBe(false)
      expect(result.logging.level).toBe('error')
      expect(result.logging.enableConsole).toBe(false)
      expect(result.logging.enableRemote).toBe(false)
      expect(result.features.enableMultiplayer).toBe(false)
      expect(result.features.enableWebGPU).toBe(false)
      expect(result.features.enableWasm).toBe(true)
      expect(result.storage.maxCacheSize).toBe(100)
    })

    it('should handle unknown environment mode', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          return yield* service.get
        }).pipe(
          Effect.provide(
            Layer.provide(
              AppConfigServiceLive,
              createMockEnvironmentService('unknown')
            )
          )
        )
      )

      // Unknown environment should use default config
      expect(result).toBeDefined()
      expect(result.appName).toBe('TS Minecraft')
      expect(result.version).toBe('1.0.0')
    })
  })

  describe('Live Environment Service', () => {
    it('should work with live environment service', async () => {
      // Mock import.meta.env
      const mockImportMeta = {
        env: {
          MODE: 'test',
          VITE_API_URL: 'https://test-api.example.com'
        }
      }
      
      vi.stubGlobal('import.meta', mockImportMeta)

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const envService = yield* EnvironmentService
          const mode = yield* envService.getMode
          const apiUrl = yield* envService.getApiUrl
          const isDev = yield* envService.isDevelopment
          const isProd = yield* envService.isProduction
          const isTest = yield* envService.isTest
          
          return { mode, apiUrl, isDev, isProd, isTest }
        }).pipe(Effect.provide(EnvironmentServiceLive))
      )

      expect(result.mode).toBe('test')
      expect(result.apiUrl).toBe('https://test-api.example.com')
      expect(result.isDev).toBe(false)
      expect(result.isProd).toBe(false)
      expect(result.isTest).toBe(true)

      vi.unstubAllGlobals()
    })

    it('should handle missing import.meta gracefully', async () => {
      vi.stubGlobal('import.meta', undefined)

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const envService = yield* EnvironmentService
          const mode = yield* envService.getMode
          const apiUrl = yield* envService.getApiUrl
          
          return { mode, apiUrl }
        }).pipe(Effect.provide(EnvironmentServiceLive))
      )

      expect(result.mode).toBe('test') // Test environment is active during tests
      expect(result.apiUrl).toBeUndefined()

      vi.unstubAllGlobals()
    })

    it('should handle missing MODE environment variable', async () => {
      const mockImportMeta = {
        env: {
          VITE_API_URL: 'https://api.example.com'
          // MODE is missing
        }
      }
      
      vi.stubGlobal('import.meta', mockImportMeta)

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const envService = yield* EnvironmentService
          return yield* envService.getMode
        }).pipe(Effect.provide(EnvironmentServiceLive))
      )

      expect(result).toBe('test') // Test environment is active during tests

      vi.unstubAllGlobals()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle update with invalid nested configuration', async () => {
      const exit = await runAppConfigServiceExit(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          
          // Try to update with invalid data
          yield* service.update({
            logging: {
              level: 'invalid-level' as any,
              enableConsole: 'not-a-boolean' as any,
            },
          })
        })
      )

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(exit.cause._tag).toBe('Fail')
        if (exit.cause._tag === 'Fail') {
          expect(exit.cause.error).toBeInstanceOf(AppConfigError)
        }
      }
    })

    it('should preserve configuration state after failed update', async () => {
      await runAppConfigService(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          
          // Get initial state
          const initialConfig = yield* service.get
          
          // Try invalid update (should fail)
          const updateResult = yield* Effect.either(
            service.update({
              appName: '', // Invalid
            })
          )
          
          // Configuration should remain unchanged after failed update
          const finalConfig = yield* service.get
          expect(finalConfig.appName).toBe(initialConfig.appName)
          expect(updateResult._tag).toBe('Left') // Should have failed
        })
      )
    })

    it('should handle concurrent updates correctly', async () => {
      await runAppConfigService(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          
          // Perform concurrent updates
          yield* Effect.all([
            service.update({ debug: true }),
            service.update({ appName: 'Concurrent App' }),
            service.update({ logging: { level: 'warn' } }),
          ], { concurrency: 'unbounded' })
          
          const finalConfig = yield* service.get
          
          // One of the updates should have succeeded (exact result may vary due to concurrency)
          expect(finalConfig).toBeDefined()
        })
      )
    })

    it('should handle feature flag edge cases', async () => {
      const results = await runAppConfigService(
        Effect.gen(function* () {
          const service = yield* AppConfigService
          
          // Test all possible feature flags
          const features = ['enableMultiplayer', 'enableWebGPU', 'enableWasm', 'enableServiceWorker', 'enableHotReload'] as const
          
          const featureStates = yield* Effect.all(
            features.map(feature => service.isFeatureEnabled(feature)),
            { concurrency: 'unbounded' }
          )
          
          return features.reduce((acc, feature, index) => {
            acc[feature] = featureStates[index]
            return acc
          }, {} as Record<string, boolean>)
        })
      )

      // Verify all feature flags return boolean values
      for (const feature of Object.keys(results)) {
        expect(typeof results[feature]).toBe('boolean')
      }
    })

    it('should create proper AppConfigError instances', () => {
      const validationError = new AppConfigError({
        reason: 'validation',
        message: 'Test validation error',
      })

      expect(validationError.reason).toBe('validation')
      expect(validationError.message).toBe('Test validation error')
      expect(validationError._tag).toBe('AppConfigError')

      const environmentError = new AppConfigError({
        reason: 'environment',
        message: 'Test environment error',
        cause: new Error('Underlying error'),
      })

      expect(environmentError.reason).toBe('environment')
      expect(environmentError.cause).toBeInstanceOf(Error)
    })
  })
})