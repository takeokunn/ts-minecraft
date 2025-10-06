/**
 * ChunkRepository Module - Barrel Export
 *
 * Effect-TS パターンに基づく標準リポジトリインターフェース
 * チャンクの基本的なCRUD操作を提供
 */

export {
  ChunkRepository,
  // Methods
  type ChunkCreateResult,
  type ChunkDeleteResult,
  // Options
  type ChunkFindOptions,
  type ChunkFindResult,
  // Interface
  type ChunkRepository,
  type ChunkRepositoryEffect,
  type ChunkSaveOptions,
  type ChunkUpdateResult,
  // Types
  type ChunkVersion,
} from './interface'

// Note: Implementation will be added in a separate task
// For now, we export only the interface and types
