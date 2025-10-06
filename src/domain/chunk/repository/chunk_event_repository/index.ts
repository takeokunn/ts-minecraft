/**
 * ChunkEventRepository Module - Barrel Export
 *
 * Event Sourcing パターンに基づくイベントリポジトリ
 * チャンクの状態変更履歴管理
 */

export {
  ChunkEventRepository,
  // Event Types
  type BaseChunkEvent,
  type BlockChangedEvent,
  type ChunkCorruptedEvent,
  type ChunkCreatedEvent,
  type ChunkDeletedEvent,
  type ChunkEvent,
  // Interface
  type ChunkEventRepository,
  type ChunkEventRepositoryEffect,
  type ChunkLoadedEvent,
  type ChunkModifiedEvent,
  type ChunkOptimizedEvent,
  type ChunkSavedEvent,
  type ChunkSnapshot,
  type ChunkUnloadedEvent,
  type ChunkValidatedEvent,
  // Type Helpers
  type EventFactory,
  type EventProjection,
  type EventQuery,
  // Stream Types
  type EventStream,
} from './index'

// Note: Implementation will be added in a separate task
// For now, we export only the interface and types
export * from './index';
