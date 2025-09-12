import { Effect, pipe, Option, Schema as S } from 'effect'
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
export const createConfiguration = (): ApplicationConfiguration => ({
  app: APP_CONFIG,
  game: getUserGameConfig(),
  infrastructure: getOptimalInfrastructureConfig(),
})

// Export the main configuration instance
export const CONFIG = createConfiguration()

// Configuration utilities with validation
export const reloadConfiguration = (): ApplicationConfiguration => {
  const newConfig = createConfiguration()

  // Validate the new configuration before applying
  if (!validateConfiguration(newConfig)) {
    console.error('Failed to reload configuration - validation failed')
    return CONFIG // Return existing config on failure
  }

  Object.assign(CONFIG, newConfig)
  return CONFIG
}

// Type-safe configuration accessor
export const getConfig = <K extends keyof ApplicationConfiguration>(section: K): ApplicationConfiguration[K] => CONFIG[section]

// Environment-specific configuration flags
export const isProduction = () => CONFIG.app.environment === 'production'
export const isDevelopment = () => CONFIG.app.environment === 'development'
export const isTest = () => CONFIG.app.environment === 'test'

// Debug configuration helper
export const isDebugEnabled = () => CONFIG.app.debug || isDevelopment()

// Feature flag helpers
export const isFeatureEnabled = (feature: keyof typeof CONFIG.app.features): boolean => CONFIG.app.features[feature]

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

// Initialize configuration validation
if (!validateConfiguration(CONFIG)) {
  throw new Error('Configuration validation failed')
}

// Development-only configuration logging
if (isDevelopment()) {
  console.group('🔧 Configuration Loaded')
  console.log('App Config:', CONFIG.app)
  console.log('Game Config:', CONFIG.game)
  console.log('Infrastructure Config:', CONFIG.infrastructure)
  console.groupEnd()
}
