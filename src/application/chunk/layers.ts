/**
 * @fileoverview Chunk Application Layer
 * Application層の依存関係を提供し、Domain層に依存
 */

import { ChunkDomainLive } from '@/domain/chunk/layers'
import { Layer } from 'effect'
import { ChunkDataProviderLive } from './chunk_data_provider'
import { ChunkAPIServiceLive } from './api-service'

export const ChunkApplicationServicesLayer = Layer.mergeAll(ChunkDataProviderLive, ChunkAPIServiceLive)

/**
 * Chunk Application Layer
 * - Application Services: ChunkDataProviderLive, ChunkAPIServiceLive
 * - 依存: ChunkDomainLive (Repository層)
 */
export const ChunkApplicationLive = ChunkApplicationServicesLayer.pipe(Layer.provide(ChunkDomainLive))
