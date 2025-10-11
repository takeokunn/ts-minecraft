/**
 * @fileoverview ChunkManager Application Layer
 * Application層の依存関係を提供し、Domain層に依存
 */

import { ChunkManagerDomainLive } from '@/domain/chunk_manager/layers'
import { Layer } from 'effect'
import { ChunkLifecycleProviderLayer } from './chunk_lifecycle_provider'

/**
 * ChunkManager Application Layer
 * - Application Service: ChunkLifecycleProviderLayer
 * - 依存: ChunkManagerDomainLive (Domain Service層)
 */
export const ChunkManagerApplicationLive = Layer.provide(ChunkLifecycleProviderLayer, ChunkManagerDomainLive)
