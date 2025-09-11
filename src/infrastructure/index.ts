/**
 * Infrastructure Layer - Central exports for all infrastructure implementations
 * 
 * This module provides a unified interface to all infrastructure components,
 * following clean architecture principles where the infrastructure layer
 * implements the technical details required by the application and domain layers.
 * 
 * Architecture:
 * - adapters/     - Technical implementation adapters (rendering, input, etc.)
 * - repositories/ - Data access implementations following Repository pattern
 * - layers/       - Effect-based dependency injection layers
 * - ui/          - User interface infrastructure
 * - workers/     - Web Worker implementations for background processing
 */

// Adapter implementations
export * from './adapters'

// Repository implementations  
export * from './repositories'

// Effect layers for dependency injection
export * from './layers'

// UI infrastructure
export * from './ui'

// Worker implementations
export * from './workers'

// Core infrastructure utilities and services
export {
  SpatialGrid,
  type SpatialGridConfig,
  type SpatialGridCell
} from './spatial-grid'

export {
  StatsCollector,
  type PerformanceMetrics,
  type StatsConfig
} from './stats'

export {
  BrowserClock,
  type ClockConfig,
  type TimeInfo
} from './clock'

// Three.js context and utilities
export {
  ThreeJsContext,
  type ThreeJsContextConfig
} from './three-js-context'

// GPU and WebGPU utilities
export * from './gpu'

// Network infrastructure
export * from './network'

// Performance monitoring
export * from './performance'

// Storage infrastructure
export * from './storage'

/**
 * Unified infrastructure layer for easy application setup
 */
import * as Layer from 'effect/Layer'
import { 
  BasicBrowserAdapters, 
  AdvancedBrowserAdapters, 
  ProductionAdapters,
  AdapterUtils 
} from './adapters'
import { 
  AllRepositories, 
  CoreRepositories,
  RepositoryFactory 
} from './repositories'
import { 
  UnifiedAppLive, 
  DevelopmentLive, 
  ProductionLive,
  getRuntimeLayer 
} from './layers'

/**
 * Complete infrastructure layer for development
 */
export const DevelopmentInfrastructure = Layer.mergeAll(
  AdvancedBrowserAdapters,
  AllRepositories,
  DevelopmentLive
)

/**
 * Complete infrastructure layer for production
 */
export const ProductionInfrastructure = Layer.mergeAll(
  ProductionAdapters,
  CoreRepositories,
  ProductionLive
)

/**
 * Complete infrastructure layer with all features
 */
export const FullInfrastructure = Layer.mergeAll(
  AdvancedBrowserAdapters,
  AllRepositories,
  UnifiedAppLive
)

/**
 * Minimal infrastructure for basic functionality
 */
export const MinimalInfrastructure = Layer.mergeAll(
  BasicBrowserAdapters,
  CoreRepositories,
  getRuntimeLayer('minimal')
)

/**
 * Infrastructure utilities and factory functions
 */
export const InfrastructureUtils = {
  /**
   * Create infrastructure layer based on environment and capabilities
   */
  createInfrastructureLayer: (environment: 'development' | 'production' | 'test') => {
    switch (environment) {
      case 'development':
        return DevelopmentInfrastructure
      case 'production':
        return ProductionInfrastructure
      case 'test':
        return MinimalInfrastructure
      default:
        return FullInfrastructure
    }
  },

  /**
   * Create infrastructure layer with auto-detection of capabilities
   */
  createAutoInfrastructure: () => {
    const recommendedAdapters = AdapterUtils.getRecommendedAdapterLayer()
    const repositories = AdapterUtils.isWebGPUAvailable() 
      ? AllRepositories 
      : CoreRepositories
    const layers = AdapterUtils.areWorkersAvailable() 
      ? UnifiedAppLive 
      : getRuntimeLayer('minimal')

    return Layer.mergeAll(
      recommendedAdapters,
      repositories,
      layers
    )
  },

  /**
   * Create infrastructure layer with custom configuration
   */
  createCustomInfrastructure: (config: {
    adapters?: 'minimal' | 'standard' | 'advanced'
    repositories?: 'core' | 'all'
    features?: ('workers' | 'webgpu' | 'networking')[]
  }) => {
    const adapters = config.adapters === 'minimal' 
      ? BasicBrowserAdapters
      : config.adapters === 'advanced' 
        ? AdvancedBrowserAdapters
        : ProductionAdapters

    const repositories = config.repositories === 'all' 
      ? AllRepositories 
      : CoreRepositories

    const hasWorkers = config.features?.includes('workers') ?? true
    const layers = hasWorkers ? UnifiedAppLive : getRuntimeLayer('minimal')

    return Layer.mergeAll(adapters, repositories, layers)
  }
}

/**
 * Infrastructure health monitoring
 */
export const InfrastructureHealth = {
  /**
   * Check overall infrastructure health
   */
  checkHealth: async (): Promise<{
    isHealthy: boolean
    components: {
      adapters: { status: 'healthy' | 'warning' | 'error'; message?: string }
      repositories: { status: 'healthy' | 'warning' | 'error'; message?: string }
      layers: { status: 'healthy' | 'warning' | 'error'; message?: string }
      workers: { status: 'healthy' | 'warning' | 'error'; message?: string }
    }
  }> => {
    // Implementation would check health of each infrastructure component
    return {
      isHealthy: true,
      components: {
        adapters: { status: 'healthy' },
        repositories: { status: 'healthy' },
        layers: { status: 'healthy' },
        workers: { status: 'healthy' }
      }
    }
  },

  /**
   * Get infrastructure performance metrics
   */
  getMetrics: async () => {
    // Implementation would gather performance data from all infrastructure components
    return {
      uptime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      diskUsage: 0,
      networkLatency: 0,
      errorRate: 0,
      throughput: 0
    }
  }
}