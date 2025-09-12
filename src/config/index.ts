// Export clean Effect-TS based configuration utilities
export * from './config-utils'

// Export schemas and services 
export * from './schemas/app.schema'
export * from './schemas/game.schema'
export * from './schemas/infrastructure.schema'

export * from './services/config.service'
export * from './services/app-config.service'
export * from './services/game-config.service'
export * from './services/infrastructure-config.service'
export * from './services/capability-detection.service'

export * from './errors/config-errors'

// Backward compatibility exports (constants only)
export { APP_CONFIG } from './app-config'
export { GAME_CONFIG } from './game-config'
export { INFRASTRUCTURE_CONFIG } from './infrastructure-config'

// Type exports for backward compatibility
export type { 
  AppConfig, 
  LoggingConfig, 
  FeatureFlags, 
  StorageConfig, 
  SecurityConfig 
} from './schemas/app.schema'
export type { 
  GameConfig,
  WorldConfig,
  PlayerConfig,
  PhysicsConfig,
  GameplayConfig,
  PerformanceConfig,
  GraphicsConfig,
  AudioConfig,
  ControlsConfig
} from './schemas/game.schema'
export type { 
  InfrastructureConfig,
  RenderingConfig,
  MemoryConfig,
  WorkerConfig,
  NetworkConfig,
  MonitoringConfig,
  DevelopmentConfig,
  AssetConfig,
  AudioConfig as InfrastructureAudioConfig,
  SecurityConfig as InfrastructureSecurityConfig
} from './schemas/infrastructure.schema'
export type { Capabilities } from './services/capability-detection.service'
