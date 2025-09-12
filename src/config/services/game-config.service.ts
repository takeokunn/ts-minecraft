import { Effect, Layer, Context, Ref, pipe } from 'effect'
import * as S from 'effect/Schema'
import {
  GameConfigSchema,
  GameConfig,
  defaultGameConfig,
} from '../schemas/game.schema'

/**
 * GameConfig service using Effect-TS patterns
 * Provides type-safe configuration management with validation and persistence
 */

// Storage interface for abstracting localStorage/indexedDB
export class StorageService extends Context.Tag('StorageService')<
  StorageService,
  {
    readonly get: (key: string) => Effect.Effect<unknown, Error>
    readonly set: (key: string, value: unknown) => Effect.Effect<void, Error>
    readonly remove: (key: string) => Effect.Effect<void, Error>
    readonly clear: Effect.Effect<void, Error>
  }
>() {}

// Environment interface for accessing import.meta.env
export class EnvironmentService extends Context.Tag('EnvironmentService')<
  EnvironmentService,
  {
    readonly getMode: Effect.Effect<string>
    readonly isDevelopment: Effect.Effect<boolean>
    readonly isProduction: Effect.Effect<boolean>
    readonly isTest: Effect.Effect<boolean>
  }
>() {}

// Game configuration error types
export class GameConfigError extends S.TaggedError<GameConfigError>()(
  'GameConfigError',
  {
    reason: S.Literal('validation', 'storage', 'parsing', 'environment'),
    message: S.String,
    cause: S.optional(S.Unknown),
  }
) {}

// GameConfig service interface
export class GameConfigService extends Context.Tag('GameConfigService')<
  GameConfigService,
  {
    readonly get: Effect.Effect<GameConfig, GameConfigError>
    readonly getSection: <K extends keyof GameConfig>(
      section: K
    ) => Effect.Effect<GameConfig[K], GameConfigError>
    readonly update: (config: Partial<GameConfig>) => Effect.Effect<void, GameConfigError>
    readonly updateSection: <K extends keyof GameConfig>(
      section: K,
      update: Partial<GameConfig[K]>
    ) => Effect.Effect<void, GameConfigError>
    readonly load: Effect.Effect<GameConfig, GameConfigError>
    readonly save: (config: GameConfig) => Effect.Effect<void, GameConfigError>
    readonly reset: Effect.Effect<void, GameConfigError>
    readonly validate: (config: unknown) => Effect.Effect<GameConfig, GameConfigError>
    readonly reload: Effect.Effect<GameConfig, GameConfigError>
    readonly loadUserPreferences: Effect.Effect<Partial<GameConfig>, GameConfigError>
    readonly saveUserPreferences: (
      config: Partial<GameConfig>
    ) => Effect.Effect<void, GameConfigError>
  }
>() {}

// Storage service implementation for localStorage
export const StorageServiceLive = Layer.succeed(
  StorageService,
  StorageService.of({
    get: (key: string) =>
      Effect.tryPromise({
        try: async () => {
          const item = localStorage.getItem(key)
          return item ? JSON.parse(item) : null
        },
        catch: (error) => new Error(`Failed to get item from storage: ${error}`),
      }),

    set: (key: string, value: unknown) =>
      Effect.tryPromise({
        try: async () => {
          localStorage.setItem(key, JSON.stringify(value))
        },
        catch: (error) => new Error(`Failed to set item in storage: ${error}`),
      }),

    remove: (key: string) =>
      Effect.tryPromise({
        try: async () => {
          localStorage.removeItem(key)
        },
        catch: (error) => new Error(`Failed to remove item from storage: ${error}`),
      }),

    clear: Effect.tryPromise({
      try: async () => {
        localStorage.clear()
      },
      catch: (error) => new Error(`Failed to clear storage: ${error}`),
    }),
  })
)

// Environment service implementation
export const EnvironmentServiceLive = Layer.succeed(
  EnvironmentService,
  EnvironmentService.of({
    getMode: Effect.sync(() => 
      typeof import.meta !== 'undefined' && import.meta.env?.MODE || 'development'
    ),
    
    isDevelopment: Effect.sync(() => {
      const mode = typeof import.meta !== 'undefined' && import.meta.env?.MODE || 'development'
      return mode === 'development'
    }),
    
    isProduction: Effect.sync(() => {
      const mode = typeof import.meta !== 'undefined' && import.meta.env?.MODE || 'development'
      return mode === 'production'
    }),
    
    isTest: Effect.sync(() => {
      const mode = typeof import.meta !== 'undefined' && import.meta.env?.MODE || 'development'
      return mode === 'test'
    }),
  })
)

// Helper to create environment-specific config
const createEnvironmentConfig = (mode: string): GameConfig => {
  const config = { ...defaultGameConfig }

  switch (mode) {
    case 'development':
      return {
        ...config,
        gameplay: {
          ...config.gameplay,
          enableMobs: false,
        },
        performance: {
          ...config.performance,
          targetFPS: 120,
        },
        graphics: {
          ...config.graphics,
          renderDistance: 4,
        },
      }

    case 'production':
      return {
        ...config,
        performance: {
          ...config.performance,
          lodEnabled: true,
          frustumCulling: true,
        },
        graphics: {
          ...config.graphics,
          renderDistance: 6,
        },
      }

    case 'test':
      return {
        ...config,
        world: {
          ...config.world,
          seed: 12345, // Fixed seed for tests
        },
        gameplay: {
          ...config.gameplay,
          enableMobs: false,
          enableWeather: false,
        },
        performance: {
          ...config.performance,
          targetFPS: 30,
          shadowsEnabled: false,
          particlesEnabled: false,
        },
        graphics: {
          ...config.graphics,
          renderDistance: 2,
          antiAliasing: false,
        },
        audio: {
          ...config.audio,
          masterVolume: 0,
          soundVolume: 0,
          musicVolume: 0,
          ambientVolume: 0,
        },
      }

    default:
      return config
  }
}

// Deep merge utility for partial config updates
const deepMerge = <T extends Record<string, any>>(target: T, source: Partial<T>): T => {
  const result = { ...target }
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]!)
    } else if (source[key] !== undefined) {
      result[key] = source[key]!
    }
  }
  
  return result
}

// GameConfig service implementation
export const GameConfigServiceLive = Layer.effect(
  GameConfigService,
  Effect.gen(function* () {
    const storage = yield* StorageService
    const environment = yield* EnvironmentService
    
    // Initialize with environment-specific config
    const mode = yield* environment.getMode
    const initialConfig = createEnvironmentConfig(mode)
    const configRef = yield* Ref.make(initialConfig)

    const validate = (config: unknown) =>
      pipe(
        S.decodeUnknown(GameConfigSchema)(config),
        Effect.mapError(
          (error) =>
            new GameConfigError({
              reason: 'validation',
              message: `GameConfig validation failed: ${error}`,
              cause: error,
            })
        )
      )

    const loadUserPreferences = () =>
      pipe(
        storage.get('ts-minecraft-game-config'),
        Effect.map((data) => data || {}),
        Effect.catch(() => Effect.succeed({})),
        Effect.mapError(
          (error) =>
            new GameConfigError({
              reason: 'storage',
              message: `Failed to load user preferences: ${error.message}`,
              cause: error,
            })
        )
      ) as Effect.Effect<Partial<GameConfig>, GameConfigError>

    const saveUserPreferences = (config: Partial<GameConfig>) =>
      pipe(
        storage.set('ts-minecraft-game-config', config),
        Effect.mapError(
          (error) =>
            new GameConfigError({
              reason: 'storage',
              message: `Failed to save user preferences: ${error.message}`,
              cause: error,
            })
        )
      )

    const load = () =>
      Effect.gen(function* () {
        const mode = yield* environment.getMode
        const baseConfig = createEnvironmentConfig(mode)
        const userPreferences = yield* loadUserPreferences()
        
        // Deep merge user preferences with base config
        const mergedConfig = deepMerge(baseConfig, userPreferences)
        
        // Validate the merged configuration
        const validatedConfig = yield* validate(mergedConfig)
        
        // Update the ref with the loaded config
        yield* Ref.set(configRef, validatedConfig)
        
        return validatedConfig
      })

    const save = (config: GameConfig) =>
      pipe(
        validate(config),
        Effect.flatMap(() => saveUserPreferences(config)),
        Effect.flatMap(() => Ref.set(configRef, config))
      )

    return GameConfigService.of({
      get: Ref.get(configRef),

      getSection: <K extends keyof GameConfig>(section: K) =>
        pipe(
          Ref.get(configRef),
          Effect.map((config) => config[section])
        ),

      update: (partial: Partial<GameConfig>) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(configRef)
          const updated = deepMerge(current, partial)
          const validated = yield* validate(updated)
          
          yield* Ref.set(configRef, validated)
          yield* saveUserPreferences(partial)
        }),

      updateSection: <K extends keyof GameConfig>(
        section: K,
        update: Partial<GameConfig[K]>
      ) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(configRef)
          const updatedSection = deepMerge(current[section], update)
          const updatedConfig = { ...current, [section]: updatedSection }
          const validated = yield* validate(updatedConfig)
          
          yield* Ref.set(configRef, validated)
          yield* saveUserPreferences({ [section]: update } as Partial<GameConfig>)
        }),

      load,

      save,

      reset: Effect.gen(function* () {
        const mode = yield* environment.getMode
        const defaultConfig = createEnvironmentConfig(mode)
        
        yield* Ref.set(configRef, defaultConfig)
        yield* storage.remove('ts-minecraft-game-config')
      }),

      validate,

      reload: load,

      loadUserPreferences,

      saveUserPreferences,
    })
  })
).pipe(
  Layer.provide(StorageServiceLive),
  Layer.provide(EnvironmentServiceLive)
)

// Test service implementation with mock storage
export const GameConfigServiceTest = Layer.effect(
  GameConfigService,
  Effect.gen(function* () {
    const mockStorage = yield* Ref.make<Record<string, unknown>>({})
    const configRef = yield* Ref.make(defaultGameConfig)

    const mockStorageService = StorageService.of({
      get: (key: string) =>
        pipe(
          Ref.get(mockStorage),
          Effect.map((storage) => storage[key] || null)
        ),

      set: (key: string, value: unknown) =>
        pipe(
          Ref.update(mockStorage, (storage) => ({ ...storage, [key]: value })),
          Effect.asVoid
        ),

      remove: (key: string) =>
        pipe(
          Ref.update(mockStorage, (storage) => {
            const newStorage = { ...storage }
            delete newStorage[key]
            return newStorage
          }),
          Effect.asVoid
        ),

      clear: pipe(Ref.set(mockStorage, {}), Effect.asVoid),
    })

    const mockEnvironmentService = EnvironmentService.of({
      getMode: Effect.succeed('test'),
      isDevelopment: Effect.succeed(false),
      isProduction: Effect.succeed(false),
      isTest: Effect.succeed(true),
    })

    // Re-use the same implementation logic but with mock services
    const validate = (config: unknown) =>
      pipe(
        S.decodeUnknown(GameConfigSchema)(config),
        Effect.mapError(
          (error) =>
            new GameConfigError({
              reason: 'validation',
              message: `GameConfig validation failed: ${error}`,
              cause: error,
            })
        )
      )

    return GameConfigService.of({
      get: Ref.get(configRef),

      getSection: <K extends keyof GameConfig>(section: K) =>
        pipe(
          Ref.get(configRef),
          Effect.map((config) => config[section])
        ),

      update: (partial: Partial<GameConfig>) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(configRef)
          const updated = deepMerge(current, partial)
          const validated = yield* validate(updated)
          
          yield* Ref.set(configRef, validated)
          yield* mockStorageService.set('ts-minecraft-game-config', partial)
        }),

      updateSection: <K extends keyof GameConfig>(
        section: K,
        update: Partial<GameConfig[K]>
      ) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(configRef)
          const updatedSection = deepMerge(current[section], update)
          const updatedConfig = { ...current, [section]: updatedSection }
          const validated = yield* validate(updatedConfig)
          
          yield* Ref.set(configRef, validated)
        }),

      load: Effect.gen(function* () {
        const testConfig = createEnvironmentConfig('test')
        yield* Ref.set(configRef, testConfig)
        return testConfig
      }),

      save: (config: GameConfig) =>
        pipe(
          validate(config),
          Effect.flatMap(() => Ref.set(configRef, config))
        ),

      reset: Effect.gen(function* () {
        const testConfig = createEnvironmentConfig('test')
        yield* Ref.set(configRef, testConfig)
        yield* mockStorageService.clear
      }),

      validate,

      reload: Effect.gen(function* () {
        const testConfig = createEnvironmentConfig('test')
        yield* Ref.set(configRef, testConfig)
        return testConfig
      }),

      loadUserPreferences: pipe(
        mockStorageService.get('ts-minecraft-game-config'),
        Effect.map((data) => data || {}),
        Effect.catch(() => Effect.succeed({}))
      ) as Effect.Effect<Partial<GameConfig>, GameConfigError>,

      saveUserPreferences: (config: Partial<GameConfig>) =>
        pipe(
          mockStorageService.set('ts-minecraft-game-config', config),
          Effect.mapError(
            () =>
              new GameConfigError({
                reason: 'storage',
                message: 'Failed to save user preferences in test mode',
              })
          )
        ),
    })
  })
)