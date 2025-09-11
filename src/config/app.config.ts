/**
 * Application-wide configuration
 */

export interface AppConfig {
  // General application settings
  appName: string
  version: string
  debug: boolean

  // Environment settings
  environment: 'development' | 'production' | 'test'
  apiUrl?: string

  // Logging configuration
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug'
    enableConsole: boolean
    enableRemote: boolean
  }

  // Feature flags
  features: {
    enableMultiplayer: boolean
    enableWebGPU: boolean
    enableWasm: boolean
    enableServiceWorker: boolean
    enableHotReload: boolean
  }

  // Storage settings
  storage: {
    enableLocalStorage: boolean
    enableIndexedDB: boolean
    maxCacheSize: number // in MB
  }

  // Security settings
  security: {
    enableCSP: boolean
    allowedOrigins: string[]
  }
}

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

// Configuration validation
export const validateAppConfig = (config: AppConfig): boolean => {
  if (!config.appName || !config.version) {
    console.error('App name and version are required')
    return false
  }

  if (!['development', 'production', 'test'].includes(config.environment)) {
    console.error('Invalid environment specified')
    return false
  }

  if (config.storage.maxCacheSize <= 0) {
    console.error('Max cache size must be positive')
    return false
  }

  return true
}

// Validate configuration on load
if (!validateAppConfig(APP_CONFIG)) {
  throw new Error('Invalid application configuration')
}
