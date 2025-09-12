import { Effect, Layer, Context, Ref, pipe } from 'effect'
import * as S from 'effect/Schema'
import { AppConfig, AppConfigSchema } from '../schemas/app.schema'
import { GameConfig, GameConfigSchema } from '../schemas/game.schema'
import { InfrastructureConfig, InfrastructureConfigSchema } from '../schemas/infrastructure.schema'
import { GameConfigService, GameConfigServiceLive } from './game-config.service'
import { InfrastructureConfigService, InfrastructureConfigServiceLive } from './infrastructure-config.service'
import {
  ConfigValidationError,
  ConfigLoadError,
  ConfigSaveError,
  ConfigServiceError,
  createValidationError,
  createLoadError,
  createSaveError,
  createServiceError,
} from '../errors/config-errors'

/**
 * Unified Configuration Service
 * Provides centralized access to all configuration sections with Effect-TS patterns
 */

// Complete application configuration type
export interface ApplicationConfiguration {
  app: AppConfig
  game: GameConfig
  infrastructure: InfrastructureConfig
}

// Configuration change event
export interface ConfigChangeEvent {
  section: keyof ApplicationConfiguration
  previous: unknown
  current: unknown
  timestamp: number
}

// Configuration service interface
export class ConfigService extends Context.Tag('ConfigService')<
  ConfigService,
  {
    // Core configuration access
    readonly get: Effect.Effect<ApplicationConfiguration, ConfigServiceError>
    readonly getApp: Effect.Effect<AppConfig, ConfigServiceError>
    readonly getGame: Effect.Effect<GameConfig, ConfigServiceError>
    readonly getInfrastructure: Effect.Effect<InfrastructureConfig, ConfigServiceError>
    
    // Section-specific getters
    readonly getSection: <K extends keyof ApplicationConfiguration>(
      section: K
    ) => Effect.Effect<ApplicationConfiguration[K], ConfigServiceError>
    
    // Configuration updates
    readonly update: (
      config: Partial<ApplicationConfiguration>
    ) => Effect.Effect<void, ConfigServiceError>
    readonly updateApp: (config: Partial<AppConfig>) => Effect.Effect<void, ConfigServiceError>
    readonly updateGame: (config: Partial<GameConfig>) => Effect.Effect<void, ConfigServiceError>
    readonly updateInfrastructure: (
      config: Partial<InfrastructureConfig>
    ) => Effect.Effect<void, ConfigServiceError>
    
    // Configuration management
    readonly load: Effect.Effect<ApplicationConfiguration, ConfigServiceError>
    readonly save: Effect.Effect<void, ConfigServiceError>
    readonly reload: Effect.Effect<ApplicationConfiguration, ConfigServiceError>
    readonly reset: Effect.Effect<void, ConfigServiceError>
    
    // Validation
    readonly validate: Effect.Effect<boolean, ConfigValidationError>
    readonly validateSection: <K extends keyof ApplicationConfiguration>(
      section: K,
      config: unknown
    ) => Effect.Effect<ApplicationConfiguration[K], ConfigValidationError>
    
    // Environment and feature flags
    readonly isProduction: Effect.Effect<boolean>
    readonly isDevelopment: Effect.Effect<boolean>
    readonly isTest: Effect.Effect<boolean>
    readonly isDebugEnabled: Effect.Effect<boolean>
    readonly isFeatureEnabled: (
      feature: keyof AppConfig['features']
    ) => Effect.Effect<boolean>
    
    // Change tracking
    readonly subscribe: (
      callback: (event: ConfigChangeEvent) => Effect.Effect<void>
    ) => Effect.Effect<void>
    readonly getChangeHistory: Effect.Effect<ConfigChangeEvent[]>
  }
>() {}

// Schema for the complete configuration
const ApplicationConfigurationSchema = S.Struct({
  app: AppConfigSchema,
  game: GameConfigSchema,
  infrastructure: InfrastructureConfigSchema,
})

// Configuration service implementation
export const ConfigServiceLive = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    const gameConfigService = yield* GameConfigService
    const infrastructureConfigService = yield* InfrastructureConfigService
    
    // Initialize configuration reference
    const configRef = yield* Effect.gen(function* () {
      const appConfig = yield* Effect.succeed({
        appName: 'TS Minecraft',
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
          enableWebGPU: true,
          enableWasm: true,
          enableServiceWorker: false,
          enableHotReload: false,
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
      } as AppConfig)

      const gameConfig = yield* gameConfigService.get
      const infrastructureConfig = yield* infrastructureConfigService.get

      const initialConfig: ApplicationConfiguration = {
        app: appConfig,
        game: gameConfig,
        infrastructure: infrastructureConfig,
      }

      return yield* Ref.make(initialConfig)
    })

    // Change tracking
    const changeHistoryRef = yield* Ref.make<ConfigChangeEvent[]>([])
    const subscribersRef = yield* Ref.make<Array<(event: ConfigChangeEvent) => Effect.Effect<void>>>([])

    // Helper to notify subscribers of changes
    const notifyChange = (event: ConfigChangeEvent) =>
      Effect.gen(function* () {
        // Add to history
        yield* Ref.update(changeHistoryRef, (history) => [...history.slice(-99), event]) // Keep last 100 events

        // Notify subscribers
        const subscribers = yield* Ref.get(subscribersRef)
        yield* Effect.forEach(subscribers, (callback) => callback(event), { concurrency: 'unbounded' })
      })

    // Update configuration ref and notify changes
    const updateConfigRef = <K extends keyof ApplicationConfiguration>(
      section: K,
      previous: ApplicationConfiguration[K],
      current: ApplicationConfiguration[K]
    ) =>
      Effect.gen(function* () {
        yield* Ref.update(configRef, (config) => ({
          ...config,
          [section]: current,
        }))

        yield* notifyChange({
          section,
          previous,
          current,
          timestamp: Date.now(),
        })
      })

    const validateSection = <K extends keyof ApplicationConfiguration>(
      section: K,
      config: unknown
    ): Effect.Effect<ApplicationConfiguration[K], ConfigValidationError> => {
      switch (section) {
        case 'app':
          return pipe(
            S.decodeUnknown(AppConfigSchema)(config),
            Effect.mapError((error) =>
              createValidationError('app', `App configuration validation failed: ${error}`, error)
            )
          ) as Effect.Effect<ApplicationConfiguration[K], ConfigValidationError>

        case 'game':
          return gameConfigService.validate(config).pipe(
            Effect.mapError((error) =>
              createValidationError('game', `Game configuration validation failed: ${error}`, error)
            )
          ) as Effect.Effect<ApplicationConfiguration[K], ConfigValidationError>

        case 'infrastructure':
          return infrastructureConfigService.validate(config).pipe(
            Effect.mapError((error) =>
              createValidationError(
                'infrastructure',
                `Infrastructure configuration validation failed: ${error}`,
                error
              )
            )
          ) as Effect.Effect<ApplicationConfiguration[K], ConfigValidationError>

        default:
          return Effect.fail(
            createValidationError('unknown', `Unknown configuration section: ${section}`)
          )
      }
    }

    return ConfigService.of({
      // Core configuration access
      get: Ref.get(configRef).pipe(
        Effect.mapError((error) =>
          createServiceError('ConfigService', 'load', `Failed to get configuration: ${error}`, error)
        )
      ),

      getApp: Effect.gen(function* () {
        const config = yield* Ref.get(configRef)
        return config.app
      }).pipe(
        Effect.mapError((error) =>
          createServiceError('ConfigService', 'load', `Failed to get app configuration: ${error}`, error)
        )
      ),

      getGame: Effect.gen(function* () {
        const config = yield* Ref.get(configRef)
        return config.game
      }).pipe(
        Effect.mapError((error) =>
          createServiceError('ConfigService', 'load', `Failed to get game configuration: ${error}`, error)
        )
      ),

      getInfrastructure: Effect.gen(function* () {
        const config = yield* Ref.get(configRef)
        return config.infrastructure
      }).pipe(
        Effect.mapError((error) =>
          createServiceError('ConfigService', 'load', `Failed to get infrastructure configuration: ${error}`, error)
        )
      ),

      getSection: <K extends keyof ApplicationConfiguration>(section: K) =>
        Effect.gen(function* () {
          const config = yield* Ref.get(configRef)
          return config[section]
        }).pipe(
          Effect.mapError((error) =>
            createServiceError('ConfigService', 'load', `Failed to get ${section} configuration: ${error}`, error)
          )
        ),

      // Configuration updates
      update: (partial: Partial<ApplicationConfiguration>) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(configRef)
          
          if (partial.app) {
            yield* updateConfigRef('app', current.app, { ...current.app, ...partial.app })
          }
          
          if (partial.game) {
            const updatedGame = { ...current.game, ...partial.game }
            yield* gameConfigService.update(partial.game)
            yield* updateConfigRef('game', current.game, updatedGame)
          }
          
          if (partial.infrastructure) {
            const updatedInfra = { ...current.infrastructure, ...partial.infrastructure }
            yield* infrastructureConfigService.update(partial.infrastructure)
            yield* updateConfigRef('infrastructure', current.infrastructure, updatedInfra)
          }
        }).pipe(
          Effect.mapError((error) =>
            createServiceError('ConfigService', 'update', `Failed to update configuration: ${error}`, error)
          )
        ),

      updateApp: (partial: Partial<AppConfig>) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(configRef)
          const updated = { ...current.app, ...partial }
          yield* updateConfigRef('app', current.app, updated)
        }).pipe(
          Effect.mapError((error) =>
            createServiceError('ConfigService', 'update', `Failed to update app configuration: ${error}`, error)
          )
        ),

      updateGame: (partial: Partial<GameConfig>) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(configRef)
          yield* gameConfigService.update(partial)
          const updated = yield* gameConfigService.get
          yield* updateConfigRef('game', current.game, updated)
        }).pipe(
          Effect.mapError((error) =>
            createServiceError('ConfigService', 'update', `Failed to update game configuration: ${error}`, error)
          )
        ),

      updateInfrastructure: (partial: Partial<InfrastructureConfig>) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(configRef)
          yield* infrastructureConfigService.update(partial)
          const updated = yield* infrastructureConfigService.get
          yield* updateConfigRef('infrastructure', current.infrastructure, updated)
        }).pipe(
          Effect.mapError((error) =>
            createServiceError('ConfigService', 'update', `Failed to update infrastructure configuration: ${error}`, error)
          )
        ),

      // Configuration management
      load: Effect.gen(function* () {
        // Load all configurations fresh
        const gameConfig = yield* gameConfigService.load
        const infrastructureConfig = yield* infrastructureConfigService.load
        
        // Get current app config (assuming it doesn't change often)
        const current = yield* Ref.get(configRef)
        
        const loadedConfig: ApplicationConfiguration = {
          app: current.app,
          game: gameConfig,
          infrastructure: infrastructureConfig,
        }

        yield* Ref.set(configRef, loadedConfig)
        return loadedConfig
      }).pipe(
        Effect.mapError((error) =>
          createServiceError('ConfigService', 'load', `Failed to load configuration: ${error}`, error)
        )
      ),

      save: Effect.gen(function* () {
        const config = yield* Ref.get(configRef)
        
        // Save individual configurations
        yield* gameConfigService.save(config.game)
        // Note: App config and Infrastructure config typically don't need saving
        // as they're derived from environment and capabilities
      }).pipe(
        Effect.mapError((error) =>
          createServiceError('ConfigService', 'save', `Failed to save configuration: ${error}`, error)
        )
      ),

      reload: Effect.gen(function* () {
        // Reload all configurations
        const gameConfig = yield* gameConfigService.reload
        const infrastructureConfig = yield* infrastructureConfigService.reload
        
        const current = yield* Ref.get(configRef)
        const reloadedConfig: ApplicationConfiguration = {
          app: current.app,
          game: gameConfig,
          infrastructure: infrastructureConfig,
        }

        yield* Ref.set(configRef, reloadedConfig)
        return reloadedConfig
      }).pipe(
        Effect.mapError((error) =>
          createServiceError('ConfigService', 'load', `Failed to reload configuration: ${error}`, error)
        )
      ),

      reset: Effect.gen(function* () {
        yield* gameConfigService.reset
        yield* infrastructureConfigService.reset
        
        // Reload after reset
        const gameConfig = yield* gameConfigService.get
        const infrastructureConfig = yield* infrastructureConfigService.get
        const current = yield* Ref.get(configRef)

        const resetConfig: ApplicationConfiguration = {
          app: current.app,
          game: gameConfig,
          infrastructure: infrastructureConfig,
        }

        yield* Ref.set(configRef, resetConfig)
      }).pipe(
        Effect.mapError((error) =>
          createServiceError('ConfigService', 'update', `Failed to reset configuration: ${error}`, error)
        )
      ),

      // Validation
      validate: Effect.gen(function* () {
        const config = yield* Ref.get(configRef)
        
        // Validate each section
        yield* validateSection('app', config.app)
        yield* validateSection('game', config.game)
        yield* validateSection('infrastructure', config.infrastructure)
        
        return true
      }),

      validateSection,

      // Environment and feature flags
      isProduction: Effect.gen(function* () {
        const config = yield* Ref.get(configRef)
        return config.app.environment === 'production'
      }),

      isDevelopment: Effect.gen(function* () {
        const config = yield* Ref.get(configRef)
        return config.app.environment === 'development'
      }),

      isTest: Effect.gen(function* () {
        const config = yield* Ref.get(configRef)
        return config.app.environment === 'test'
      }),

      isDebugEnabled: Effect.gen(function* () {
        const config = yield* Ref.get(configRef)
        const isDev = config.app.environment === 'development'
        return config.app.debug || isDev
      }),

      isFeatureEnabled: (feature: keyof AppConfig['features']) =>
        Effect.gen(function* () {
          const config = yield* Ref.get(configRef)
          return config.app.features[feature]
        }),

      // Change tracking
      subscribe: (callback: (event: ConfigChangeEvent) => Effect.Effect<void>) =>
        Effect.gen(function* () {
          yield* Ref.update(subscribersRef, (subscribers) => [...subscribers, callback])
        }),

      getChangeHistory: Ref.get(changeHistoryRef),
    })
  })
).pipe(
  Layer.provide(GameConfigServiceLive),
  Layer.provide(InfrastructureConfigServiceLive)
)

// Test implementation
export const ConfigServiceTest = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    const testConfig: ApplicationConfiguration = {
      app: {
        appName: 'TS Minecraft Test',
        version: '1.0.0-test',
        debug: false,
        environment: 'test',
        logging: {
          level: 'error',
          enableConsole: false,
          enableRemote: false,
        },
        features: {
          enableMultiplayer: false,
          enableWebGPU: false,
          enableWasm: true,
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
          allowedOrigins: ['*'],
        },
      },
      game: {
        world: {
          seed: 12345,
          chunkSize: 16,
          renderDistance: 2,
          maxLoadedChunks: 25,
          worldHeight: 128,
          seaLevel: 64,
          generateCaves: false,
          generateOres: true,
          generateStructures: false,
        },
        player: {
          defaultGameMode: 'creative',
          spawnPosition: { x: 0, y: 70, z: 0 },
          allowFlying: true,
          movementSpeed: 4.0,
          jumpForce: 0.4,
          maxHealth: 20,
          maxHunger: 20,
        },
        physics: {
          gravity: 9.8,
          friction: 0.98,
          airResistance: 0.02,
          waterResistance: 0.8,
          enableCollision: true,
          enableGravity: true,
        },
        gameplay: {
          difficulty: 'peaceful',
          enableDayNightCycle: false,
          dayLength: 600000,
          enableWeather: false,
          enableMobs: false,
          enableHunger: false,
          keepInventory: true,
        },
        performance: {
          targetFPS: 30,
          vSync: false,
          lodEnabled: false,
          frustumCulling: true,
          occlusionCulling: false,
          shadowsEnabled: false,
          particlesEnabled: false,
          maxParticles: 100,
        },
        graphics: {
          renderDistance: 2,
          fieldOfView: 60,
          brightness: 1.0,
          contrast: 1.0,
          saturation: 1.0,
          antiAliasing: false,
          textureFiltering: 'nearest',
          mipmapping: false,
        },
        audio: {
          masterVolume: 0,
          soundVolume: 0,
          musicVolume: 0,
          ambientVolume: 0,
          enableSpatialAudio: false,
        },
        controls: {
          mouseSensitivity: 1.0,
          invertMouseY: false,
          keyBindings: {
            forward: 'KeyW',
            backward: 'KeyS',
            left: 'KeyA',
            right: 'KeyD',
            jump: 'Space',
            sneak: 'ShiftLeft',
            sprint: 'ControlLeft',
            inventory: 'KeyE',
            chat: 'KeyT',
            debug: 'F3',
          },
        },
      },
      infrastructure: {
        rendering: {
          engine: 'three',
          preferWebGPU: false,
          canvas: {
            antialias: false,
            alpha: false,
            powerPreference: 'default',
            preserveDrawingBuffer: false,
          },
          webgl: {
            contextAttributes: {
              antialias: false,
              alpha: false,
              depth: true,
              stencil: false,
              preserveDrawingBuffer: false,
            },
          },
          webgpu: {
            preferredFormat: 'bgra8unorm',
            powerPreference: 'low-power',
          },
        },
        memory: {
          maxHeapSize: 256,
          gcThreshold: 0.9,
          objectPoolSize: 1000,
          texturePoolSize: 10,
          geometryPoolSize: 50,
        },
        workers: {
          maxWorkers: 0,
          useWorkers: false,
          workerScripts: {
            terrain: '/workers/terrain-generation.worker.js',
            physics: '/workers/physics.worker.js',
            compute: '/workers/computation.worker.js',
          },
          timeout: 1000,
        },
        network: {
          enableMultiplayer: false,
          websocket: {
            reconnectAttempts: 1,
            reconnectInterval: 1000,
            timeout: 1000,
          },
          http: {
            timeout: 1000,
            retries: 1,
            retryDelay: 100,
          },
        },
        storage: {
          provider: 'localStorage',
          compression: false,
          encryption: false,
          maxSize: 10,
          cacheTTL: 60000,
        },
        monitoring: {
          enabled: false,
          sampleRate: 0,
          maxSamples: 10,
          enableGPUTiming: false,
          enableMemoryProfiling: false,
          enableNetworkProfiling: false,
        },
        development: {
          enableDebugger: false,
          enableProfiler: false,
          enableHotReload: false,
          enableSourceMaps: false,
          logLevel: 'error',
        },
        assets: {
          baseUrl: '/test-assets',
          textureAtlasSize: 256,
          compressionFormat: 'none',
          loadingStrategy: 'eager',
          cacheStrategy: 'memory',
        },
        audio: {
          context: 'web-audio',
          sampleRate: 22050,
          bufferSize: 1024,
          maxSources: 8,
          enableCompression: false,
          spatialAudio: {
            enabled: false,
            algorithm: 'panner',
            distanceModel: 'linear',
          },
        },
        security: {
          contentSecurityPolicy: false,
          crossOriginIsolation: false,
          sharedArrayBuffer: false,
          trustedTypes: false,
        },
      },
    }

    const configRef = yield* Ref.make(testConfig)
    const changeHistoryRef = yield* Ref.make<ConfigChangeEvent[]>([])
    const subscribersRef = yield* Ref.make<Array<(event: ConfigChangeEvent) => Effect.Effect<void>>>([])

    return ConfigService.of({
      get: Ref.get(configRef),
      getApp: pipe(Ref.get(configRef), Effect.map((config) => config.app)),
      getGame: pipe(Ref.get(configRef), Effect.map((config) => config.game)),
      getInfrastructure: pipe(Ref.get(configRef), Effect.map((config) => config.infrastructure)),
      getSection: <K extends keyof ApplicationConfiguration>(section: K) =>
        pipe(Ref.get(configRef), Effect.map((config) => config[section])),
      
      update: (partial: Partial<ApplicationConfiguration>) =>
        Ref.update(configRef, (current) => ({ ...current, ...partial })),
      
      updateApp: (partial: Partial<AppConfig>) =>
        Ref.update(configRef, (current) => ({
          ...current,
          app: { ...current.app, ...partial },
        })),
        
      updateGame: (partial: Partial<GameConfig>) =>
        Ref.update(configRef, (current) => ({
          ...current,
          game: { ...current.game, ...partial },
        })),
        
      updateInfrastructure: (partial: Partial<InfrastructureConfig>) =>
        Ref.update(configRef, (current) => ({
          ...current,
          infrastructure: { ...current.infrastructure, ...partial },
        })),

      load: Ref.get(configRef),
      save: Effect.void,
      reload: Ref.get(configRef),
      reset: Ref.set(configRef, testConfig),

      validate: Effect.succeed(true),
      validateSection: <K extends keyof ApplicationConfiguration>(section: K, config: unknown) =>
        Effect.succeed(config as ApplicationConfiguration[K]),

      isProduction: Effect.succeed(false),
      isDevelopment: Effect.succeed(false),
      isTest: Effect.succeed(true),
      isDebugEnabled: Effect.succeed(false),
      isFeatureEnabled: (feature: keyof AppConfig['features']) =>
        pipe(Ref.get(configRef), Effect.map((config) => config.app.features[feature])),

      subscribe: (callback: (event: ConfigChangeEvent) => Effect.Effect<void>) =>
        Ref.update(subscribersRef, (subscribers) => [...subscribers, callback]),
      
      getChangeHistory: Ref.get(changeHistoryRef),
    })
  })
)