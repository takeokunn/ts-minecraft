/**
 * Application-wide configuration
 */

import * as S from 'effect/Schema'
import type { Schema } from 'effect/Schema'

// Schema definitions for type safety and validation
export const LoggingConfigSchema = S.Struct({
  level: S.Literal('error', 'warn', 'info', 'debug'),
  enableConsole: S.Boolean,
  enableRemote: S.Boolean,
})

export const FeatureFlagsSchema = S.Struct({
  enableMultiplayer: S.Boolean,
  enableWebGPU: S.Boolean,
  enableWasm: S.Boolean,
  enableServiceWorker: S.Boolean,
  enableHotReload: S.Boolean,
})

export const StorageConfigSchema = S.Struct({
  enableLocalStorage: S.Boolean,
  enableIndexedDB: S.Boolean,
  maxCacheSize: S.Number.pipe(S.positive()), // Must be positive
})

export const SecurityConfigSchema = S.Struct({
  enableCSP: S.Boolean,
  allowedOrigins: S.Array(S.String),
})

export const AppConfigSchema = S.Struct({
  appName: S.String.pipe(S.nonEmpty()),
  version: S.String.pipe(S.nonEmpty()),
  debug: S.Boolean,
  environment: S.Literal('development', 'production', 'test'),
  apiUrl: S.optional(S.String),
  logging: LoggingConfigSchema,
  features: FeatureFlagsSchema,
  storage: StorageConfigSchema,
  security: SecurityConfigSchema,
})

export type AppConfig = S.Schema.Type<typeof AppConfigSchema>

const developmentConfig: AppConfig = {
  appName: 'TS Minecraft',
  version: '1.0.0',
  debug: true,
  environment: 'development',

  logging: {
    level: 'debug',
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
    maxCacheSize: 500, // 500MB for development
  },

  security: {
    enableCSP: false,
    allowedOrigins: ['*'],
  },
}

const productionConfig: AppConfig = {
  appName: 'TS Minecraft',
  version: '1.0.0',
  debug: false,
  environment: 'production',

  logging: {
    level: 'warn',
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
    maxCacheSize: 200, // 200MB for production
  },

  security: {
    enableCSP: true,
    allowedOrigins: ['https://your-domain.com'],
  },
}

const testConfig: AppConfig = {
  ...developmentConfig,
  environment: 'test',
  debug: false,

  logging: {
    level: 'error',
    enableConsole: false,
    enableRemote: false,
  },

  features: {
    ...developmentConfig.features,
    enableHotReload: false,
  },
}

// Select configuration based on environment
const getConfig = (): AppConfig => {
  const env = import.meta.env.MODE || 'development'

  switch (env) {
    case 'production':
      return productionConfig
    case 'test':
      return testConfig
    default:
      return developmentConfig
  }
}

export const APP_CONFIG = getConfig()

// Schema-based configuration validation
export const validateAppConfig = S.decodeUnknownSync(AppConfigSchema)

// Type-safe configuration validation with detailed error messages
export const safeValidateAppConfig = (config: unknown): config is AppConfig => {
  try {
    validateAppConfig(config)
    return true
  } catch (error) {
    console.error('Configuration validation failed:', error)
    return false
  }
}

// Validate configuration on load with schema validation
if (!safeValidateAppConfig(APP_CONFIG)) {
  throw new Error('Invalid application configuration - see console for details')
}
