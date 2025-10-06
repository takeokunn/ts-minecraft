/**
 * Chunk Repository Convenience Layers
 *
 * 開発・テスト・本番環境用のAll-in-One Repository Layer
 */

import { InMemoryChunkRepositoryLive } from './chunk_repository'
import { ChunkCQRSRepositoryLayer } from './cqrs'
import { ProductionRepositoryLayer } from './strategy'

/**
 * 開発環境用のAll-in-One Repository Layer
 * メモリベースの高速実装
 */
export const ChunkDevelopmentLayer = ChunkCQRSRepositoryLayer(InMemoryChunkRepositoryLive)

/**
 * テスト環境用のAll-in-One Repository Layer
 * テスト特化の設定
 */
export const ChunkTestLayer = ChunkCQRSRepositoryLayer(InMemoryChunkRepositoryLive)

/**
 * 本番環境用のAll-in-One Repository Layer
 * 環境自動検出による最適化実装
 */
export const ChunkProductionLayer = ChunkCQRSRepositoryLayer(ProductionRepositoryLayer)
