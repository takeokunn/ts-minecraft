import { Schema } from 'effect'

// =============================================================================
// 時刻・期間系ブランド型
// =============================================================================

// Re-export from units
export { TimestampSchema, type Timestamp } from '../../shared/value_object/units'

export const DurationMsSchema = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand('DurationMs'))
export type DurationMs = Schema.Schema.Type<typeof DurationMsSchema>

// =============================================================================
// 識別子・数値ブランド型
// =============================================================================

export const ChunkPoolIdSchema = Schema.String.pipe(Schema.minLength(1), Schema.brand('ChunkPoolId'))
export type ChunkPoolId = Schema.Schema.Type<typeof ChunkPoolIdSchema>

export const MemoryBytesSchema = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand('MemoryBytes'))
export type MemoryBytes = Schema.Schema.Type<typeof MemoryBytesSchema>

export const ChunkPrioritySchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 100),
  Schema.brand('ChunkPriority')
)
export type ChunkPriority = Schema.Schema.Type<typeof ChunkPrioritySchema>

export const GCIntervalSchema = Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.brand('GCIntervalMs'))
export type GCInterval = Schema.Schema.Type<typeof GCIntervalSchema>

export const ResourceUsagePercentSchema = Schema.Number.pipe(Schema.between(0, 1), Schema.brand('ResourceUsagePercent'))
export type ResourceUsagePercent = Schema.Schema.Type<typeof ResourceUsagePercentSchema>

export const ChunkLifetimeSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('ChunkLifetimeMs')
)
export type ChunkLifetime = Schema.Schema.Type<typeof ChunkLifetimeSchema>

export const ChunkDistanceSchema = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand('ChunkDistance'))
export type ChunkDistance = Schema.Schema.Type<typeof ChunkDistanceSchema>

export const MaxActiveChunksSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand('MaxActiveChunks')
)
export type MaxActiveChunks = Schema.Schema.Type<typeof MaxActiveChunksSchema>

// =============================================================================
// 破棄理由（ADT）
// =============================================================================

export const DestructionReasonSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('MemoryPressure'),
    currentUsage: MemoryBytesSchema,
    maxLimit: MemoryBytesSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('LongIdle'),
    idleTime: ChunkLifetimeSchema,
    maxIdleTime: ChunkLifetimeSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('ManualEviction'),
    requestedBy: Schema.String.pipe(Schema.minLength(1)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('SystemShutdown'),
    issuedAt: TimestampSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Error'),
    message: Schema.String.pipe(Schema.minLength(1)),
  })
)
export type DestructionReason = Schema.Schema.Type<typeof DestructionReasonSchema>

// =============================================================================
// ライフサイクル段階（ADT）
// =============================================================================

export const LifecycleStageSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Initialized'),
    createdAt: TimestampSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Active'),
    activatedAt: TimestampSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Inactive'),
    deactivatedAt: TimestampSchema,
    idleFor: ChunkLifetimeSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PendingDestruction'),
    markedAt: TimestampSchema,
    reason: DestructionReasonSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Destroyed'),
    destroyedAt: TimestampSchema,
  })
)
export type LifecycleStage = Schema.Schema.Type<typeof LifecycleStageSchema>

// =============================================================================
// プール戦略＆ガベージコレクション戦略（ADT）
// =============================================================================

export const PoolStrategySchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('LRU'),
    maxSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('LFU'),
    maxSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
    decayFactor: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('TTL'),
    maxSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
    ttl: ChunkLifetimeSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Adaptive'),
    initial: Schema.Literal('LRU', 'LFU', 'TTL'),
    adaptationThreshold: ResourceUsagePercentSchema,
  })
)
export type PoolStrategy = Schema.Schema.Type<typeof PoolStrategySchema>

export const GarbageCollectionStrategySchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Periodic'),
    interval: GCIntervalSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Threshold'),
    memoryThreshold: ResourceUsagePercentSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Adaptive'),
    baseInterval: GCIntervalSchema,
    memoryThreshold: ResourceUsagePercentSchema,
    loadFactor: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.Struct({ _tag: Schema.Literal('Manual') })
)
export type GarbageCollectionStrategy = Schema.Schema.Type<typeof GarbageCollectionStrategySchema>

// =============================================================================
// 設定値
// =============================================================================

export const MemoryLimitsSchema = Schema.Struct({
  maxTotalMemory: MemoryBytesSchema,
  warningThreshold: ResourceUsagePercentSchema,
  criticalThreshold: ResourceUsagePercentSchema,
  emergencyEvictionThreshold: ResourceUsagePercentSchema,
})
export type MemoryLimits = Schema.Schema.Type<typeof MemoryLimitsSchema>

export const PerformanceSettingsSchema = Schema.Struct({
  batchSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
  maxConcurrentOperations: Schema.Number.pipe(Schema.int(), Schema.positive()),
  gcBatchSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
  priorityUpdateInterval: DurationMsSchema,
})
export type PerformanceSettings = Schema.Schema.Type<typeof PerformanceSettingsSchema>

export const ChunkManagerConfigSchema = Schema.Struct({
  poolStrategy: PoolStrategySchema,
  gcStrategy: GarbageCollectionStrategySchema,
  memoryLimits: MemoryLimitsSchema,
  performanceSettings: PerformanceSettingsSchema,
})
export type ChunkManagerConfig = Schema.Schema.Type<typeof ChunkManagerConfigSchema>

// =============================================================================
// コンストラクタ関数
// =============================================================================

export const makeTimestamp = (value: number): Timestamp => Schema.decodeUnknownSync(TimestampSchema)(value)
export const makeDuration = (value: number): DurationMs => Schema.decodeUnknownSync(DurationMsSchema)(value)
export const makeChunkPoolId = (value: string): ChunkPoolId => Schema.decodeUnknownSync(ChunkPoolIdSchema)(value)
export const makeMemoryBytes = (value: number): MemoryBytes => Schema.decodeUnknownSync(MemoryBytesSchema)(value)
export const makeChunkPriority = (value: number): ChunkPriority => Schema.decodeUnknownSync(ChunkPrioritySchema)(value)
export const makeGCInterval = (value: number): GCInterval => Schema.decodeUnknownSync(GCIntervalSchema)(value)
export const makeResourceUsagePercent = (value: number): ResourceUsagePercent =>
  Schema.decodeUnknownSync(ResourceUsagePercentSchema)(value)
export const makeChunkLifetime = (value: number): ChunkLifetime => Schema.decodeUnknownSync(ChunkLifetimeSchema)(value)
export const makeChunkDistance = (value: number): ChunkDistance => Schema.decodeUnknownSync(ChunkDistanceSchema)(value)
export const makeMaxActiveChunks = (value: number): MaxActiveChunks =>
  Schema.decodeUnknownSync(MaxActiveChunksSchema)(value)

export const makeChunkManagerConfig = (config: ChunkManagerConfig): ChunkManagerConfig =>
  Schema.decodeUnknownSync(ChunkManagerConfigSchema)(config)

// =============================================================================
// デフォルト設定
// =============================================================================

export const DefaultChunkManagerConfig: ChunkManagerConfig = makeChunkManagerConfig({
  poolStrategy: { _tag: 'LRU', maxSize: 1024 },
  gcStrategy: {
    _tag: 'Adaptive',
    baseInterval: makeGCInterval(30_000),
    memoryThreshold: makeResourceUsagePercent(0.8),
    loadFactor: 1,
  },
  memoryLimits: {
    maxTotalMemory: makeMemoryBytes(512 * 1024 * 1024),
    warningThreshold: makeResourceUsagePercent(0.7),
    criticalThreshold: makeResourceUsagePercent(0.85),
    emergencyEvictionThreshold: makeResourceUsagePercent(0.95),
  },
  performanceSettings: {
    batchSize: 16,
    maxConcurrentOperations: 4,
    gcBatchSize: 64,
    priorityUpdateInterval: makeDuration(5_000),
  },
})
