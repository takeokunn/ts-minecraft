import { Data, Equal, Hash, Schema } from 'effect'

// ============================================================================
// 基本ブランド型
// ============================================================================

export const EpochMillisecondsSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.brand('EpochMilliseconds')
)

export type EpochMilliseconds = Schema.Schema.Type<typeof EpochMillisecondsSchema>

// ChunkIdは専用value_objectから再エクスポート
export { ChunkIdSchema, type ChunkId } from '@domain/chunk/value_object/chunk_id'

export const RequestIdSchema = Schema.UUID.pipe(Schema.brand('RequestId'))

export type RequestId = Schema.Schema.Type<typeof RequestIdSchema>

export const StrategyIdSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(64),
  Schema.brand('StrategyId')
)

export type StrategyId = Schema.Schema.Type<typeof StrategyIdSchema>

export const BudgetIdSchema = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(64), Schema.brand('BudgetId'))

export type BudgetId = Schema.Schema.Type<typeof BudgetIdSchema>

export const TickSchema = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0), Schema.brand('Tick'))

export type Tick = Schema.Schema.Type<typeof TickSchema>

// ============================================================================
// Enum型
// ============================================================================

export const ChunkPrioritySchema = Schema.Literal('critical', 'high', 'normal', 'low')

export type ChunkPriority = Schema.Schema.Type<typeof ChunkPrioritySchema>

export const ChunkActionSchema = Schema.Literal('load', 'warmup', 'unload')

export type ChunkAction = Schema.Schema.Type<typeof ChunkActionSchema>

export const BudgetStrategySchema = Schema.Literal('strict', 'adaptive', 'burst')

export type BudgetStrategy = Schema.Schema.Type<typeof BudgetStrategySchema>

// ============================================================================
// 値オブジェクト
// ============================================================================

export const ResourceBudgetSchema = Schema.Struct({
  id: BudgetIdSchema,
  strategy: BudgetStrategySchema,
  maxConcurrent: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  maxMemoryMiB: Schema.Number.pipe(Schema.positive()),
  maxBandwidthMbps: Schema.Number.pipe(Schema.positive()),
})

export type ResourceBudget = Schema.Schema.Type<typeof ResourceBudgetSchema>

export const PerformanceWindowSchema = Schema.Struct({
  windowMs: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  rollingAverage: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  percentile95: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
})

export type PerformanceWindow = Schema.Schema.Type<typeof PerformanceWindowSchema>

export const ThroughputSummarySchema = Schema.Struct({
  operationsPerSecond: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  successRatio: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1)),
})

export type ThroughputSummary = Schema.Schema.Type<typeof ThroughputSummarySchema>

export const PerformanceSnapshotSchema = Schema.Struct({
  capturedAt: EpochMillisecondsSchema,
  window: PerformanceWindowSchema,
  throughput: ThroughputSummarySchema,
})

export type PerformanceSnapshot = Schema.Schema.Type<typeof PerformanceSnapshotSchema>

export const ChunkRequestSchema = Schema.Struct({
  id: RequestIdSchema,
  chunk: ChunkIdSchema,
  priority: ChunkPrioritySchema,
  action: ChunkActionSchema,
  createdAt: EpochMillisecondsSchema,
  deadline: EpochMillisecondsSchema,
}).pipe(
  Schema.filter((request) => request.createdAt <= request.deadline, {
    message: () => 'createdAt must be earlier than or equal to deadline',
    identifier: 'ChunkRequestDeadline',
  })
)

export type ChunkRequest = Schema.Schema.Type<typeof ChunkRequestSchema>

// ============================================================================
// ドメイン状態
// ============================================================================

export const ChunkSystemStateSchema = Schema.Struct({
  active: Schema.Array(ChunkRequestSchema),
  delayed: Schema.Array(ChunkRequestSchema),
  budget: ResourceBudgetSchema,
  strategy: StrategyIdSchema,
  performance: PerformanceSnapshotSchema,
  tick: TickSchema,
})

export type ChunkSystemState = Schema.Schema.Type<typeof ChunkSystemStateSchema>

// ============================================================================
// ドメインエラー
// ============================================================================

export interface ChunkSystemErrorTags extends Record<string, Data.Case & Hash.Hash & Equal.Equal> {}

export const ChunkSystemError = Data.taggedEnum({
  ResourceBudgetExceeded: Data.tagged<{
    readonly _tag: 'ResourceBudgetExceeded'
    readonly request: ChunkRequest
    readonly budget: ResourceBudget
  }>('ResourceBudgetExceeded'),
  RequestNotFound: Data.tagged<{ readonly _tag: 'RequestNotFound'; readonly id: RequestId }>('RequestNotFound'),
  RepositoryFailure: Data.tagged<{
    readonly _tag: 'RepositoryFailure'
    readonly reason: string
  }>('RepositoryFailure'),
  InvalidTransition: Data.tagged<{
    readonly _tag: 'InvalidTransition'
    readonly from: readonly ChunkRequest[]
    readonly to: readonly ChunkRequest[]
  }>('InvalidTransition'),
  ValidationError: Data.tagged<{
    readonly _tag: 'ValidationError'
    readonly message: string
  }>('ValidationError'),
})

export type ChunkSystemError = Data.taggedEnum.Infer<typeof ChunkSystemError>

// ============================================================================
// 設定
// ============================================================================

export const ChunkSystemConfigSchema = Schema.Struct({
  initialBudget: ResourceBudgetSchema,
  initialStrategy: StrategyIdSchema,
  performanceWindow: PerformanceWindowSchema,
})

export type ChunkSystemConfig = Schema.Schema.Type<typeof ChunkSystemConfigSchema>

// ============================================================================
// ドメインイベント
// ============================================================================

export const ChunkEvent = Data.taggedEnum({
  RequestQueued: Data.tagged<{
    readonly _tag: 'RequestQueued'
    readonly request: ChunkRequest
  }>('RequestQueued'),
  RequestCompleted: Data.tagged<{
    readonly _tag: 'RequestCompleted'
    readonly requestId: RequestId
    readonly completedAt: EpochMilliseconds
  }>('RequestCompleted'),
  RequestFailed: Data.tagged<{
    readonly _tag: 'RequestFailed'
    readonly requestId: RequestId
    readonly occurredAt: EpochMilliseconds
    readonly reason: string
  }>('RequestFailed'),
  StrategyShifted: Data.tagged<{
    readonly _tag: 'StrategyShifted'
    readonly strategy: StrategyId
    readonly decidedAt: EpochMilliseconds
  }>('StrategyShifted'),
  BudgetChanged: Data.tagged<{
    readonly _tag: 'BudgetChanged'
    readonly budget: ResourceBudget
    readonly effectiveAt: EpochMilliseconds
  }>('BudgetChanged'),
})

export type ChunkEvent = Data.taggedEnum.Infer<typeof ChunkEvent>

// ============================================================================
// ドメインコマンド
// ============================================================================

export const ChunkCommand = Data.taggedEnum({
  Schedule: Data.tagged<{
    readonly _tag: 'Schedule'
    readonly request: ChunkRequest
  }>('Schedule'),
  Complete: Data.tagged<{
    readonly _tag: 'Complete'
    readonly requestId: RequestId
    readonly completedAt: EpochMilliseconds
  }>('Complete'),
  Fail: Data.tagged<{
    readonly _tag: 'Fail'
    readonly requestId: RequestId
    readonly occurredAt: EpochMilliseconds
    readonly reason: string
  }>('Fail'),
  Reprioritize: Data.tagged<{
    readonly _tag: 'Reprioritize'
    readonly requestId: RequestId
    readonly newPriority: ChunkPriority
  }>('Reprioritize'),
  SwitchStrategy: Data.tagged<{
    readonly _tag: 'SwitchStrategy'
    readonly strategy: StrategyId
    readonly decidedAt: EpochMilliseconds
  }>('SwitchStrategy'),
})

export type ChunkCommand = Data.taggedEnum.Infer<typeof ChunkCommand>
