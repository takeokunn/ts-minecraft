/**
 * Application-wide configuration
 */

import * as S from 'effect/Schema'
import {
  AppConfigSchema,
  AppConfig,
  defaultAppConfig,
  LoggingConfigSchema,
  FeatureFlagsSchema,
  StorageConfigSchema,
  SecurityConfigSchema,
} from './schemas/app.schema'

const developmentConfig: AppConfig = {
  ...defaultAppConfig,
  environment: 'development',
  debug: true,
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
  ...defaultAppConfig,
  environment: 'production',
  debug: false,
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
  ...defaultAppConfig,
  environment: 'test',
  debug: false,
  logging: {
    level: 'error',
    enableConsole: false,
    enableRemote: false,
  },
  features: {
    ...defaultAppConfig.features,
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

// Re-export for backward compatibility
export { 
  AppConfigSchema,
  LoggingConfigSchema,
  FeatureFlagsSchema,
  StorageConfigSchema,
  SecurityConfigSchema,
}

// Type exports for backward compatibility  
export type { AppConfig, LoggingConfig, FeatureFlags, StorageConfig, SecurityConfig } from './schemas/app.schema'

