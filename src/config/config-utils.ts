import { Effect, pipe, Option, Schema as S, Ref } from 'effect'
import { APP_CONFIG } from '@config/app.config'
import { GAME_CONFIG, getUserGameConfig } from '@config/game.config'
import { INFRASTRUCTURE_CONFIG, getOptimalInfrastructureConfig } from '@config/infrastructure.config'

// Configuration errors
export class ConfigValidationError extends S.TaggedError<ConfigValidationError>()('ConfigValidationError', {
  section: S.String,
  details: S.String,
}) {}

/**
 * Configuration management utilities
 */

// Combined configuration object
export interface ApplicationConfiguration {
  app: typeof APP_CONFIG
  game: ReturnType<typeof getUserGameConfig>
  infrastructure: ReturnType<typeof getOptimalInfrastructureConfig>
}

// Main configuration factory
export const createConfiguration = (): Effect.Effect<ApplicationConfiguration, ConfigValidationError, never> =>
  Effect.gen(function* () {
    const config: ApplicationConfiguration = {
      app: APP_CONFIG,
      game: getUserGameConfig(),
      infrastructure: getOptimalInfrastructureConfig(),
    }
    
    yield* validateConfiguration(config)
    return config
  })

// Configuration reference for state management
export const createConfigRef = (): Effect.Effect<Ref.Ref<ApplicationConfiguration>, ConfigValidationError, never> =>
  Effect.gen(function* () {
    const initialConfig = yield* createConfiguration()
    return yield* Ref.make(initialConfig)
  })

// Configuration utilities with validation
export const reloadConfiguration = (configRef: Ref.Ref<ApplicationConfiguration>): Effect.Effect<ApplicationConfiguration, ConfigValidationError, never> =>
  Effect.gen(function* () {
    const newConfig = yield* createConfiguration()
    yield* Ref.set(configRef, newConfig)
    return newConfig
  })

// Type-safe configuration accessor
export const getConfig = <K extends keyof ApplicationConfiguration>(
  configRef: Ref.Ref<ApplicationConfiguration>,
  section: K
): Effect.Effect<ApplicationConfiguration[K], never, never> =>
  Effect.gen(function* () {
    const config = yield* Ref.get(configRef)
    return config[section]
  })

// Environment-specific configuration flags
export const isProduction = (configRef: Ref.Ref<ApplicationConfiguration>): Effect.Effect<boolean, never, never> =>
  Effect.gen(function* () {
    const config = yield* Ref.get(configRef)
    return config.app.environment === 'production'
  })

export const isDevelopment = (configRef: Ref.Ref<ApplicationConfiguration>): Effect.Effect<boolean, never, never> =>
  Effect.gen(function* () {
    const config = yield* Ref.get(configRef)
    return config.app.environment === 'development'
  })

export const isTest = (configRef: Ref.Ref<ApplicationConfiguration>): Effect.Effect<boolean, never, never> =>
  Effect.gen(function* () {
    const config = yield* Ref.get(configRef)
    return config.app.environment === 'test'
  })

// Debug configuration helper
export const isDebugEnabled = (configRef: Ref.Ref<ApplicationConfiguration>): Effect.Effect<boolean, never, never> =>
  Effect.gen(function* () {
    const config = yield* Ref.get(configRef)
    const isDev = yield* isDevelopment(configRef)
    return config.app.debug || isDev
  })

// Feature flag helpers
export const isFeatureEnabled = (
  configRef: Ref.Ref<ApplicationConfiguration>,
  feature: keyof typeof APP_CONFIG.features
): Effect.Effect<boolean, never, never> =>
  Effect.gen(function* () {
    const config = yield* Ref.get(configRef)
    return config.app.features[feature]
  })

// Enhanced configuration validation using Effect patterns
export const validateConfiguration = (config: ApplicationConfiguration): Effect.Effect<boolean, ConfigValidationError> =>
  Effect.gen(function* () {
    // Use Option for null checking
    const appConfig = Option.fromNullable(config.app)
    const gameConfig = Option.fromNullable(config.game)
    const infraConfig = Option.fromNullable(config.infrastructure)

    if (Option.isNone(appConfig) || Option.isNone(gameConfig) || Option.isNone(infraConfig)) {
      return yield* Effect.fail(
        new ConfigValidationError({
          section: 'all',
          details: 'Missing required configuration sections',
        }),
      )
    }

    // Validate app config with Effect.tryPromise
    yield* Effect.tryPromise({
      try: async () => {
        const { safeValidateAppConfig } = await import('./app.config')
        if (!safeValidateAppConfig(config.app)) {
          throw new Error('App configuration validation failed')
        }
      },
      catch: (error) =>
        new ConfigValidationError({
          section: 'app',
          details: String(error),
        }),
    })

    // Validate game config with Effect.tryPromise
    yield* Effect.tryPromise({
      try: async () => {
        const { validateGameConfig } = await import('./game.config')
        if (!validateGameConfig(config.game)) {
          throw new Error('Game configuration validation failed')
        }
      },
      catch: (error) =>
        new ConfigValidationError({
          section: 'game',
          details: String(error),
        }),
    })

    return true
  })

// Initialize configuration validation with proper Effect handling
export const initializeConfiguration = (): Effect.Effect<Ref.Ref<ApplicationConfiguration>, ConfigValidationError, never> =>
  Effect.gen(function* () {
    const configRef = yield* createConfigRef()
    
    // Log configuration in development mode
    const isDev = yield* isDevelopment(configRef)
    
    if (isDev) {
      const config = yield* Ref.get(configRef)
      yield* Effect.log("Configuration Loaded")
      yield* Effect.log(`App Config: ${JSON.stringify(config.app, null, 2)}`)
      yield* Effect.log(`Game Config: ${JSON.stringify(config.game, null, 2)}`)
      yield* Effect.log(`Infrastructure Config: ${JSON.stringify(config.infrastructure, null, 2)}`)
    }
    
    return configRef
  })
