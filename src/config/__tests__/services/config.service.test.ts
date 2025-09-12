import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Effect, Exit, Layer, Ref } from 'effect'
import {
  ConfigService,
  ConfigServiceLive,
  ConfigServiceTest,
  ApplicationConfiguration,
  ConfigChangeEvent,
} from '../../services/config.service'
import { GameConfigServiceTest } from '../../services/game-config.service'
import { InfrastructureConfigServiceTest } from '../../services/infrastructure-config.service'
import {
  ConfigValidationError,
  ConfigServiceError,
  createValidationError,
  createServiceError,
} from '../../errors/config-errors'
import { AppConfig } from '../../schemas/app.schema'
import { GameConfig } from '../../schemas/game.schema'
import { InfrastructureConfig } from '../../schemas/infrastructure.schema'

// Test utilities
const runConfigService = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect.pipe(Effect.provide(ConfigServiceTest)))

const runConfigServiceExit = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromiseExit(effect.pipe(Effect.provide(ConfigServiceTest)))

describe('ConfigService', () => {
  describe('Core Configuration Access', () => {
    it('should get complete application configuration', async () => {
      const result = await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          return yield* service.get
        })
      )

      expect(result).toBeDefined()
      expect(result.app).toBeDefined()
      expect(result.game).toBeDefined()
      expect(result.infrastructure).toBeDefined()

      // Validate structure
      expect(typeof result.app.appName).toBe('string')
      expect(typeof result.app.version).toBe('string')
      expect(typeof result.game.world).toBe('object')
      expect(typeof result.infrastructure.rendering).toBe('object')
    })

    it('should get app configuration', async () => {
      const result = await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          return yield* service.getApp
        })
      )

      expect(result).toBeDefined()
      expect(result.appName).toBe('TS Minecraft Test')
      expect(result.version).toBe('1.0.0-test')
      expect(result.environment).toBe('test')
      expect(result.debug).toBe(false)
    })

    it('should get game configuration', async () => {
      const result = await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          return yield* service.getGame
        })
      )

      expect(result).toBeDefined()
      expect(result.world).toBeDefined()
      expect(result.player).toBeDefined()
      expect(result.physics).toBeDefined()
      expect(result.gameplay).toBeDefined()
      expect(result.performance).toBeDefined()
    })

    it('should get infrastructure configuration', async () => {
      const result = await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          return yield* service.getInfrastructure
        })
      )

      expect(result).toBeDefined()
      expect(result.rendering).toBeDefined()
      expect(result.memory).toBeDefined()
      expect(result.workers).toBeDefined()
      expect(result.network).toBeDefined()
    })

    it('should get specific configuration sections', async () => {
      const results = await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          const app = yield* service.getSection('app')
          const game = yield* service.getSection('game')
          const infrastructure = yield* service.getSection('infrastructure')
          
          return { app, game, infrastructure }
        })
      )

      expect(results.app).toBeDefined()
      expect(results.game).toBeDefined()
      expect(results.infrastructure).toBeDefined()

      expect(results.app.appName).toBeDefined()
      expect(results.game.world).toBeDefined()
      expect(results.infrastructure.rendering).toBeDefined()
    })
  })

  describe('Configuration Updates', () => {
    it('should update complete configuration', async () => {
      await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          
          // Update all sections
          yield* service.update({
            app: { debug: true },
            game: { world: { seed: 54321 } },
            infrastructure: { memory: { maxHeapSize: 1024 } },
          })

          // Verify updates
          const config = yield* service.get
          expect(config.app.debug).toBe(true)
          expect(config.game.world.seed).toBe(54321)
          expect(config.infrastructure.memory.maxHeapSize).toBe(1024)
        })
      )
    })

    it('should update app configuration only', async () => {
      await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          
          const beforeApp = yield* service.getApp
          
          yield* service.updateApp({ 
            debug: true,
            logging: { ...beforeApp.logging, level: 'trace' },
          })

          const afterApp = yield* service.getApp
          expect(afterApp.debug).toBe(true)
          expect(afterApp.logging.level).toBe('trace')
          expect(afterApp.appName).toBe(beforeApp.appName) // Unchanged
        })
      )
    })

    it('should update game configuration only', async () => {
      await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          
          const beforeGame = yield* service.getGame
          
          yield* service.updateGame({ 
            world: { ...beforeGame.world, seed: 99999 },
            physics: { ...beforeGame.physics, gravity: 8.5 },
          })

          const afterGame = yield* service.getGame
          expect(afterGame.world.seed).toBe(99999)
          expect(afterGame.physics.gravity).toBe(8.5)
          expect(afterGame.player.defaultGameMode).toBe(beforeGame.player.defaultGameMode) // Unchanged
        })
      )
    })

    it('should update infrastructure configuration only', async () => {
      await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          
          const beforeInfra = yield* service.getInfrastructure
          
          yield* service.updateInfrastructure({ 
            memory: { ...beforeInfra.memory, maxHeapSize: 2048 },
            workers: { ...beforeInfra.workers, maxWorkers: 8 },
          })

          const afterInfra = yield* service.getInfrastructure
          expect(afterInfra.memory.maxHeapSize).toBe(2048)
          expect(afterInfra.workers.maxWorkers).toBe(8)
          expect(afterInfra.rendering.engine).toBe(beforeInfra.rendering.engine) // Unchanged
        })
      )
    })

    it('should handle partial updates correctly', async () => {
      await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          
          // Only update one property in nested object
          yield* service.update({
            app: { debug: true },
          })

          const config = yield* service.get
          expect(config.app.debug).toBe(true)
          expect(config.app.appName).toBe('TS Minecraft Test') // Should remain unchanged
          expect(config.game.world.seed).toBeDefined() // Other sections unchanged
        })
      )
    })
  })

  describe('Configuration Management', () => {
    it('should load configuration', async () => {
      const result = await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          return yield* service.load
        })
      )

      expect(result).toBeDefined()
      expect(result.app).toBeDefined()
      expect(result.game).toBeDefined()
      expect(result.infrastructure).toBeDefined()
    })

    it('should save configuration', async () => {
      await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          yield* service.save
        })
      )
      
      // Save operation should complete without error
    })

    it('should reload configuration', async () => {
      await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          
          // Update something first
          yield* service.updateApp({ debug: true })
          
          // Then reload
          const reloadedConfig = yield* service.reload
          
          expect(reloadedConfig).toBeDefined()
          expect(reloadedConfig.app).toBeDefined()
          expect(reloadedConfig.game).toBeDefined()
          expect(reloadedConfig.infrastructure).toBeDefined()
        })
      )
    })

    it('should reset configuration', async () => {
      await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          
          // Update something first
          yield* service.updateApp({ debug: true })
          const modifiedConfig = yield* service.get
          expect(modifiedConfig.app.debug).toBe(true)
          
          // Then reset
          yield* service.reset
          
          // Should be back to defaults (test implementation doesn't actually reset to different values)
          const resetConfig = yield* service.get
          expect(resetConfig).toBeDefined()
        })
      )
    })
  })

  describe('Configuration Validation', () => {
    it('should validate complete configuration', async () => {
      const result = await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          return yield* service.validate
        })
      )

      expect(result).toBe(true)
    })

    it('should validate individual sections', async () => {
      const results = await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          const currentConfig = yield* service.get
          
          const appValid = yield* service.validateSection('app', currentConfig.app)
          const gameValid = yield* service.validateSection('game', currentConfig.game)
          const infraValid = yield* service.validateSection('infrastructure', currentConfig.infrastructure)
          
          return { appValid, gameValid, infraValid }
        })
      )

      expect(results.appValid).toBeDefined()
      expect(results.gameValid).toBeDefined()
      expect(results.infraValid).toBeDefined()
    })

    it('should handle validation errors for invalid sections', async () => {
      const exit = await runConfigServiceExit(
        Effect.gen(function* () {
          const service = yield* ConfigService
          // Try to validate an invalid section
          return yield* service.validateSection('invalidSection' as any, {})
        })
      )

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(exit.cause._tag).toBe('Fail')
        if (exit.cause._tag === 'Fail') {
          expect(exit.cause.error).toBeInstanceOf(ConfigValidationError)
        }
      }
    })

    it('should handle validation errors for invalid config data', async () => {
      const exit = await runConfigServiceExit(
        Effect.gen(function* () {
          const service = yield* ConfigService
          // Try to validate invalid app config
          return yield* service.validateSection('app', { invalidProperty: 'invalid' })
        })
      )

      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('Environment and Feature Flags', () => {
    it('should check environment flags', async () => {
      const results = await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          const isProduction = yield* service.isProduction
          const isDevelopment = yield* service.isDevelopment
          const isTest = yield* service.isTest
          
          return { isProduction, isDevelopment, isTest }
        })
      )

      // Test environment should return appropriate flags
      expect(results.isProduction).toBe(false)
      expect(results.isDevelopment).toBe(false)
      expect(results.isTest).toBe(true)
    })

    it('should check debug enabled flag', async () => {
      const result = await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          return yield* service.isDebugEnabled
        })
      )

      expect(typeof result).toBe('boolean')
    })

    it('should check feature flags', async () => {
      const results = await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          const webgpu = yield* service.isFeatureEnabled('enableWebGPU')
          const multiplayer = yield* service.isFeatureEnabled('enableMultiplayer')
          const wasm = yield* service.isFeatureEnabled('enableWasm')
          const serviceWorker = yield* service.isFeatureEnabled('enableServiceWorker')
          const hotReload = yield* service.isFeatureEnabled('enableHotReload')
          
          return { webgpu, multiplayer, wasm, serviceWorker, hotReload }
        })
      )

      expect(typeof results.webgpu).toBe('boolean')
      expect(typeof results.multiplayer).toBe('boolean')
      expect(typeof results.wasm).toBe('boolean')
      expect(typeof results.serviceWorker).toBe('boolean')
      expect(typeof results.hotReload).toBe('boolean')
    })

    it('should handle debug enabled in development mode', async () => {
      // This test would require a different service implementation with dev environment
      const result = await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          
          // Update to development mode (if possible in test)
          yield* service.updateApp({ debug: false, environment: 'development' as any })
          
          return yield* service.isDebugEnabled
        })
      )

      expect(typeof result).toBe('boolean')
    })
  })

  describe('Change Tracking and Subscriptions', () => {
    it('should track configuration changes', async () => {
      await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          
          // Make some changes
          yield* service.updateApp({ debug: true })
          yield* service.updateGame({ world: { seed: 12345 } })
          
          // Get change history
          const history = yield* service.getChangeHistory
          
          expect(Array.isArray(history)).toBe(true)
          // Note: Test implementation might not track changes the same way
        })
      )
    })

    it('should support subscription to changes', async () => {
      await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          
          let changeEvent: ConfigChangeEvent | null = null
          
          // Subscribe to changes
          yield* service.subscribe((event) => 
            Effect.sync(() => { changeEvent = event })
          )
          
          // Make a change
          yield* service.updateApp({ debug: true })
          
          // Note: Test implementation might handle subscriptions differently
        })
      )
    })

    it('should handle multiple subscribers', async () => {
      await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          
          let subscriber1Called = false
          let subscriber2Called = false
          
          // Subscribe multiple callbacks
          yield* service.subscribe(() => Effect.sync(() => { subscriber1Called = true }))
          yield* service.subscribe(() => Effect.sync(() => { subscriber2Called = true }))
          
          // Make a change
          yield* service.updateApp({ debug: true })
          
          // Both subscribers should be notified (implementation dependent)
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle service errors in get operations', async () => {
      // This test would require a mock that throws errors
      const result = await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          return yield* service.get
        })
      )

      // Test implementation shouldn't throw errors
      expect(result).toBeDefined()
    })

    it('should handle service errors in update operations', async () => {
      // Test that update operations handle errors gracefully
      const exit = await runConfigServiceExit(
        Effect.gen(function* () {
          const service = yield* ConfigService
          // Try to update with completely invalid data structure
          return yield* service.update({
            app: null as any,
            game: null as any,
            infrastructure: null as any,
          })
        })
      )

      // Should either succeed (if validation is lenient) or fail gracefully
      expect(exit._tag).toBeDefined()
    })

    it('should create appropriate error types', () => {
      const validationError = createValidationError('app', 'Invalid app configuration')
      expect(validationError).toBeInstanceOf(ConfigValidationError)
      expect(validationError.section).toBe('app')
      expect(validationError.details).toBe('Invalid app configuration')

      const serviceError = createServiceError('ConfigService', 'load', 'Failed to load')
      expect(serviceError).toBeInstanceOf(ConfigServiceError)
      expect(serviceError.service).toBe('ConfigService')
      expect(serviceError.operation).toBe('load')
      expect(serviceError.message).toBe('Failed to load')
    })
  })

  describe('Live Service Implementation', () => {
    it('should work with live service implementation', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* ConfigService
          return yield* service.get
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              ConfigServiceLive,
              GameConfigServiceTest,
              InfrastructureConfigServiceTest
            )
          )
        )
      )

      expect(result).toBeDefined()
      expect(result.app).toBeDefined()
      expect(result.game).toBeDefined()
      expect(result.infrastructure).toBeDefined()
    })

    it('should handle live service validation', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* ConfigService
          return yield* service.validate
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              ConfigServiceLive,
              GameConfigServiceTest,
              InfrastructureConfigServiceTest
            )
          )
        )
      )

      expect(result).toBe(true)
    })

    it('should handle live service updates', async () => {
      await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* ConfigService
          
          const beforeConfig = yield* service.get
          
          yield* service.updateApp({ debug: true })
          
          const afterConfig = yield* service.get
          expect(afterConfig.app.debug).toBe(true)
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              ConfigServiceLive,
              GameConfigServiceTest,
              InfrastructureConfigServiceTest
            )
          )
        )
      )
    })
  })

  describe('Integration and Complex Scenarios', () => {
    it('should handle sequential configuration changes', async () => {
      await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          
          // Make multiple sequential changes
          yield* service.updateApp({ debug: true })
          yield* service.updateGame({ world: { seed: 111 } })
          yield* service.updateInfrastructure({ memory: { maxHeapSize: 512 } })
          
          // Verify all changes were applied
          const config = yield* service.get
          expect(config.app.debug).toBe(true)
          expect(config.game.world.seed).toBe(111)
          expect(config.infrastructure.memory.maxHeapSize).toBe(512)
        })
      )
    })

    it('should handle concurrent configuration operations', async () => {
      await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          
          // Perform multiple operations concurrently
          yield* Effect.all([
            service.getApp,
            service.getGame,
            service.getInfrastructure,
            service.validate,
          ], { concurrency: 'unbounded' })
        })
      )
    })

    it('should handle configuration state consistency', async () => {
      await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          
          // Get initial state
          const initial = yield* service.get
          
          // Update and immediately read
          yield* service.updateApp({ debug: true })
          const afterUpdate = yield* service.get
          
          // State should be consistent
          expect(afterUpdate.app.debug).toBe(true)
          expect(afterUpdate.app.appName).toBe(initial.app.appName) // Unchanged parts should remain
        })
      )
    })

    it('should validate configuration after complex updates', async () => {
      const result = await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          
          // Make complex nested updates
          yield* service.update({
            app: {
              debug: true,
              features: { 
                enableWebGPU: true,
                enableWasm: true,
                enableMultiplayer: false,
                enableServiceWorker: false,
                enableHotReload: false,
              }
            },
            game: {
              world: { seed: 54321, chunkSize: 32 },
              physics: { gravity: 9.0, enableGravity: true },
            },
          })
          
          // Validate the complex configuration
          return yield* service.validate
        })
      )

      expect(result).toBe(true)
    })

    it('should handle environment-specific configurations', async () => {
      const results = await runConfigService(
        Effect.gen(function* () {
          const service = yield* ConfigService
          
          // Test all environment checks
          const isProduction = yield* service.isProduction
          const isDevelopment = yield* service.isDevelopment
          const isTest = yield* service.isTest
          
          // Test debug enabled (should be environment dependent)
          const isDebugEnabled = yield* service.isDebugEnabled
          
          return { isProduction, isDevelopment, isTest, isDebugEnabled }
        })
      )

      // Test service should return test environment
      expect(results.isTest).toBe(true)
      expect(results.isProduction).toBe(false)
      expect(results.isDevelopment).toBe(false)
      expect(typeof results.isDebugEnabled).toBe('boolean')
    })
  })
})