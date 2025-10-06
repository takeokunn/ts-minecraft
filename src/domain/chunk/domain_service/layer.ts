/**
 * Chunk Domain Services Layer
 *
 * 全てのチャンクドメインサービスを統合したレイヤー
 */

import { Layer } from 'effect'
import { ChunkOptimizationServiceLive } from './chunk_optimizer'
import { ChunkSerializationServiceLive } from './chunk_serializer'
import { ChunkValidationServiceLive } from './chunk_validator'

/**
 * 全てのチャンクドメインサービスを統合したレイヤー
 */
export const ChunkDomainServices = Layer.mergeAll(
  ChunkValidationServiceLive,
  ChunkSerializationServiceLive,
  ChunkOptimizationServiceLive
)
