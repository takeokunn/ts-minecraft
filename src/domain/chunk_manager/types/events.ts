/**
 * Chunk Manager Domain Event Types
 *
 * チャンクマネージャードメインのイベント型定義です。
 * Event Sourcingパターンに基づき、ドメイン内で発生する全てのイベントを型安全に定義します。
 */

import { Brand, Clock, Data, Effect, Schema } from 'effect'
import { ChunkId } from '../../chunk/value_object/chunk_id/index'
import {
  ChunkLifetime,
  ChunkPoolId,
  ChunkPriority,
  DestructionReason,
  GarbageCollectionStrategy,
  LifecycleStage,
  MemoryBytes,
  PoolStrategy,
  ResourceUsagePercent,
} from './index'

// ========================================
// Event ID and Metadata
// ========================================

/**
 * イベントID
 * 各イベントを一意に識別するBrand型
 */
export type EventId = string & Brand.Brand<'EventId'>

/**
 * イベントメタデータ
 * 全てのイベントに共通するメタデータ
 */
export interface EventMetadata extends Data.Case {
  readonly _tag: 'EventMetadata'
  readonly eventId: EventId
  readonly timestamp: Date
  readonly aggregateId: string
  readonly aggregateVersion: number
  readonly causationId?: EventId
  readonly correlationId?: string
  readonly userId?: string
}

export const EventMetadata = Data.case<EventMetadata>()

// ========================================
// Pool Management Events
// ========================================

/**
 * チャンクプール管理イベント
 * プールの作成、削除、設定変更に関するイベント群
 */
export type PoolManagementEvent = Data.TaggedEnum<{
  /** プール作成イベント */
  PoolCreated: {
    poolId: ChunkPoolId
    strategy: PoolStrategy
    maxCapacity: number
    metadata: EventMetadata
  }
  /** プール削除イベント */
  PoolDestroyed: {
    poolId: ChunkPoolId
    reason: string
    chunksEvicted: number
    metadata: EventMetadata
  }
  /** プール設定変更イベント */
  PoolConfigurationChanged: {
    poolId: ChunkPoolId
    oldStrategy: PoolStrategy
    newStrategy: PoolStrategy
    metadata: EventMetadata
  }
  /** プール容量変更イベント */
  PoolCapacityChanged: {
    poolId: ChunkPoolId
    oldCapacity: number
    newCapacity: number
    metadata: EventMetadata
  }
}>

// ========================================
// Chunk Lifecycle Events
// ========================================

/**
 * チャンクライフサイクルイベント
 * チャンクの状態遷移に関するイベント群
 */
export type ChunkLifecycleEvent = Data.TaggedEnum<{
  /** チャンク活性化イベント */
  ChunkActivated: {
    chunkId: ChunkId
    poolId: ChunkPoolId
    priority: ChunkPriority
    activatedAt: Date
    metadata: EventMetadata
  }
  /** チャンク非活性化イベント */
  ChunkDeactivated: {
    chunkId: ChunkId
    poolId: ChunkPoolId
    deactivatedAt: Date
    idleTime: ChunkLifetime
    reason: string
    metadata: EventMetadata
  }
  /** チャンク破棄マークイベント */
  ChunkMarkedForDestruction: {
    chunkId: ChunkId
    poolId: ChunkPoolId
    markedAt: Date
    reason: DestructionReason
    metadata: EventMetadata
  }
  /** チャンク破棄完了イベント */
  ChunkDestroyed: {
    chunkId: ChunkId
    poolId: ChunkPoolId
    destroyedAt: Date
    memoryFreed: MemoryBytes
    metadata: EventMetadata
  }
  /** ライフサイクル段階変更イベント */
  LifecycleStageChanged: {
    chunkId: ChunkId
    poolId: ChunkPoolId
    fromStage: LifecycleStage
    toStage: LifecycleStage
    changedAt: Date
    metadata: EventMetadata
  }
}>

// ========================================
// Memory Management Events
// ========================================

/**
 * メモリ管理イベント
 * メモリ使用量、制限、最適化に関するイベント群
 */
export type MemoryManagementEvent = Data.TaggedEnum<{
  /** メモリ使用量更新イベント */
  MemoryUsageUpdated: {
    totalUsage: MemoryBytes
    poolUsages: Record<string, MemoryBytes>
    usagePercent: ResourceUsagePercent
    timestamp: Date
    metadata: EventMetadata
  }
  /** メモリしきい値超過イベント */
  MemoryThresholdExceeded: {
    currentUsage: MemoryBytes
    threshold: MemoryBytes
    thresholdType: 'warning' | 'critical' | 'emergency'
    affectedPools: ChunkPoolId[]
    metadata: EventMetadata
  }
  /** メモリリーク検出イベント */
  MemoryLeakDetected: {
    suspectedChunks: ChunkId[]
    leakSize: MemoryBytes
    detectionMethod: string
    detectedAt: Date
    metadata: EventMetadata
  }
  /** メモリ最適化完了イベント */
  MemoryOptimized: {
    beforeUsage: MemoryBytes
    afterUsage: MemoryBytes
    savedBytes: MemoryBytes
    optimizationTime: number
    metadata: EventMetadata
  }
}>

// ========================================
// Garbage Collection Events
// ========================================

/**
 * ガベージコレクションイベント
 * GC処理の開始、進行、完了に関するイベント群
 */
export type GarbageCollectionEvent = Data.TaggedEnum<{
  /** GC開始イベント */
  GCStarted: {
    gcId: string
    strategy: GarbageCollectionStrategy
    targetPools: ChunkPoolId[]
    expectedChunks: number
    startedAt: Date
    metadata: EventMetadata
  }
  /** GC進行イベント */
  GCProgressUpdated: {
    gcId: string
    processedChunks: number
    totalChunks: number
    freedMemory: MemoryBytes
    estimatedTimeRemaining: number
    metadata: EventMetadata
  }
  /** GC完了イベント */
  GCCompleted: {
    gcId: string
    chunksCollected: number
    memoryFreed: MemoryBytes
    duration: number
    completedAt: Date
    metadata: EventMetadata
  }
  /** GCキャンセルイベント */
  GCCancelled: {
    gcId: string
    reason: string
    partialResults: {
      chunksCollected: number
      memoryFreed: MemoryBytes
    }
    cancelledAt: Date
    metadata: EventMetadata
  }
  /** GCエラーイベント */
  GCErrorOccurred: {
    gcId: string
    error: string
    affectedChunks: ChunkId[]
    recoveryAction: string
    metadata: EventMetadata
  }
}>

// ========================================
// Performance Events
// ========================================

/**
 * パフォーマンスイベント
 * システムパフォーマンス、メトリクス、最適化に関するイベント群
 */
export type PerformanceEvent = Data.TaggedEnum<{
  /** パフォーマンス測定イベント */
  PerformanceMetricRecorded: {
    metricName: string
    value: number
    unit: string
    poolId?: ChunkPoolId
    chunkId?: ChunkId
    recordedAt: Date
    metadata: EventMetadata
  }
  /** リソース使用率更新イベント */
  ResourceUsageUpdated: {
    resourceType: 'cpu' | 'memory' | 'io' | 'network'
    usage: ResourceUsagePercent
    trend: 'increasing' | 'decreasing' | 'stable'
    metadata: EventMetadata
  }
  /** 最適化推奨イベント */
  OptimizationRecommended: {
    optimizationType: string
    description: string
    expectedBenefit: string
    priority: 'low' | 'medium' | 'high'
    metadata: EventMetadata
  }
  /** パフォーマンス劣化検出イベント */
  PerformanceDegradationDetected: {
    affectedOperations: string[]
    degradationPercent: number
    possibleCauses: string[]
    recommendedActions: string[]
    metadata: EventMetadata
  }
}>

// ========================================
// Configuration Events
// ========================================

/**
 * 設定変更イベント
 * システム設定の変更に関するイベント群
 */
export type ConfigurationEvent = Data.TaggedEnum<{
  /** 設定変更イベント */
  ConfigurationChanged: {
    configKey: string
    oldValue: unknown
    newValue: unknown
    changedBy: string
    reason: string
    metadata: EventMetadata
  }
  /** 戦略変更イベント */
  StrategyChanged: {
    strategyType: 'pool' | 'gc' | 'optimization'
    oldStrategy: string
    newStrategy: string
    effectiveFrom: Date
    metadata: EventMetadata
  }
}>

// ========================================
// Error Events
// ========================================

/**
 * エラーイベント
 * システムエラーと復旧に関するイベント群
 */
export type ErrorEvent = Data.TaggedEnum<{
  /** エラー発生イベント */
  ErrorOccurred: {
    errorType: string
    errorMessage: string
    stackTrace?: string
    affectedComponents: string[]
    severity: 'low' | 'medium' | 'high' | 'critical'
    metadata: EventMetadata
  }
  /** エラー復旧イベント */
  ErrorRecovered: {
    originalErrorId: EventId
    recoveryMethod: string
    recoveryTime: number
    dataLoss: boolean
    metadata: EventMetadata
  }
}>

// ========================================
// Event Union Types
// ========================================

/**
 * チャンクマネージャードメインの全イベント型
 */
export type ChunkManagerEvent =
  | PoolManagementEvent
  | ChunkLifecycleEvent
  | MemoryManagementEvent
  | GarbageCollectionEvent
  | PerformanceEvent
  | ConfigurationEvent
  | ErrorEvent

// ========================================
// Event Schemas
// ========================================

export const EventIdSchema = Schema.String.pipe(
  Schema.brand('EventId'),
  Schema.annotations({
    title: 'EventId',
    description: 'イベントを一意に識別するID',
  })
)

export const EventMetadataSchema = Schema.Struct({
  _tag: Schema.Literal('EventMetadata'),
  eventId: EventIdSchema,
  timestamp: Schema.Date,
  aggregateId: Schema.String,
  aggregateVersion: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  causationId: Schema.optional(EventIdSchema),
  correlationId: Schema.optional(Schema.String),
  userId: Schema.optional(Schema.String),
})

export const PoolManagementEventSchema = Schema.Union(
  Schema.TaggedStruct('PoolCreated', {
    poolId: Schema.String,
    strategy: Schema.Unknown, // PoolStrategySchemaを参照
    maxCapacity: Schema.Number.pipe(Schema.int(), Schema.positive()),
    metadata: EventMetadataSchema,
  }),
  Schema.TaggedStruct('PoolDestroyed', {
    poolId: Schema.String,
    reason: Schema.String,
    chunksEvicted: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    metadata: EventMetadataSchema,
  }),
  Schema.TaggedStruct('PoolConfigurationChanged', {
    poolId: Schema.String,
    oldStrategy: Schema.Unknown,
    newStrategy: Schema.Unknown,
    metadata: EventMetadataSchema,
  }),
  Schema.TaggedStruct('PoolCapacityChanged', {
    poolId: Schema.String,
    oldCapacity: Schema.Number.pipe(Schema.int(), Schema.positive()),
    newCapacity: Schema.Number.pipe(Schema.int(), Schema.positive()),
    metadata: EventMetadataSchema,
  })
)

export const ChunkLifecycleEventSchema = Schema.Union(
  Schema.TaggedStruct('ChunkActivated', {
    chunkId: Schema.String,
    poolId: Schema.String,
    priority: Schema.Number.pipe(Schema.int(), Schema.between(0, 100)),
    activatedAt: Schema.Date,
    metadata: EventMetadataSchema,
  }),
  Schema.TaggedStruct('ChunkDeactivated', {
    chunkId: Schema.String,
    poolId: Schema.String,
    deactivatedAt: Schema.Date,
    idleTime: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    reason: Schema.String,
    metadata: EventMetadataSchema,
  }),
  Schema.TaggedStruct('ChunkMarkedForDestruction', {
    chunkId: Schema.String,
    poolId: Schema.String,
    markedAt: Schema.Date,
    reason: Schema.Unknown, // DestructionReasonSchemaを参照
    metadata: EventMetadataSchema,
  }),
  Schema.TaggedStruct('ChunkDestroyed', {
    chunkId: Schema.String,
    poolId: Schema.String,
    destroyedAt: Schema.Date,
    memoryFreed: Schema.Number.pipe(Schema.int(), Schema.positive()),
    metadata: EventMetadataSchema,
  }),
  Schema.TaggedStruct('LifecycleStageChanged', {
    chunkId: Schema.String,
    poolId: Schema.String,
    fromStage: Schema.Unknown, // LifecycleStageSchemaを参照
    toStage: Schema.Unknown, // LifecycleStageSchemaを参照
    changedAt: Schema.Date,
    metadata: EventMetadataSchema,
  })
)

// ========================================
// Event Factory Functions
// ========================================

export const createEventId = (): Effect.Effect<EventId> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    const random = yield* Effect.sync(() => Math.random().toString(36).substring(2, 11))
    return `event-${timestamp}-${random}` as EventId
  })

export const createEventMetadata = (
  aggregateId: string,
  aggregateVersion: number,
  options?: {
    causationId?: EventId
    correlationId?: string
    userId?: string
  }
): Effect.Effect<EventMetadata> =>
  Effect.gen(function* () {
    const eventId = yield* createEventId()
    const now = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms))

    return EventMetadata({
      eventId,
      timestamp: now,
      aggregateId,
      aggregateVersion,
      causationId: options?.causationId,
      correlationId: options?.correlationId,
      userId: options?.userId,
    })
  })

// Pool Management Event Factories
export const PoolManagementEvent = Data.taggedEnum<PoolManagementEvent>()

export const createPoolCreatedEvent = (
  poolId: ChunkPoolId,
  strategy: PoolStrategy,
  maxCapacity: number,
  aggregateVersion: number
): Effect.Effect<PoolManagementEvent> =>
  Effect.gen(function* () {
    const metadata = yield* createEventMetadata(poolId, aggregateVersion)
    return PoolManagementEvent.PoolCreated({
      poolId,
      strategy,
      maxCapacity,
      metadata,
    })
  })

export const createPoolDestroyedEvent = (
  poolId: ChunkPoolId,
  reason: string,
  chunksEvicted: number,
  aggregateVersion: number
): Effect.Effect<PoolManagementEvent> =>
  Effect.gen(function* () {
    const metadata = yield* createEventMetadata(poolId, aggregateVersion)
    return PoolManagementEvent.PoolDestroyed({
      poolId,
      reason,
      chunksEvicted,
      metadata,
    })
  })

// Chunk Lifecycle Event Factories
export const ChunkLifecycleEvent = Data.taggedEnum<ChunkLifecycleEvent>()

export const createChunkActivatedEvent = (
  chunkId: ChunkId,
  poolId: ChunkPoolId,
  priority: ChunkPriority,
  aggregateVersion: number
): Effect.Effect<ChunkLifecycleEvent> =>
  Effect.gen(function* () {
    const metadata = yield* createEventMetadata(chunkId, aggregateVersion)
    const now = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms))
    return ChunkLifecycleEvent.ChunkActivated({
      chunkId,
      poolId,
      priority,
      activatedAt: now,
      metadata,
    })
  })

export const createChunkDeactivatedEvent = (
  chunkId: ChunkId,
  poolId: ChunkPoolId,
  idleTime: ChunkLifetime,
  reason: string,
  aggregateVersion: number
): Effect.Effect<ChunkLifecycleEvent> =>
  Effect.gen(function* () {
    const metadata = yield* createEventMetadata(chunkId, aggregateVersion)
    const now = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms))
    return ChunkLifecycleEvent.ChunkDeactivated({
      chunkId,
      poolId,
      deactivatedAt: now,
      idleTime,
      reason,
      metadata,
    })
  })

export const createChunkMarkedForDestructionEvent = (
  chunkId: ChunkId,
  poolId: ChunkPoolId,
  reason: DestructionReason,
  aggregateVersion: number
): Effect.Effect<ChunkLifecycleEvent> =>
  Effect.gen(function* () {
    const metadata = yield* createEventMetadata(chunkId, aggregateVersion)
    const now = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms))
    return ChunkLifecycleEvent.ChunkMarkedForDestruction({
      chunkId,
      poolId,
      markedAt: now,
      reason,
      metadata,
    })
  })

export const createChunkDestroyedEvent = (
  chunkId: ChunkId,
  poolId: ChunkPoolId,
  memoryFreed: MemoryBytes,
  aggregateVersion: number
): Effect.Effect<ChunkLifecycleEvent> =>
  Effect.gen(function* () {
    const metadata = yield* createEventMetadata(chunkId, aggregateVersion)
    const now = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms))
    return ChunkLifecycleEvent.ChunkDestroyed({
      chunkId,
      poolId,
      destroyedAt: now,
      memoryFreed,
      metadata,
    })
  })

// Memory Management Event Factories
export const MemoryManagementEvent = Data.taggedEnum<MemoryManagementEvent>()

export const createMemoryUsageUpdatedEvent = (
  totalUsage: MemoryBytes,
  poolUsages: Record<string, MemoryBytes>,
  usagePercent: ResourceUsagePercent,
  aggregateVersion: number
): Effect.Effect<MemoryManagementEvent> =>
  Effect.gen(function* () {
    const metadata = yield* createEventMetadata('memory-manager', aggregateVersion)
    const now = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms))
    return MemoryManagementEvent.MemoryUsageUpdated({
      totalUsage,
      poolUsages,
      usagePercent,
      timestamp: now,
      metadata,
    })
  })

// Garbage Collection Event Factories
export const GarbageCollectionEvent = Data.taggedEnum<GarbageCollectionEvent>()

export const createGCStartedEvent = (
  gcId: string,
  strategy: GarbageCollectionStrategy,
  targetPools: ChunkPoolId[],
  expectedChunks: number,
  aggregateVersion: number
): Effect.Effect<GarbageCollectionEvent> =>
  Effect.gen(function* () {
    const metadata = yield* createEventMetadata(gcId, aggregateVersion)
    const now = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms))
    return GarbageCollectionEvent.GCStarted({
      gcId,
      strategy,
      targetPools,
      expectedChunks,
      startedAt: now,
      metadata,
    })
  })

export const createGCCompletedEvent = (
  gcId: string,
  chunksCollected: number,
  memoryFreed: MemoryBytes,
  duration: number,
  aggregateVersion: number
): Effect.Effect<GarbageCollectionEvent> =>
  Effect.gen(function* () {
    const metadata = yield* createEventMetadata(gcId, aggregateVersion)
    const now = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms))
    return GarbageCollectionEvent.GCCompleted({
      gcId,
      chunksCollected,
      memoryFreed,
      duration,
      completedAt: now,
      metadata,
    })
  })

// Performance Event Factories
export const PerformanceEvent = Data.taggedEnum<PerformanceEvent>()

export const createPerformanceMetricRecordedEvent = (
  metricName: string,
  value: number,
  unit: string,
  aggregateVersion: number,
  options?: {
    poolId?: ChunkPoolId
    chunkId?: ChunkId
  }
): Effect.Effect<PerformanceEvent> =>
  Effect.gen(function* () {
    const metadata = yield* createEventMetadata('performance-monitor', aggregateVersion)
    const now = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms))
    return PerformanceEvent.PerformanceMetricRecorded({
      metricName,
      value,
      unit,
      poolId: options?.poolId,
      chunkId: options?.chunkId,
      recordedAt: now,
      metadata,
    })
  })

// Configuration Event Factories
export const ConfigurationEvent = Data.taggedEnum<ConfigurationEvent>()

export const createConfigurationChangedEvent = (
  configKey: string,
  oldValue: unknown,
  newValue: unknown,
  changedBy: string,
  reason: string,
  aggregateVersion: number
): Effect.Effect<ConfigurationEvent> =>
  Effect.gen(function* () {
    const metadata = yield* createEventMetadata('configuration-manager', aggregateVersion)
    return ConfigurationEvent.ConfigurationChanged({
      configKey,
      oldValue,
      newValue,
      changedBy,
      reason,
      metadata,
    })
  })

// Error Event Factories
export const ErrorEvent = Data.taggedEnum<ErrorEvent>()

export const createErrorOccurredEvent = (
  errorType: string,
  errorMessage: string,
  affectedComponents: string[],
  severity: 'low' | 'medium' | 'high' | 'critical',
  aggregateVersion: number,
  stackTrace?: string
): Effect.Effect<ErrorEvent> =>
  Effect.gen(function* () {
    const metadata = yield* createEventMetadata('error-handler', aggregateVersion)
    return ErrorEvent.ErrorOccurred({
      errorType,
      errorMessage,
      stackTrace,
      affectedComponents,
      severity,
      metadata,
    })
  })

// ========================================
// Event Type Guards
// ========================================

export const isPoolManagementEvent = (event: ChunkManagerEvent): event is PoolManagementEvent =>
  event._tag === 'PoolCreated' ||
  event._tag === 'PoolDestroyed' ||
  event._tag === 'PoolConfigurationChanged' ||
  event._tag === 'PoolCapacityChanged'

export const isChunkLifecycleEvent = (event: ChunkManagerEvent): event is ChunkLifecycleEvent =>
  event._tag === 'ChunkActivated' ||
  event._tag === 'ChunkDeactivated' ||
  event._tag === 'ChunkMarkedForDestruction' ||
  event._tag === 'ChunkDestroyed' ||
  event._tag === 'LifecycleStageChanged'

export const isMemoryManagementEvent = (event: ChunkManagerEvent): event is MemoryManagementEvent =>
  event._tag === 'MemoryUsageUpdated' ||
  event._tag === 'MemoryThresholdExceeded' ||
  event._tag === 'MemoryLeakDetected' ||
  event._tag === 'MemoryOptimized'

export const isGarbageCollectionEvent = (event: ChunkManagerEvent): event is GarbageCollectionEvent =>
  event._tag === 'GCStarted' ||
  event._tag === 'GCProgressUpdated' ||
  event._tag === 'GCCompleted' ||
  event._tag === 'GCCancelled' ||
  event._tag === 'GCErrorOccurred'

export const isPerformanceEvent = (event: ChunkManagerEvent): event is PerformanceEvent =>
  event._tag === 'PerformanceMetricRecorded' ||
  event._tag === 'ResourceUsageUpdated' ||
  event._tag === 'OptimizationRecommended' ||
  event._tag === 'PerformanceDegradationDetected'

export const isConfigurationEvent = (event: ChunkManagerEvent): event is ConfigurationEvent =>
  event._tag === 'ConfigurationChanged' || event._tag === 'StrategyChanged'

export const isErrorEvent = (event: ChunkManagerEvent): event is ErrorEvent =>
  event._tag === 'ErrorOccurred' || event._tag === 'ErrorRecovered'
