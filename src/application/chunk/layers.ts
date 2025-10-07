/**
 * @fileoverview Chunk Application Layer
 * Application層の依存関係を提供し、Domain層に依存
 */

import { ChunkDomainLive } from '@/domain/chunk/layers'
import { Layer } from 'effect'
import { ChunkDataProviderLive } from './chunk_data_provider'

/**
 * Chunk Application Layer
 * - Application Service: ChunkDataProviderLive
 * - 依存: ChunkDomainLive (Repository層)
 */
export const ChunkApplicationLive = Layer.provide(ChunkDataProviderLive, ChunkDomainLive)
