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

// Performance layer compositions and utilities
export * from './performance-utils'
