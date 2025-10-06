import { Context, Effect, Layer } from 'effect'
import { makeChunkPool } from '../aggregate'
import type { ChunkLifecycleProvider } from '../types'
import {
  AutoManagementConfig,
  ChunkLifecycleProvider as ChunkLifecycleProviderTag,
  ChunkManagerConfig,
  DefaultChunkManagerConfig,
  makeChunkDistance,
  makeMaxActiveChunks,
  makeResourceUsagePercent,
} from '../types'

const fallbackAutoConfig: AutoManagementConfig = {
  enabled: true,
  activationDistance: makeChunkDistance(8),
  deactivationDistance: makeChunkDistance(12),
  maxActiveChunks: makeMaxActiveChunks(512),
  memoryThreshold: makeResourceUsagePercent(0.75),
  performanceThreshold: makeResourceUsagePercent(0.85),
}

export const createChunkLifecycleProvider = (
  params: {
    readonly coreConfig?: ChunkManagerConfig
    readonly autoConfig?: AutoManagementConfig
  } = {}
): Effect.Effect<ChunkLifecycleProvider> =>
  Effect.map(
    makeChunkPool({
      coreConfig: params.coreConfig ?? DefaultChunkManagerConfig,
      autoConfig: params.autoConfig ?? fallbackAutoConfig,
    }),
    (pool) => ({
      activateChunk: pool.activate,
      deactivateChunk: pool.deactivate,
      getActiveChunks: pool.getActiveChunks,
      getPoolMetrics: pool.getPoolMetrics,
      configureAutoManagement: pool.configure,
      getLifecycleStats: pool.snapshotStats,
    })
  )

export const ChunkLifecycleProviderLive = Layer.effect(ChunkLifecycleProviderTag, createChunkLifecycleProvider())

export const getChunkLifecycleProvider = () => Context.get(ChunkLifecycleProviderTag)
