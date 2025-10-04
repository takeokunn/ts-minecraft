import type { ChunkId } from '@domain/chunk/value_object/chunk_id/types'
import { Context, Effect } from 'effect'
import { ChunkDistance, ChunkLifetime, MaxActiveChunks, MemoryBytes, ResourceUsagePercent, Timestamp } from './core'
import { ActivationError, ConfigError, DeactivationError, LifecycleStatsError, PoolMetricsError } from './errors'

export type SystemLoad = {
  readonly cpu: ResourceUsagePercent
  readonly memory: ResourceUsagePercent
  readonly network: ResourceUsagePercent
  readonly fps: number
}

export type MemoryUsage = {
  readonly total: MemoryBytes
  readonly active: MemoryBytes
  readonly cached: MemoryBytes
}

export type PerformanceMetrics = {
  readonly activationTime: ChunkLifetime
  readonly deactivationTime: ChunkLifetime
  readonly memoryPressure: ResourceUsagePercent
}

export type PoolMetrics = {
  readonly totalChunks: number
  readonly activeChunks: number
  readonly inactiveChunks: number
  readonly memoryUsage: MemoryUsage
  readonly performanceMetrics: PerformanceMetrics
}

export type LifecycleStats = {
  readonly totalActivations: number
  readonly totalDeactivations: number
  readonly averageLifetime: ChunkLifetime
  readonly memoryEfficiency: ResourceUsagePercent
  readonly cacheHitRate: ResourceUsagePercent
  readonly errorRate: ResourceUsagePercent
  readonly lastUpdated: Timestamp
}

export type AutoManagementConfig = {
  readonly enabled: boolean
  readonly activationDistance: ChunkDistance
  readonly deactivationDistance: ChunkDistance
  readonly maxActiveChunks: MaxActiveChunks
  readonly memoryThreshold: ResourceUsagePercent
  readonly performanceThreshold: ResourceUsagePercent
}

export type LifecycleInput = {
  readonly visibleChunks: ReadonlyArray<ChunkId>
  readonly loadedChunks: ReadonlyArray<ChunkId>
  readonly playerPosition: {
    readonly x: number
    readonly y: number
    readonly z: number
  }
  readonly systemLoad: SystemLoad
}

export const makeAutoManagementConfig = (config: AutoManagementConfig): AutoManagementConfig => config

export interface ChunkLifecycleProvider {
  readonly activateChunk: (id: ChunkId) => Effect.Effect<void, ActivationError>
  readonly deactivateChunk: (id: ChunkId) => Effect.Effect<void, DeactivationError>
  readonly getActiveChunks: () => Effect.Effect<ReadonlyArray<ChunkId>, never>
  readonly getPoolMetrics: () => Effect.Effect<PoolMetrics, PoolMetricsError>
  readonly configureAutoManagement: (config: AutoManagementConfig) => Effect.Effect<void, ConfigError>
  readonly getLifecycleStats: () => Effect.Effect<LifecycleStats, LifecycleStatsError>
}

export const ChunkLifecycleProvider = Context.GenericTag<ChunkLifecycleProvider>('ChunkLifecycleProvider')
