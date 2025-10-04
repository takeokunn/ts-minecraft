import { Context, Effect } from 'effect'
import type { ChunkPosition } from '../../value_object/chunk_position'
import type { ChunkData } from '../../aggregate/chunk_data'
import type { ChunkId } from '../../value_object/chunk_id'
import type { RepositoryError } from '../types/repository_error'

/**
 * Chunk Event Repository Interface
 *
 * Event Sourcing パターンに基づくチャンクイベントの永続化
 * 時系列でのチャンク状態変更履歴を管理
 */

// ===== Event Types ===== //

/**
 * チャンクイベント基底型
 */
export interface BaseChunkEvent {
  readonly eventId: string
  readonly aggregateId: ChunkId
  readonly eventType: string
  readonly timestamp: number
  readonly version: number
  readonly metadata?: {
    readonly userId?: string
    readonly sessionId?: string
    readonly source?: string
    readonly correlationId?: string
  }
}

/**
 * チャンクイベント統合型
 */
export type ChunkEvent =
  | ChunkCreatedEvent
  | ChunkLoadedEvent
  | ChunkUnloadedEvent
  | ChunkModifiedEvent
  | ChunkSavedEvent
  | ChunkDeletedEvent
  | BlockChangedEvent
  | ChunkOptimizedEvent
  | ChunkValidatedEvent
  | ChunkCorruptedEvent

/**
 * チャンク作成イベント
 */
export interface ChunkCreatedEvent extends BaseChunkEvent {
  readonly eventType: 'ChunkCreated'
  readonly payload: {
    readonly position: ChunkPosition
    readonly initialData: ChunkData
    readonly source: 'generated' | 'loaded' | 'imported'
  }
}

/**
 * チャンクロードイベント
 */
export interface ChunkLoadedEvent extends BaseChunkEvent {
  readonly eventType: 'ChunkLoaded'
  readonly payload: {
    readonly position: ChunkPosition
    readonly loadTime: number
    readonly cacheHit: boolean
    readonly dataSize: number
  }
}

/**
 * チャンクアンロードイベント
 */
export interface ChunkUnloadedEvent extends BaseChunkEvent {
  readonly eventType: 'ChunkUnloaded'
  readonly payload: {
    readonly position: ChunkPosition
    readonly reason: 'memory_pressure' | 'distance' | 'manual' | 'shutdown'
    readonly wasDirty: boolean
  }
}

/**
 * チャンク変更イベント
 */
export interface ChunkModifiedEvent extends BaseChunkEvent {
  readonly eventType: 'ChunkModified'
  readonly payload: {
    readonly position: ChunkPosition
    readonly changeSet: {
      readonly blocks: ReadonlyArray<{
        readonly x: number
        readonly y: number
        readonly z: number
        readonly previousBlockId: string
        readonly newBlockId: string
      }>
    }
    readonly reason: string
  }
}

/**
 * チャンク保存イベント
 */
export interface ChunkSavedEvent extends BaseChunkEvent {
  readonly eventType: 'ChunkSaved'
  readonly payload: {
    readonly position: ChunkPosition
    readonly saveTime: number
    readonly dataSize: number
    readonly compressionRatio?: number
  }
}

/**
 * チャンク削除イベント
 */
export interface ChunkDeletedEvent extends BaseChunkEvent {
  readonly eventType: 'ChunkDeleted'
  readonly payload: {
    readonly position: ChunkPosition
    readonly reason: 'manual' | 'cleanup' | 'corruption'
    readonly backupCreated: boolean
  }
}

/**
 * ブロック変更イベント
 */
export interface BlockChangedEvent extends BaseChunkEvent {
  readonly eventType: 'BlockChanged'
  readonly payload: {
    readonly chunkPosition: ChunkPosition
    readonly blockPosition: { readonly x: number; readonly y: number; readonly z: number }
    readonly previousBlockId: string
    readonly newBlockId: string
    readonly tool?: string
    readonly player?: string
  }
}

/**
 * チャンク最適化イベント
 */
export interface ChunkOptimizedEvent extends BaseChunkEvent {
  readonly eventType: 'ChunkOptimized'
  readonly payload: {
    readonly position: ChunkPosition
    readonly optimizationType: 'compression' | 'defragmentation' | 'cache_optimization'
    readonly beforeSize: number
    readonly afterSize: number
    readonly timeTaken: number
  }
}

/**
 * チャンク検証イベント
 */
export interface ChunkValidatedEvent extends BaseChunkEvent {
  readonly eventType: 'ChunkValidated'
  readonly payload: {
    readonly position: ChunkPosition
    readonly validationResult: 'passed' | 'failed'
    readonly issues?: ReadonlyArray<string>
    readonly checksum: string
  }
}

/**
 * チャンク破損イベント
 */
export interface ChunkCorruptedEvent extends BaseChunkEvent {
  readonly eventType: 'ChunkCorrupted'
  readonly payload: {
    readonly position: ChunkPosition
    readonly corruptionType: 'checksum_mismatch' | 'invalid_data' | 'missing_blocks'
    readonly expectedChecksum?: string
    readonly actualChecksum?: string
    readonly recoverable: boolean
  }
}

// ===== Event Stream Types ===== //

/**
 * イベントストリーム
 */
export interface EventStream {
  readonly streamId: string
  readonly events: ReadonlyArray<ChunkEvent>
  readonly version: number
  readonly timestamp: number
}

/**
 * イベント投影
 */
export interface EventProjection<T> {
  readonly projectionId: string
  readonly data: T
  readonly lastProcessedEvent: string
  readonly version: number
  readonly timestamp: number
}

/**
 * スナップショット
 */
export interface ChunkSnapshot {
  readonly aggregateId: ChunkId
  readonly data: ChunkData
  readonly version: number
  readonly timestamp: number
  readonly eventCount: number
}

/**
 * イベント照会条件
 */
export interface EventQuery {
  readonly aggregateIds?: ReadonlyArray<ChunkId>
  readonly eventTypes?: ReadonlyArray<string>
  readonly fromTimestamp?: number
  readonly toTimestamp?: number
  readonly fromVersion?: number
  readonly toVersion?: number
  readonly limit?: number
  readonly offset?: number
  readonly sortOrder?: 'asc' | 'desc'
}

// ===== Repository Interface ===== //

/**
 * ChunkEventRepository インターフェース
 *
 * Event Sourcing パターンに基づくイベント永続化
 */
export interface ChunkEventRepository {
  // ===== Event Operations ===== //

  /**
   * イベントを追加
   */
  readonly appendEvent: (event: ChunkEvent) => Effect.Effect<void, RepositoryError>

  /**
   * 複数イベントを一括追加
   */
  readonly appendEvents: (events: ReadonlyArray<ChunkEvent>) => Effect.Effect<void, RepositoryError>

  /**
   * 集約のイベントを取得
   */
  readonly getEvents: (aggregateId: ChunkId) => Effect.Effect<ReadonlyArray<ChunkEvent>, RepositoryError>

  /**
   * 指定時刻以降のイベントを取得
   */
  readonly getEventsSince: (
    aggregateId: ChunkId,
    timestamp: number
  ) => Effect.Effect<ReadonlyArray<ChunkEvent>, RepositoryError>

  /**
   * 指定バージョン以降のイベントを取得
   */
  readonly getEventsFromVersion: (
    aggregateId: ChunkId,
    version: number
  ) => Effect.Effect<ReadonlyArray<ChunkEvent>, RepositoryError>

  /**
   * 条件指定でイベントを検索
   */
  readonly queryEvents: (query: EventQuery) => Effect.Effect<ReadonlyArray<ChunkEvent>, RepositoryError>

  // ===== Event Stream Operations ===== //

  /**
   * イベントストリームを取得
   */
  readonly getEventStream: (streamId: string) => Effect.Effect<EventStream, RepositoryError>

  /**
   * 全イベントストリームを取得
   */
  readonly getAllEventStreams: () => Effect.Effect<ReadonlyArray<EventStream>, RepositoryError>

  /**
   * イベントストリームの統計を取得
   */
  readonly getStreamStatistics: (streamId: string) => Effect.Effect<{
    readonly eventCount: number
    readonly firstEventTimestamp: number
    readonly lastEventTimestamp: number
    readonly averageEventSize: number
  }, RepositoryError>

  // ===== Snapshot Operations ===== //

  /**
   * スナップショットを作成
   */
  readonly createSnapshot: (
    aggregateId: ChunkId,
    data: ChunkData,
    version: number
  ) => Effect.Effect<void, RepositoryError>

  /**
   * 最新スナップショットを取得
   */
  readonly getLatestSnapshot: (aggregateId: ChunkId) => Effect.Effect<ChunkSnapshot | null, RepositoryError>

  /**
   * 指定バージョンのスナップショットを取得
   */
  readonly getSnapshotAtVersion: (
    aggregateId: ChunkId,
    version: number
  ) => Effect.Effect<ChunkSnapshot | null, RepositoryError>

  /**
   * 古いスナップショットを削除
   */
  readonly cleanupOldSnapshots: (
    aggregateId: ChunkId,
    keepCount: number
  ) => Effect.Effect<void, RepositoryError>

  // ===== Replay and Projection Operations ===== //

  /**
   * イベントリプレイによる状態復元
   */
  readonly replay: (aggregateId: ChunkId) => Effect.Effect<ChunkData, RepositoryError>

  /**
   * 指定時点での状態復元
   */
  readonly replayToTimestamp: (
    aggregateId: ChunkId,
    timestamp: number
  ) => Effect.Effect<ChunkData, RepositoryError>

  /**
   * 指定バージョンでの状態復元
   */
  readonly replayToVersion: (
    aggregateId: ChunkId,
    version: number
  ) => Effect.Effect<ChunkData, RepositoryError>

  /**
   * イベント投影を作成
   */
  readonly createProjection: <T>(
    projectionId: string,
    initialData: T,
    reducer: (data: T, event: ChunkEvent) => T
  ) => Effect.Effect<void, RepositoryError>

  /**
   * イベント投影を更新
   */
  readonly updateProjection: <T>(
    projectionId: string,
    fromEvent?: string
  ) => Effect.Effect<EventProjection<T>, RepositoryError>

  // ===== Analytics and Monitoring ===== //

  /**
   * イベント統計を取得
   */
  readonly getEventStatistics: (
    timeRange?: { from: number; to: number }
  ) => Effect.Effect<{
    readonly totalEvents: number
    readonly eventsByType: ReadonlyArray<{ readonly type: string; readonly count: number }>
    readonly eventsPerSecond: number
    readonly averageEventSize: number
  }, RepositoryError>

  /**
   * 集約統計を取得
   */
  readonly getAggregateStatistics: () => Effect.Effect<{
    readonly totalAggregates: number
    readonly averageEventsPerAggregate: number
    readonly largestEventStream: { readonly aggregateId: ChunkId; readonly eventCount: number }
    readonly oldestEvent: ChunkEvent
    readonly newestEvent: ChunkEvent
  }, RepositoryError>

  /**
   * パフォーマンス監視
   */
  readonly getPerformanceMetrics: () => Effect.Effect<{
    readonly appendLatency: ReadonlyArray<{ readonly timestamp: number; readonly latencyMs: number }>
    readonly queryLatency: ReadonlyArray<{ readonly timestamp: number; readonly latencyMs: number }>
    readonly storageSize: number
    readonly indexSize: number
  }, RepositoryError>

  // ===== Maintenance Operations ===== //

  /**
   * イベントストアの初期化
   */
  readonly initialize: () => Effect.Effect<void, RepositoryError>

  /**
   * イベントストアの最適化
   */
  readonly optimize: () => Effect.Effect<void, RepositoryError>

  /**
   * イベントストアの整合性チェック
   */
  readonly validateConsistency: () => Effect.Effect<{
    readonly isConsistent: boolean
    readonly issues: ReadonlyArray<string>
  }, RepositoryError>

  /**
   * 古いイベントのアーカイブ
   */
  readonly archiveOldEvents: (
    beforeTimestamp: number
  ) => Effect.Effect<{ readonly archivedCount: number }, RepositoryError>

  /**
   * リソースクリーンアップ
   */
  readonly cleanup: () => Effect.Effect<void, RepositoryError>
}

// ===== Context Tag ===== //

/**
 * ChunkEventRepository Context Tag
 */
export const ChunkEventRepository = Context.GenericTag<ChunkEventRepository>('ChunkEventRepository')

// ===== Type Helpers ===== //

/**
 * Event Repository操作の戻り値型ヘルパー
 */
export type ChunkEventRepositoryEffect<T> = Effect.Effect<T, RepositoryError, ChunkEventRepository>

/**
 * イベントファクトリー関数型
 */
export type EventFactory<T extends ChunkEvent> = (
  aggregateId: ChunkId,
  payload: T['payload'],
  metadata?: T['metadata']
) => T