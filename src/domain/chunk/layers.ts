/**
 * @fileoverview Chunk Domain Layer
 * Domain層の依存関係を提供（Repository層のみ）
 */

import { ChunkDevelopmentLayer } from './repository/layers'

/**
 * Chunk Domain Layer
 * - Repository: ChunkDevelopmentLayer (CQRS + InMemory)
 * - Domain Service: 純粋関数のためLayerなし
 */
export const ChunkDomainLive = ChunkDevelopmentLayer
