/**
 * Configuration management for the application
 */

export * from './app.config'
export * from './game.config'
export * from './infrastructure.config'

import { APP_CONFIG } from './app.config'
import { GAME_CONFIG, getUserGameConfig } from './game.config'
import { INFRASTRUCTURE_CONFIG, getOptimalInfrastructureConfig } from './infrastructure.config'

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

// Configuration utilities
export const reloadConfiguration = (): ApplicationConfiguration => {
  const newConfig = createConfiguration()
  Object.assign(CONFIG, newConfig)
  return CONFIG
}

// Type-safe configuration accessor
export const getConfig = <K extends keyof ApplicationConfiguration>(
  section: K
): ApplicationConfiguration[K] => CONFIG[section]

// Environment-specific configuration flags
export const isProduction = () => CONFIG.app.environment === 'production'
export const isDevelopment = () => CONFIG.app.environment === 'development'
export const isTest = () => CONFIG.app.environment === 'test'

// Debug configuration helper
export const isDebugEnabled = () => CONFIG.app.debug || isDevelopment()

// Feature flag helpers
export const isFeatureEnabled = (feature: keyof typeof CONFIG.app.features): boolean =>
  CONFIG.app.features[feature]

// Configuration validation
export const validateConfiguration = (config: ApplicationConfiguration): boolean => {
  if (!config.app || !config.game || !config.infrastructure) {
    console.error('Missing configuration sections')
    return false
  }
  
  // Basic validation
  if (!config.app.appName) {
    console.error('App name is required')
    return false
  }
  
  if (config.game.world.chunkSize <= 0) {
    console.error('Invalid chunk size')
    return false
  }
  
  if (config.infrastructure.memory.maxHeapSize <= 0) {
    console.error('Invalid max heap size')
    return false
  }
  
  return true
}

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