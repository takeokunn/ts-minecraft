import { Layer } from 'effect'

import { createChunkDomainLayer } from '@/domain/chunk/layers'
import { ChunkInfrastructureLayer } from '@/infrastructure/chunk'
import { ChunkRepositoryMemoryLayer } from '@/infrastructure/chunk/repository/layers'
import { ChunkAPIServiceLive } from './api-service'
import { ChunkDataProviderLive } from './chunk_data_provider'
import { ChunkCommandHandlerLive, ChunkQueryHandlerLive, ChunkReadModelLive } from './cqrs'

const ChunkDomainLayer = createChunkDomainLayer({ repository: ChunkRepositoryMemoryLayer })

export const ChunkApplicationServicesLayer = Layer.mergeAll(
  ChunkReadModelLive,
  ChunkCommandHandlerLive,
  ChunkQueryHandlerLive,
  ChunkDataProviderLive,
  ChunkAPIServiceLive
)

export const ChunkApplicationLive = Layer.mergeAll(
  ChunkDomainLayer,
  ChunkInfrastructureLayer,
  ChunkApplicationServicesLayer
)
