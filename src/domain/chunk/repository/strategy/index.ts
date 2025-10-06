/**
 * Repository Strategy Module - Barrel Export
 *
 * Repository Pattern の Strategy Implementation
 * 環境適応型Repository選択機能
 */

export {
  // Environment-specific Layers
  DevelopmentRepositoryLayer,
  ProductionRepositoryLayer,
  TestRepositoryLayer,
  autoSelectStrategy,
  configureRepository,

  // Convenience Functions
  createOptimizedRepositoryLayer,
  // Strategy Factory
  createRepositoryLayer,
  // Environment Detection
  detectEnvironment,

  // Strategy Selection
  selectOptimalStrategy,
  type EnvironmentInfo,
  type PerformanceRequirements,
  type RepositoryConfig,
  // Strategy Types
  type RepositoryStrategyType,
} from './repository_strategy'

// Configuration Builder State & Functions
export {
  RepositoryConfigBuilderStateSchema,
  initialRepositoryConfigBuilderState,
  type RepositoryConfigBuilderState,
} from './config_builder_state'

export {
  buildConfig,
  buildLayer,
  setCacheSize,
  setEnableCompression,
  setEnableEncryption,
  setEnableWebWorkers,
  setMaxMemoryUsage,
  setPreferredStorage,
  setStrategy,
} from './config_builder_functions'
