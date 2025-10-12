import { Layer } from 'effect'

import { ChunkCacheServiceLive } from './chunk-cache'
import { ChunkWorkerAdapterLive } from './worker-adapter'
import { ChunkWorkerRuntimeLayer } from './worker-runtime'

export * from './worker-adapter'
export * from './chunk-cache'
export * from './worker-runtime'

export const ChunkInfrastructureLayer = Layer.mergeAll(
  ChunkWorkerAdapterLive,
  ChunkCacheServiceLive,
  ChunkWorkerRuntimeLayer
)
