import { Effect, Layer, pipe } from 'effect'
import { ConfigService, ConfigServiceLive } from './services/config.service'
import { AppConfigService } from './services/app-config.service' 
import { GameConfigService } from './services/game-config.service'
import { InfrastructureConfigService } from './services/infrastructure-config.service'
import type { AppConfig } from './schemas/app.schema'
import type { GameConfig } from './schemas/game.schema'
import type { InfrastructureConfig } from './schemas/infrastructure.schema'

/**
 * Configuration utilities using Effect-TS services
 */

// Re-export configuration types
export type { AppConfig, GameConfig, InfrastructureConfig }

// Re-export errors from the centralized location
export { 
  ConfigValidationError,
  ConfigLoadError,
  ConfigSaveError,
  ConfigParseError,
  ConfigEnvironmentError,
  ConfigServiceError,
  ConfigMigrationError,
  ConfigPermissionError,
  ConfigNetworkError,
  ConfigError
} from './errors/config-errors'

// Main configuration access
export const getAppConfig = (): Effect.Effect<AppConfig, never, ConfigService> =>
  Effect.gen(function* () {
    const service = yield* ConfigService
    return yield* service.getApp()
  })

export const getGameConfig = (): Effect.Effect<GameConfig, never, ConfigService> =>
  Effect.gen(function* () {
    const service = yield* ConfigService
    return yield* service.getGame()
  })

export const getInfrastructureConfig = (): Effect.Effect<InfrastructureConfig, never, ConfigService> =>
  Effect.gen(function* () {
    const service = yield* ConfigService
    return yield* service.getInfrastructure()
  })

// Configuration operations
export const reloadConfiguration = (): Effect.Effect<void, never, ConfigService> =>
  Effect.gen(function* () {
    const service = yield* ConfigService
    return yield* service.reload()
  })

export const validateConfiguration = (): Effect.Effect<boolean, never, ConfigService> =>
  Effect.gen(function* () {
    const service = yield* ConfigService
    return yield* service.validate()
  })

// Environment helpers
export const getEnvironment = (): Effect.Effect<'development' | 'production' | 'test', never, ConfigService> =>
  pipe(
    getAppConfig(),
    Effect.map(config => config.environment)
  )

export const isProduction = (): Effect.Effect<boolean, never, ConfigService> =>
  pipe(
    getEnvironment(),
    Effect.map(env => env === 'production')
  )

export const isDevelopment = (): Effect.Effect<boolean, never, ConfigService> =>
  pipe(
    getEnvironment(),
    Effect.map(env => env === 'development')
  )

export const isTest = (): Effect.Effect<boolean, never, ConfigService> =>
  pipe(
    getEnvironment(),
    Effect.map(env => env === 'test')
  )

// Feature flag helpers
export const isFeatureEnabled = (feature: string): Effect.Effect<boolean, never, ConfigService> =>
  Effect.gen(function* () {
    const service = yield* ConfigService
    return yield* service.isFeatureEnabled(feature)
  })

// Debug mode helper
export const isDebugEnabled = (): Effect.Effect<boolean, never, ConfigService> =>
  pipe(
    Effect.all({
      appConfig: getAppConfig(),
      isDev: isDevelopment()
    }),
    Effect.map(({ appConfig, isDev }) => appConfig.debug || isDev)
  )

// Default configuration provider
export const ConfigLive = ConfigServiceLive

// Convenience function to run configuration operations
export const runWithConfig = <A, E>(
  effect: Effect.Effect<A, E, ConfigService>
): Effect.Effect<A, E> =>
  Effect.provide(effect, ConfigLive)

// Export service constructors for advanced usage
export { ConfigService, ConfigServiceLive }
export { AppConfigService } from './services/app-config.service'
export { GameConfigService } from './services/game-config.service'  
export { InfrastructureConfigService } from './services/infrastructure-config.service'
export { CapabilityDetectionService } from './services/capability-detection.service'