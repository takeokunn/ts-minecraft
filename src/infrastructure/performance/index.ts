/**
 * Performance Infrastructure Layers
 *
 * This module provides a comprehensive suite of performance optimization layers
 * built on Effect-TS for TypeScript Minecraft applications:
 *
 * - Object Pool Layer: Memory-efficient object reuse patterns
 * - Memory Pool Layer: Advanced memory pool management
 * - Profiler Layer: Performance measurement and analysis
 * - Resource Layer: Resource caching and management
 * - Startup Layer: Application startup optimization
 * - Latency Layer: Latency monitoring and optimization
 */

// Object Pool Layer
export {
  ObjectPoolService,
  ObjectPoolServiceLive,
  type ObjectPool,
  type PoolableObject,
  type ObjectPoolConfig,
  createVector3Pool,
  createMatrix4Pool,
  createAABBPool,
  withPooledEffect,
  withTemporaryPool,
  vector3PoolConfig,
  matrix4PoolConfig,
  aabbPoolConfig,
  PooledVector3,
  PooledMatrix4,
  PooledAABB,
} from './object-pool.layer'

// Memory Pool Layer
export {
  MemoryPoolService,
  MemoryPoolServiceLive,
  type MemoryPool,
  type MemoryPoolConfig,
  type MemoryPoolMetrics,
  defaultMemoryPoolConfig,
  createFloat32Pool,
  createMatrix4Pool as createMatrix4MemoryPool,
  createVector3Pool as createVector3MemoryPool,
  createVector4Pool,
  createQuaternionPool,
  createBufferPool,
  withPooledMemory,
  acquireBatch,
  releaseBatch,
} from './memory-pool.layer'

// Profiler Layer
export {
  ProfilerService,
  ProfilerServiceLive,
  type ProfileMeasurement,
  type ProfilerConfig,
  type ProfilerStats,
  type ProfileSession,
  defaultProfilerConfig,
  profile,
  profileAsync,
  profileSync,
  profileBatch,
  withSession,
} from './profiler.layer'

// Resource Layer
export {
  ResourceService,
  ResourceServiceLive,
  type ResourceType,
  type ResourceMetadata,
  type ManagedResource,
  type ResourceCacheConfig,
  type LoadingStrategy,
  type ResourceLoader,
  type ResourceStats,
  defaultResourceConfig,
  withResource,
  loadBatch,
  createLoader,
} from './resource.layer'

// Startup Layer
export {
  StartupOptimizerService,
  StartupOptimizerServiceLive,
  type StartupPhase,
  type StartupPhaseMetrics,
  type StartupConfig,
  type CriticalPathItem,
  type StartupStats,
  defaultStartupConfig,
  withStartupPhase,
  createCriticalPathItem,
  measureStartupPerformance,
  createOptimizedStartup,
} from './startup.layer'

// Latency Layer
export {
  LatencyOptimizerService,
  LatencyOptimizerServiceLive,
  type LatencyMeasurement,
  type LatencyBucket,
  type LatencyStats,
  type LatencyTarget,
  type LatencyOptimizerConfig,
  defaultLatencyConfig,
  measureLatency,
  createLatencyTarget,
  withBatching,
  withCaching,
} from './latency.layer'

import { Layer } from 'effect'
import { ObjectPoolServiceLive } from './object-pool.layer'
import { MemoryPoolServiceLive } from './memory-pool.layer'
import { ProfilerServiceLive } from './profiler.layer'
import { ResourceServiceLive } from './resource.layer'
import { StartupOptimizerServiceLive } from './startup.layer'
import { LatencyOptimizerServiceLive } from './latency.layer'

/**
 * Combined performance layer with default configurations
 */
export const PerformanceLayer = Layer.mergeAll(
  ObjectPoolServiceLive,
  MemoryPoolServiceLive,
  ProfilerServiceLive(),
  ResourceServiceLive(),
  StartupOptimizerServiceLive(),
  LatencyOptimizerServiceLive(),
)

/**
 * Minimal performance layer for lightweight applications
 */
export const MinimalPerformanceLayer = Layer.mergeAll(ObjectPoolServiceLive, MemoryPoolServiceLive)

/**
 * Development performance layer with detailed profiling
 */
export const DevelopmentPerformanceLayer = Layer.mergeAll(
  ObjectPoolServiceLive,
  MemoryPoolServiceLive,
  ProfilerServiceLive({
    enableMemoryTracking: true,
    enableConsoleOutput: true,
    slowThreshold: 16,
    maxMeasurements: 2000,
    sampleRate: 1.0,
  }),
  ResourceServiceLive({
    maxMemoryMB: 256,
    maxItems: 500,
    ttlMs: 2 * 60 * 1000,
    enableLRU: true,
    enablePreloading: false,
    compressionEnabled: false,
  }),
  StartupOptimizerServiceLive({
    enableCodeSplitting: false,
    enableLazyLoading: true,
    enableResourcePreloading: false,
    enableCacheWarming: true,
    enableJITCompilation: false,
    enableTreeShaking: false,
    parallelInitialization: false,
    maxConcurrency: 2,
    timeoutMs: 60000,
  }),
  LatencyOptimizerServiceLive({
    enablePredictiveOptimization: false,
    enableAdaptiveBatching: true,
    enableRequestCoalescing: true,
    enableCaching: true,
    enablePrefetching: false,
    maxHistorySize: 500,
    measurementWindow: 30000,
    optimizationInterval: 5000,
    adaptiveThreshold: 1.5,
  }),
)

/**
 * Production performance layer optimized for performance
 */
export const ProductionPerformanceLayer = Layer.mergeAll(
  ObjectPoolServiceLive,
  MemoryPoolServiceLive,
  ProfilerServiceLive({
    enableMemoryTracking: false,
    enableConsoleOutput: false,
    slowThreshold: 16,
    maxMeasurements: 1000,
    sampleRate: 0.1, // Sample 10% for minimal overhead
  }),
  ResourceServiceLive({
    maxMemoryMB: 1024,
    maxItems: 2000,
    ttlMs: 10 * 60 * 1000,
    enableLRU: true,
    enablePreloading: true,
    compressionEnabled: true,
  }),
  StartupOptimizerServiceLive({
    enableCodeSplitting: true,
    enableLazyLoading: true,
    enableResourcePreloading: true,
    enableCacheWarming: true,
    enableJITCompilation: true,
    enableTreeShaking: true,
    parallelInitialization: true,
    maxConcurrency: 8,
    timeoutMs: 30000,
  }),
  LatencyOptimizerServiceLive({
    enablePredictiveOptimization: true,
    enableAdaptiveBatching: true,
    enableRequestCoalescing: true,
    enableCaching: true,
    enablePrefetching: true,
    maxHistorySize: 1000,
    measurementWindow: 60000,
    optimizationInterval: 10000,
    adaptiveThreshold: 1.2,
  }),
)

/**
 * Performance configuration presets
 */
export const PerformancePresets = {
  /**
   * Default balanced configuration
   */
  Default: PerformanceLayer,

  /**
   * Minimal overhead for resource-constrained environments
   */
  Minimal: MinimalPerformanceLayer,

  /**
   * Development with comprehensive monitoring
   */
  Development: DevelopmentPerformanceLayer,

  /**
   * Production-optimized configuration
   */
  Production: ProductionPerformanceLayer,
} as const

/**
 * Performance layer builder for custom configurations
 */
export const createPerformanceLayer = (options: {
  objectPool?: boolean
  memoryPool?: boolean
  profiler?: Parameters<typeof ProfilerServiceLive>[0]
  resource?: Parameters<typeof ResourceServiceLive>[0]
  startup?: Parameters<typeof StartupOptimizerServiceLive>[0]
  latency?: Parameters<typeof LatencyOptimizerServiceLive>[0]
}) => {
  const layers = []

  if (options.objectPool !== false) {
    layers.push(ObjectPoolServiceLive)
  }

  if (options.memoryPool !== false) {
    layers.push(MemoryPoolServiceLive)
  }

  if (options.profiler) {
    layers.push(ProfilerServiceLive(options.profiler))
  }

  if (options.resource) {
    layers.push(ResourceServiceLive(options.resource))
  }

  if (options.startup) {
    layers.push(StartupOptimizerServiceLive(options.startup))
  }

  if (options.latency) {
    layers.push(LatencyOptimizerServiceLive(options.latency))
  }

  return layers.length > 0 ? Layer.mergeAll(...layers) : Layer.empty
}
