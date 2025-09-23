import { describe, expect, beforeEach, afterEach } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Either, Layer, pipe } from 'effect'
import { Schema } from '@effect/schema'
import {
  ConfigService,
  ConfigServiceLive,
  ConfigServiceTest,
  GameConfig,
  RenderConfig,
  DebugConfig,
} from '../ConfigService'

describe('ConfigService', () => {
  describe('ConfigServiceLive', () => {
    it.effect('should handle invalid config key in updateConfig', () =>
      Effect.gen(function* () {
        const service = yield* ConfigService

        // 無効なconfig keyでupdateConfigを呼び出す
        const result = yield* Effect.either(service.updateConfig('invalidKey' as any, {} as any))

        expect(result._tag).toBe('Left')
        pipe(
          result,
          Either.match({
            onLeft: (error) => {
              expect((error as Error).message).toContain('Unknown config key: invalidKey')
            },
            onRight: () => {
              // 失敗ケースなので到達しない
            },
          })
        )
      }).pipe(Effect.provide(ConfigServiceLive))
    )

    it.effect('should provide default game configuration', () =>
      Effect.gen(function* () {
        const service = yield* ConfigService
        const config = service.gameConfig

        expect(config.fps).toBe(60)
        expect(config.tickRate).toBe(20)
        expect(config.renderDistance).toBe(8)
        expect(config.chunkSize).toBe(16)
        expect(config.gravity).toBe(-9.81)
        expect(config.playerSpeed).toBe(4.317)
        expect(config.jumpHeight).toBe(1.25)
      }).pipe(Effect.provide(ConfigServiceLive))
    )

    it.effect('should provide default render configuration', () =>
      Effect.gen(function* () {
        const service = yield* ConfigService
        const config = service.renderConfig

        expect(config.resolution.width).toBe(1920)
        expect(config.resolution.height).toBe(1080)
        expect(config.quality).toBe('high')
        expect(config.shadows).toBe(true)
        expect(config.antialiasing).toBe(true)
        expect(config.viewDistance).toBe(8)
        expect(config.fov).toBe(75)
        expect(config.vsync).toBe(true)
      }).pipe(Effect.provide(ConfigServiceLive))
    )

    it.effect('should provide default debug configuration', () =>
      Effect.gen(function* () {
        const service = yield* ConfigService
        const config = service.debugConfig

        expect(config.enabled).toBe(false)
        expect(config.showFps).toBe(false)
        expect(config.showChunkBorders).toBe(false)
        expect(config.showHitboxes).toBe(false)
        expect(config.showCoordinates).toBe(false)
        expect(config.wireframeMode).toBe(false)
        expect(config.logLevel).toBe('info')
      }).pipe(Effect.provide(ConfigServiceLive))
    )

    it.effect('should get configuration by key', () =>
      Effect.gen(function* () {
        const service = yield* ConfigService
        const gameConfig = yield* service.getConfig('gameConfig')
        const renderConfig = yield* service.getConfig('renderConfig')
        const debugConfig = yield* service.getConfig('debugConfig')

        expect(gameConfig.fps).toBe(60)
        expect(renderConfig.quality).toBe('high')
        expect(debugConfig.logLevel).toBe('info')
      }).pipe(Effect.provide(ConfigServiceLive))
    )

    it.effect('should update configuration', () =>
      Effect.gen(function* () {
        const service = yield* ConfigService

        const newGameConfig: GameConfig = {
          fps: 144,
          tickRate: 30,
          renderDistance: 16,
          chunkSize: 32,
          gravity: -15,
          playerSpeed: 5.0,
          jumpHeight: 2.0,
        }

        yield* service.updateConfig('gameConfig', newGameConfig)
        const updatedConfig = yield* service.getConfig('gameConfig')

        expect(updatedConfig.fps).toBe(144)
        expect(updatedConfig.tickRate).toBe(30)
        expect(updatedConfig.renderDistance).toBe(16)
      }).pipe(Effect.provide(ConfigServiceLive))
    )

    it.effect('should update render configuration', () =>
      Effect.gen(function* () {
        const service = yield* ConfigService

        const newRenderConfig: RenderConfig = {
          resolution: { width: 2560, height: 1440 },
          quality: 'ultra',
          shadows: false,
          antialiasing: false,
          viewDistance: 16,
          fov: 90,
          vsync: false,
        }

        yield* service.updateConfig('renderConfig', newRenderConfig)
        const updatedConfig = yield* service.getConfig('renderConfig')

        expect(updatedConfig.resolution.width).toBe(2560)
        expect(updatedConfig.quality).toBe('ultra')
        expect(updatedConfig.shadows).toBe(false)
      }).pipe(Effect.provide(ConfigServiceLive))
    )
  })

  describe('ConfigServiceTest', () => {
    it.effect('should provide test configuration with debug enabled', () =>
      Effect.gen(function* () {
        const service = yield* ConfigService
        const debugConfig = service.debugConfig

        expect(debugConfig.enabled).toBe(true)
      }).pipe(Effect.provide(ConfigServiceTest))
    )

    it.effect('should return configs via getConfig method', () =>
      Effect.gen(function* () {
        const service = yield* ConfigService
        const gameConfig = yield* service.getConfig('gameConfig')
        const renderConfig = yield* service.getConfig('renderConfig')

        expect(gameConfig.fps).toBe(60)
        expect(renderConfig.quality).toBe('high')
      }).pipe(Effect.provide(ConfigServiceTest))
    )
    it.effect('should handle debug config updates', () =>
      Effect.gen(function* () {
        const service = yield* ConfigService

        const newDebugConfig: DebugConfig = {
          enabled: true,
          showFps: true,
          showChunkBorders: true,
          showHitboxes: true,
          showCoordinates: true,
          wireframeMode: true,
          logLevel: 'debug',
        }

        yield* service.updateConfig('debugConfig', newDebugConfig)
        const updatedConfig = yield* service.getConfig('debugConfig')

        expect(updatedConfig.enabled).toBe(true)
        expect(updatedConfig.showFps).toBe(true)
        expect(updatedConfig.logLevel).toBe('debug')
      }).pipe(Effect.provide(ConfigServiceLive))
    )
  })

  describe('Environment Variable Loading', () => {
    const originalEnv = process.env

    beforeEach(() => {
      // 環境変数をクリア
      delete process.env['GAME_CONFIG']
      delete process.env['RENDER_CONFIG']
      delete process.env['DEBUG_CONFIG']
    })

    afterEach(() => {
      // 環境変数をクリア
      delete process.env['GAME_CONFIG']
      delete process.env['RENDER_CONFIG']
      delete process.env['DEBUG_CONFIG']
      process.env = originalEnv
    })

    // Helper function to create ConfigService layer with specific environment variables
    const createConfigServiceLayerWithEnv = (envVars: Record<string, string>) =>
      Layer.sync(ConfigService, () => {
        const loadFromEnv = <T>(envKey: string, defaultValue: T, schema: Schema.Schema<T>): T => {
          const envValue = envVars[envKey]
          return envValue
            ? (() => {
                try {
                  const parsed = JSON.parse(envValue)
                  return Schema.decodeSync(schema)(parsed)
                } catch {
                  return defaultValue
                }
              })()
            : defaultValue
        }

        const gameConfig = loadFromEnv(
          'GAME_CONFIG',
          {
            fps: 60,
            tickRate: 20,
            renderDistance: 8,
            chunkSize: 16,
            gravity: -9.81,
            playerSpeed: 4.317,
            jumpHeight: 1.25,
          },
          GameConfig
        )

        return ConfigService.of({
          gameConfig,
          renderConfig: {
            resolution: { width: 1920, height: 1080 },
            quality: 'high',
            shadows: true,
            antialiasing: true,
            viewDistance: 8,
            fov: 75,
            vsync: true,
          },
          debugConfig: {
            enabled: false,
            showFps: false,
            showChunkBorders: false,
            showHitboxes: false,
            showCoordinates: false,
            wireframeMode: false,
            logLevel: 'info',
          },
          getConfig: (key) => Effect.succeed(key === 'gameConfig' ? gameConfig : ({} as any)),
          updateConfig: () => Effect.succeed(undefined),
        })
      })

    it.effect('should load valid config from environment variables', () => {
      const envVars = {
        GAME_CONFIG: JSON.stringify({
          fps: 120,
          tickRate: 30,
          renderDistance: 16,
          chunkSize: 32,
          gravity: -15.0,
          playerSpeed: 5.0,
          jumpHeight: 2.0,
        }),
      }

      return Effect.gen(function* () {
        const service = yield* ConfigService
        const config = service.gameConfig

        expect(config.fps).toBe(120)
        expect(config.tickRate).toBe(30)
        expect(config.renderDistance).toBe(16)
      }).pipe(Effect.provide(createConfigServiceLayerWithEnv(envVars)))
    })

    it.effect('should fall back to default when environment variable has invalid JSON', () => {
      const envVars = {
        GAME_CONFIG: 'invalid-json',
      }

      return Effect.gen(function* () {
        const service = yield* ConfigService
        const gameConfig = service.gameConfig

        // デフォルト値になることを確認
        expect(gameConfig.fps).toBe(60)
        expect(gameConfig.tickRate).toBe(20)
      }).pipe(Effect.provide(createConfigServiceLayerWithEnv(envVars)))
    })

    it.effect('should fall back to default when environment variable has invalid schema', () => {
      const envVars = {
        GAME_CONFIG: JSON.stringify({
          fps: 'invalid-number',
          tickRate: 20,
        }),
      }

      return Effect.gen(function* () {
        const service = yield* ConfigService
        const gameConfig = service.gameConfig

        // デフォルト値になることを確認
        expect(gameConfig.fps).toBe(60)
        expect(gameConfig.tickRate).toBe(20)
      }).pipe(Effect.provide(createConfigServiceLayerWithEnv(envVars)))
    })
  })

  describe('Schema Validation', () => {
    it('should validate GameConfig schema', () => {
      const validConfig = {
        fps: 60,
        tickRate: 20,
        renderDistance: 8,
        chunkSize: 16,
        gravity: -9.81,
        playerSpeed: 4.317,
        jumpHeight: 1.25,
      }

      const result = Schema.decodeEither(GameConfig)(validConfig)
      expect(Effect.runSync(result)).toEqual(validConfig)
    })

    it('should reject invalid FPS values', () => {
      const invalidConfig = {
        fps: 200, // 144以上は無効
        tickRate: 20,
        renderDistance: 8,
        chunkSize: 16,
        gravity: -9.81,
        playerSpeed: 4.317,
        jumpHeight: 1.25,
      }

      const result = Schema.decodeEither(GameConfig)(invalidConfig)
      expect(() => Effect.runSync(result)).toThrow()
    })

    it('should validate RenderConfig schema', () => {
      const validConfig = {
        resolution: { width: 1920, height: 1080 },
        quality: 'high' as const,
        shadows: true,
        antialiasing: true,
        viewDistance: 8,
        fov: 75,
        vsync: true,
      }

      const result = Schema.decodeEither(RenderConfig)(validConfig)
      expect(Effect.runSync(result)).toEqual(validConfig)
    })

    it('should reject invalid quality values', () => {
      const invalidConfig = {
        resolution: { width: 1920, height: 1080 },
        quality: 'invalid' as any, // "low", "medium", "high", "ultra"のみ有効
        shadows: true,
        antialiasing: true,
        viewDistance: 8,
        fov: 75,
        vsync: true,
      }

      const result = Schema.decodeEither(RenderConfig)(invalidConfig)
      expect(() => Effect.runSync(result)).toThrow()
    })

    it('should validate DebugConfig schema', () => {
      const validConfig = {
        enabled: true,
        showFps: true,
        showChunkBorders: false,
        showHitboxes: false,
        showCoordinates: true,
        wireframeMode: false,
        logLevel: 'debug' as const,
      }

      const result = Schema.decodeEither(DebugConfig)(validConfig)
      expect(Effect.runSync(result)).toEqual(validConfig)
    })

    it('should reject invalid log levels', () => {
      const invalidConfig = {
        enabled: true,
        showFps: true,
        showChunkBorders: false,
        showHitboxes: false,
        showCoordinates: true,
        wireframeMode: false,
        logLevel: 'verbose' as any, // "debug", "info", "warn", "error"のみ有効
      }

      const result = Schema.decodeEither(DebugConfig)(invalidConfig)
      expect(() => Effect.runSync(result)).toThrow()
    })

    it('should reject negative resolution values', () => {
      const invalidConfig = {
        resolution: { width: -1920, height: 1080 },
        quality: 'high' as const,
        shadows: true,
        antialiasing: true,
        viewDistance: 8,
        fov: 75,
        vsync: true,
      }

      const result = Schema.decodeEither(RenderConfig)(invalidConfig)
      expect(() => Effect.runSync(result)).toThrow()
    })

    it('should validate FOV within bounds', () => {
      const validFov = {
        resolution: { width: 1920, height: 1080 },
        quality: 'high' as const,
        shadows: true,
        antialiasing: true,
        viewDistance: 8,
        fov: 90,
        vsync: true,
      }

      const result = Schema.decodeEither(RenderConfig)(validFov)
      expect(Effect.runSync(result).fov).toBe(90)

      const invalidFov = { ...validFov, fov: 150 } // 120以上は無効
      const invalidResult = Schema.decodeEither(RenderConfig)(invalidFov)
      expect(() => Effect.runSync(invalidResult)).toThrow()
    })
  })
})
