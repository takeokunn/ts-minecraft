import { APP_CONFIG } from './app.config'
import { GAME_CONFIG, getUserGameConfig } from './game.config'
import { INFRASTRUCTURE_CONFIG, getOptimalInfrastructureConfig } from './infrastructure.config'

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

// Enhanced configuration validation using individual validators
export const validateConfiguration = (config: ApplicationConfiguration): boolean => {
  try {
    // Use schema-based validation for each section
    if (!config.app || !config.game || !config.infrastructure) {
      console.error('Missing required configuration sections')
      return false
    }

    // Validate app config with schema
    import('./app.config').then(({ safeValidateAppConfig }) => {
      if (!safeValidateAppConfig(config.app)) {
        throw new Error('App configuration validation failed')
      }
    })

    // Validate game config
    import('./game.config').then(({ validateGameConfig }) => {
      if (!validateGameConfig(config.game)) {
        throw new Error('Game configuration validation failed')
      }
    })

    return true
  } catch (error) {
    console.error('Configuration validation error:', error)
    return false
  }
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