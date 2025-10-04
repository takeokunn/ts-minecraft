/**
 * Repository Strategy Module - Barrel Export
 *
 * Repository Pattern の Strategy Implementation
 * 環境適応型Repository選択機能
 */

export {
  // Strategy Types
  type RepositoryStrategyType,
  type EnvironmentInfo,
  type RepositoryConfig,
  type PerformanceRequirements,

  // Environment Detection
  detectEnvironment,

  // Strategy Selection
  selectOptimalStrategy,
  autoSelectStrategy,

  // Strategy Factory
  createRepositoryLayer,

  // Configuration Builder
  RepositoryConfigBuilder,
  configureRepository,

  // Convenience Functions
  createOptimizedRepositoryLayer,

  // Environment-specific Layers
  DevelopmentRepositoryLayer,
  TestRepositoryLayer,
  ProductionRepositoryLayer,
} from './repository-strategy'