import { Schema } from 'effect'
import { ChunkIdSchema } from '@domain/chunk/value_object/chunk_id/types'
import type { ChunkId } from '@domain/chunk/value_object/chunk_id/types'
import {
  ChunkLifetimeSchema,
  ChunkPoolIdSchema,
  MaxActiveChunksSchema,
  MemoryBytesSchema,
  ResourceUsagePercentSchema,
  type ChunkLifetime,
  type ChunkPoolId,
  type MemoryBytes,
  type ResourceUsagePercent,
} from './core'

// =============================================================================
// 失敗理由（ADT）
// =============================================================================

export const ActivationFailureSchema = Schema.Union(
  Schema.Struct({ _tag: Schema.Literal('AlreadyActive') }),
  Schema.Struct({
    _tag: Schema.Literal('PoolLimitReached'),
    activeCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    maxActive: MaxActiveChunksSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('MemoryPressure'),
    current: ResourceUsagePercentSchema,
    threshold: ResourceUsagePercentSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('LifecycleViolation'),
    stage: Schema.String,
  })
)
export type ActivationFailure = Schema.Schema.Type<typeof ActivationFailureSchema>

export const DeactivationFailureSchema = Schema.Union(
  Schema.Struct({ _tag: Schema.Literal('NotActive') }),
  Schema.Struct({
    _tag: Schema.Literal('ProtectedChunk'),
    reason: Schema.String.pipe(Schema.minLength(1)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('LifecycleViolation'),
    stage: Schema.String,
  })
)
export type DeactivationFailure = Schema.Schema.Type<typeof DeactivationFailureSchema>

export const ConfigurationFailureSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('InvalidDistance'),
    activationDistance: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    deactivationDistance: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('InvalidThreshold'),
    memoryThreshold: ResourceUsagePercentSchema,
    performanceThreshold: ResourceUsagePercentSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('MaxActiveTooSmall'),
    requested: MaxActiveChunksSchema,
    minimumRequired: MaxActiveChunksSchema,
  })
)
export type ConfigurationFailure = Schema.Schema.Type<typeof ConfigurationFailureSchema>

export const PoolMetricsFailureSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('NegativeMemory'),
    invalidUsage: MemoryBytesSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('InvalidCounts'),
    total: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    active: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    inactive: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  })
)
export type PoolMetricsFailure = Schema.Schema.Type<typeof PoolMetricsFailureSchema>

export const LifecycleStatsFailureSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('NegativeCounts'),
    activations: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    deactivations: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('InvalidLifetime'),
    lifetime: ChunkLifetimeSchema,
  })
)
export type LifecycleStatsFailure = Schema.Schema.Type<typeof LifecycleStatsFailureSchema>

// =============================================================================
// ドメインエラー
// =============================================================================

export const ActivationErrorSchema = Schema.Struct({
  _tag: Schema.Literal('ActivationError'),
  chunkId: ChunkIdSchema,
  failure: ActivationFailureSchema,
})
export type ActivationError = Schema.Schema.Type<typeof ActivationErrorSchema>

export const DeactivationErrorSchema = Schema.Struct({
  _tag: Schema.Literal('DeactivationError'),
  chunkId: ChunkIdSchema,
  failure: DeactivationFailureSchema,
})
export type DeactivationError = Schema.Schema.Type<typeof DeactivationErrorSchema>

export const ConfigErrorSchema = Schema.Struct({
  _tag: Schema.Literal('ConfigError'),
  failure: ConfigurationFailureSchema,
})
export type ConfigError = Schema.Schema.Type<typeof ConfigErrorSchema>

export const PoolOperationErrorSchema = Schema.Struct({
  _tag: Schema.Literal('PoolOperationError'),
  poolId: ChunkPoolIdSchema,
  message: Schema.String.pipe(Schema.minLength(1)),
})
export type PoolOperationError = Schema.Schema.Type<typeof PoolOperationErrorSchema>

export const PoolMetricsErrorSchema = Schema.Struct({
  _tag: Schema.Literal('PoolMetricsError'),
  failure: PoolMetricsFailureSchema,
})
export type PoolMetricsError = Schema.Schema.Type<typeof PoolMetricsErrorSchema>

export const LifecycleStatsErrorSchema = Schema.Struct({
  _tag: Schema.Literal('LifecycleStatsError'),
  failure: LifecycleStatsFailureSchema,
})
export type LifecycleStatsError = Schema.Schema.Type<typeof LifecycleStatsErrorSchema>

export type ChunkManagerDomainError =
  | ActivationError
  | DeactivationError
  | ConfigError
  | PoolOperationError
  | PoolMetricsError
  | LifecycleStatsError

// =============================================================================
// ヘルパーコンストラクタ
// =============================================================================

export const makeActivationError = (chunkId: ChunkId, failure: ActivationFailure): ActivationError => ({
  _tag: 'ActivationError',
  chunkId,
  failure,
})

export const makeDeactivationError = (chunkId: ChunkId, failure: DeactivationFailure): DeactivationError => ({
  _tag: 'DeactivationError',
  chunkId,
  failure,
})

export const makeConfigError = (failure: ConfigurationFailure): ConfigError => ({
  _tag: 'ConfigError',
  failure,
})

export const makePoolOperationError = (poolId: ChunkPoolId, message: string): PoolOperationError => ({
  _tag: 'PoolOperationError',
  poolId,
  message,
})

export const makePoolMetricsError = (failure: PoolMetricsFailure): PoolMetricsError => ({
  _tag: 'PoolMetricsError',
  failure,
})

export const makeLifecycleStatsError = (failure: LifecycleStatsFailure): LifecycleStatsError => ({
  _tag: 'LifecycleStatsError',
  failure,
})

export type {
  ChunkId,
  ChunkLifetime,
  ChunkPoolId,
  MemoryBytes,
  ResourceUsagePercent,
}
