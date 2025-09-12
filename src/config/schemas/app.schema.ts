import * as S from 'effect/Schema'
import { NonEmptyString } from './common.schema'

/**
 * AppConfig schemas for comprehensive application-wide configuration
 * Provides type-safe configuration management with validation
 */

// Logging Configuration Schema
export const LoggingConfigSchema = S.Struct({
  level: S.Literal('error', 'warn', 'info', 'debug', 'trace').pipe(
    S.annotations({
      title: 'Log Level',
      description: 'Logging level for application'
    })
  ),
  enableConsole: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Console Logging',
      description: 'Whether to enable console logging'
    })
  ),
  enableRemote: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Remote Logging',
      description: 'Whether to enable remote logging service'
    })
  ),
})

// Feature Flags Configuration Schema
export const FeatureFlagsSchema = S.Struct({
  enableMultiplayer: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Multiplayer',
      description: 'Whether multiplayer features are enabled'
    })
  ),
  enableWebGPU: S.Boolean.pipe(
    S.annotations({
      title: 'Enable WebGPU',
      description: 'Whether WebGPU rendering is enabled'
    })
  ),
  enableWasm: S.Boolean.pipe(
    S.annotations({
      title: 'Enable WebAssembly',
      description: 'Whether WebAssembly features are enabled'
    })
  ),
  enableServiceWorker: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Service Worker',
      description: 'Whether service worker is enabled for caching'
    })
  ),
  enableHotReload: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Hot Reload',
      description: 'Whether hot module reloading is enabled'
    })
  ),
})

// Storage Configuration Schema
export const StorageConfigSchema = S.Struct({
  enableLocalStorage: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Local Storage',
      description: 'Whether localStorage API is enabled'
    })
  ),
  enableIndexedDB: S.Boolean.pipe(
    S.annotations({
      title: 'Enable IndexedDB',
      description: 'Whether IndexedDB API is enabled'
    })
  ),
  maxCacheSize: S.Number.pipe(
    S.positive(),
    S.between(1, 10000),
    S.annotations({
      title: 'Max Cache Size',
      description: 'Maximum cache size in megabytes (1-10000)'
    })
  ),
})

// Security Configuration Schema
export const SecurityConfigSchema = S.Struct({
  enableCSP: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Content Security Policy',
      description: 'Whether CSP headers should be enforced'
    })
  ),
  allowedOrigins: S.Array(S.String).pipe(
    S.annotations({
      title: 'Allowed Origins',
      description: 'List of allowed origins for CORS'
    })
  ),
})

// Main App Configuration Schema
export const AppConfigSchema = S.Struct({
  appName: NonEmptyString.pipe(
    S.annotations({
      title: 'Application Name',
      description: 'Name of the application'
    })
  ),
  version: NonEmptyString.pipe(
    S.annotations({
      title: 'Application Version', 
      description: 'Version string of the application'
    })
  ),
  debug: S.Boolean.pipe(
    S.annotations({
      title: 'Debug Mode',
      description: 'Whether debug mode is enabled'
    })
  ),
  environment: S.Literal('development', 'production', 'test').pipe(
    S.annotations({
      title: 'Environment',
      description: 'Application runtime environment'
    })
  ),
  apiUrl: S.optional(NonEmptyString.pipe(
    S.annotations({
      title: 'API URL',
      description: 'Base URL for API calls'
    })
  )),
  logging: LoggingConfigSchema.pipe(
    S.annotations({
      title: 'Logging Configuration',
      description: 'Application logging settings'
    })
  ),
  features: FeatureFlagsSchema.pipe(
    S.annotations({
      title: 'Feature Flags',
      description: 'Feature toggles for application functionality'
    })
  ),
  storage: StorageConfigSchema.pipe(
    S.annotations({
      title: 'Storage Configuration',
      description: 'Storage and caching settings'
    })
  ),
  security: SecurityConfigSchema.pipe(
    S.annotations({
      title: 'Security Configuration',
      description: 'Security policies and restrictions'
    })
  ),
}).pipe(
  S.annotations({
    title: 'Application Configuration',
    description: 'Complete application configuration with all settings'
  })
)

// Export types
export type AppConfig = S.Schema.Type<typeof AppConfigSchema>
export type LoggingConfig = S.Schema.Type<typeof LoggingConfigSchema>
export type FeatureFlags = S.Schema.Type<typeof FeatureFlagsSchema>
export type StorageConfig = S.Schema.Type<typeof StorageConfigSchema>
export type SecurityConfig = S.Schema.Type<typeof SecurityConfigSchema>

// Default configurations
export const defaultLoggingConfig: LoggingConfig = {
  level: 'info',
  enableConsole: true,
  enableRemote: false,
}

export const defaultFeatureFlags: FeatureFlags = {
  enableMultiplayer: false,
  enableWebGPU: true,
  enableWasm: true,
  enableServiceWorker: false,
  enableHotReload: false,
}

export const defaultStorageConfig: StorageConfig = {
  enableLocalStorage: true,
  enableIndexedDB: true,
  maxCacheSize: 500,
}

export const defaultSecurityConfig: SecurityConfig = {
  enableCSP: false,
  allowedOrigins: ['*'],
}

export const defaultAppConfig: AppConfig = {
  appName: 'TS Minecraft',
  version: '1.0.0',
  debug: false,
  environment: 'development',
  logging: defaultLoggingConfig,
  features: defaultFeatureFlags,
  storage: defaultStorageConfig,
  security: defaultSecurityConfig,
}