/**
 * ChunkEventRepository Module - Barrel Export
 *
 * Event Sourcing パターンに基づくイベントリポジトリ
 * チャンクの状態変更履歴管理
 */

export {
  // Interface
  type ChunkEventRepository,
  ChunkEventRepository,
  type ChunkEventRepositoryEffect,

  // Event Types
  type BaseChunkEvent,
  type ChunkEvent,
  type ChunkCreatedEvent,
  type ChunkLoadedEvent,
  type ChunkUnloadedEvent,
  type ChunkModifiedEvent,
  type ChunkSavedEvent,
  type ChunkDeletedEvent,
  type BlockChangedEvent,
  type ChunkOptimizedEvent,
  type ChunkValidatedEvent,
  type ChunkCorruptedEvent,

  // Stream Types
  type EventStream,
  type EventProjection,
  type ChunkSnapshot,
  type EventQuery,

  // Type Helpers
  type EventFactory,
} from './interface'

// Note: Implementation will be added in a separate task
// For now, we export only the interface and types