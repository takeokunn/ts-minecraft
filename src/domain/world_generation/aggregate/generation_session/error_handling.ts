/**
 * @fileoverview Error Handling - エラーハンドリングシステム
 *
 * 生成セッションでのエラー処理を統合管理します。
 * - エラー分類と重要度判定
 * - リトライ戦略の実装
 * - エラー回復メカニズム
 * - 診断情報の収集
 */

import type * as GenerationErrors from '@domain/world/types/errors'
import { JsonValueSchema } from '@shared/schema/json'
import { DateTime, Effect, Match, pipe, Random, Schema } from 'effect'

// ================================
// Error Categories
// ================================

export const ErrorCategorySchema = Schema.Literal(
  'transient', // 一時的エラー (ネットワーク等)
  'resource', // リソース不足
  'configuration', // 設定エラー
  'data', // データ不整合
  'system', // システムエラー
  'validation', // バリデーションエラー
  'timeout', // タイムアウト
  'cancelled', // キャンセル
  'unknown' // 未分類
)

export type ErrorCategory = typeof ErrorCategorySchema.Type

// ================================
// Error Severity
// ================================

export const ErrorSeveritySchema = Schema.Literal(
  'low', // 情報レベル
  'medium', // 警告レベル
  'high', // エラーレベル
  'critical' // 致命的レベル
)

export type ErrorSeverity = typeof ErrorSeveritySchema.Type

// ================================
// Retry Strategy
// ================================

export const RetryStrategySchema = Schema.Struct({
  maxAttempts: Schema.Number.pipe(Schema.int(), Schema.between(1, 10)),
  backoffStrategy: Schema.Literal('linear', 'exponential', 'constant'),
  baseDelayMs: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  maxDelayMs: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  jitterEnabled: Schema.Boolean,
  retryableCategories: Schema.Array(ErrorCategorySchema),
})

export type RetryStrategy = typeof RetryStrategySchema.Type

// ================================
// Session Error
// ================================

export const SessionErrorSchema = Schema.Struct({
  id: Schema.String,
  batchId: Schema.optional(Schema.String),
  category: ErrorCategorySchema,
  severity: ErrorSeveritySchema,
  code: Schema.String,
  message: Schema.String,
  details: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: JsonValueSchema,
    })
  ),
  stackTrace: Schema.optional(Schema.String),
  timestamp: Schema.DateTimeUtc,
  context: Schema.Struct({
    sessionId: Schema.String,
    chunkCoordinate: Schema.optional(Schema.String),
    attempt: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
    operation: Schema.String,
    additionalInfo: Schema.optional(
      Schema.Record({
        key: Schema.String,
        value: JsonValueSchema,
      })
    ),
  }),
  resolution: Schema.optional(
    Schema.Struct({
      strategy: Schema.Literal('retry', 'skip', 'abort', 'fallback'),
      appliedAt: Schema.DateTimeUtc,
      successful: Schema.Boolean,
      notes: Schema.optional(Schema.String),
    })
  ),
})

export type SessionError = typeof SessionErrorSchema.Type

// ================================
// Error Analysis
// ================================

export const ErrorAnalysisSchema = Schema.Struct({
  totalErrors: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  errorsByCategory: Schema.Record({
    key: ErrorCategorySchema,
    value: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  }),
  errorsBySeverity: Schema.Record({
    key: ErrorSeveritySchema,
    value: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  }),
  mostCommonError: Schema.optional(
    Schema.Struct({
      code: Schema.String,
      message: Schema.String,
      occurrences: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
    })
  ),
  errorRate: Schema.Number.pipe(Schema.between(0, 1)),
  criticalErrorCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  recentErrorTrend: Schema.Literal('increasing', 'decreasing', 'stable'),
})

export type ErrorAnalysis = typeof ErrorAnalysisSchema.Type

// ================================
// Error Operations
// ================================

/**
 * セッションエラー作成
 */
export const createSessionError = (
  error: GenerationErrors.GenerationError,
  batchId?: string,
  context?: Partial<SessionError['context']>
): Effect.Effect<SessionError> =>
  Effect.gen(function* () {
    const now = DateTime.toDate(DateTime.unsafeNow())
    // Random Serviceで決定的なID生成（ランタイム起動時のシード依存）
    const randomValue = yield* Random.nextIntBetween(0, 2176782336) // 36^6
    const randomStr = randomValue.toString(36).padStart(6, '0')
    const errorId = `err_${now.getTime()}_${randomStr}`

    // エラー分類
    const category = categorizeError(error)
    const severity = determineSeverity(error, category)

    return {
      id: errorId,
      batchId,
      category,
      severity,
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      details: error.details,
      stackTrace: error.stack,
      timestamp: now,
      context: {
        sessionId: context?.sessionId || '',
        chunkCoordinate: context?.chunkCoordinate,
        attempt: context?.attempt || 1,
        operation: context?.operation || 'unknown',
        additionalInfo: context?.additionalInfo,
      },
    }
  })

/**
 * リトライ判定
 */
export const shouldRetryBatch = (retryStrategy: RetryStrategy, error: SessionError): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const nonRetryableCodes = ['VALIDATION_ERROR', 'CONFIGURATION_ERROR', 'PERMISSION_DENIED', 'INVALID_REQUEST']

    // 4つのif文 → 単一のpipe + 論理演算
    return pipe(
      {
        maxAttemptsExceeded: error.context.attempt >= retryStrategy.maxAttempts,
        categoryNotRetryable: !retryStrategy.retryableCategories.includes(error.category),
        isCritical: error.severity === 'critical',
        hasNonRetryableCode: nonRetryableCodes.includes(error.code),
      },
      ({ maxAttemptsExceeded, categoryNotRetryable, isCritical, hasNonRetryableCode }) =>
        !(maxAttemptsExceeded || categoryNotRetryable || isCritical || hasNonRetryableCode)
    )
  })

/**
 * リトライ遅延計算
 */
export const calculateRetryDelay = (retryStrategy: RetryStrategy, attempt: number): Effect.Effect<number, never> =>
  Effect.gen(function* () {
    // switch文 → Match.value
    const delay = pipe(
      retryStrategy.backoffStrategy,
      Match.value,
      Match.when(
        (s) => s === 'linear',
        () => retryStrategy.baseDelayMs * attempt
      ),
      Match.when(
        (s) => s === 'exponential',
        () => retryStrategy.baseDelayMs * Math.pow(2, attempt - 1)
      ),
      Match.orElse(() => retryStrategy.baseDelayMs)
    )

    // 最大遅延時間の適用
    const cappedDelay = Math.min(delay, retryStrategy.maxDelayMs)

    // ジッター適用（if文 → 三項演算子）
    const jitterValue = yield* Random.nextIntBetween(0, 100)
    const finalDelay = retryStrategy.jitterEnabled
      ? cappedDelay + (jitterValue / 1000) * cappedDelay // 最大10%のジッター
      : cappedDelay

    return Math.round(finalDelay)
  })

/**
 * エラー分析実行
 */
export const analyzeErrors = (errors: readonly SessionError[]): Effect.Effect<ErrorAnalysis, never> =>
  Effect.gen(function* () {
    const totalErrors = errors.length

    // カテゴリ別集計
    const errorsByCategory: Record<ErrorCategory, number> = {
      transient: 0,
      resource: 0,
      configuration: 0,
      data: 0,
      system: 0,
      validation: 0,
      timeout: 0,
      cancelled: 0,
      unknown: 0,
    }

    // 重要度別集計
    const errorsBySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    }

    // エラーコード別集計（for → ReadonlyArray.reduce）
    const {
      errorsByCategory: updatedByCategory,
      errorsBySeverity: updatedBySeverity,
      errorCounts,
    } = pipe(
      errors,
      ReadonlyArray.reduce(
        {
          errorsByCategory,
          errorsBySeverity,
          errorCounts: {} satisfies Record<string, number> as Record<string, number>,
        },
        (acc, error) => ({
          errorsByCategory: {
            ...acc.errorsByCategory,
            [error.category]: acc.errorsByCategory[error.category] + 1,
          },
          errorsBySeverity: {
            ...acc.errorsBySeverity,
            [error.severity]: acc.errorsBySeverity[error.severity] + 1,
          },
          errorCounts: {
            ...acc.errorCounts,
            [error.code]: (acc.errorCounts[error.code] || 0) + 1,
          },
        })
      )
    )

    // 最頻出エラー（if文 → Option.match）
    const mostCommonError = yield* pipe(
      Object.keys(errorCounts).length > 0 ? Option.some(errorCounts) : Option.none(),
      Option.match({
        onNone: () => Effect.succeed(undefined),
        onSome: (counts) =>
          Effect.gen(function* () {
            const [code, occurrences] = Object.entries(counts).reduce((max, current) =>
              current[1] > max[1] ? current : max
            )

            return yield* pipe(
              errors.find((e) => e.code === code),
              Option.fromNullable,
              Option.match({
                onNone: () => Effect.succeed(undefined),
                onSome: (sampleError) =>
                  Effect.succeed({
                    code,
                    message: sampleError.message,
                    occurrences,
                  }),
              })
            )
          }),
      })
    )

    // エラー率計算 (仮の総操作数を使用)
    const assumedTotalOperations = Math.max(totalErrors * 2, 100)
    const errorRate = totalErrors / assumedTotalOperations

    // 致命的エラー数
    const criticalErrorCount = updatedBySeverity.critical

    // 最近のエラートレンド分析
    const recentErrorTrend = analyzeErrorTrend(errors)

    return {
      totalErrors,
      errorsByCategory: updatedByCategory,
      errorsBySeverity: updatedBySeverity,
      mostCommonError,
      errorRate,
      criticalErrorCount,
      recentErrorTrend,
    }
  })

/**
 * エラー回復戦略提案
 */
export const suggestRecoveryStrategy = (
  error: SessionError,
  analysis: ErrorAnalysis
): Effect.Effect<
  {
    strategy: 'retry' | 'skip' | 'abort' | 'fallback'
    reason: string
    confidence: number
  },
  never
> =>
  pipe(
    Match.value(error.severity),
    Match.when(
      (severity) => severity === 'critical',
      () =>
        ({
          strategy: 'abort' as const,
          reason: 'Critical error detected - aborting session',
          confidence: 0.9,
        }) as const
    ),
    Match.orElse(() =>
      pipe(
        Match.value(error.category),
        Match.when(
          (c) => c === 'transient',
          () =>
            ({
              strategy: 'retry' as const,
              reason: 'Transient error - likely to succeed on retry',
              confidence: 0.8,
            }) as const
        ),
        Match.when(
          (c) => c === 'resource',
          () =>
            (analysis.errorsByCategory.resource > 5
              ? {
                  strategy: 'abort' as const,
                  reason: 'Multiple resource errors - system may be overloaded',
                  confidence: 0.7,
                }
              : {
                  strategy: 'retry' as const,
                  reason: 'Resource error - may be temporary',
                  confidence: 0.6,
                }) as const
        ),
        Match.when(
          (c) => c === 'configuration',
          () =>
            ({
              strategy: 'abort' as const,
              reason: 'Configuration error - manual intervention required',
              confidence: 0.9,
            }) as const
        ),
        Match.when(
          (c) => c === 'validation',
          () =>
            ({
              strategy: 'skip' as const,
              reason: 'Validation error - skip invalid chunk',
              confidence: 0.8,
            }) as const
        ),
        Match.when(
          (c) => c === 'timeout',
          () =>
            ({
              strategy: 'retry' as const,
              reason: 'Timeout error - may succeed with retry',
              confidence: 0.7,
            }) as const
        ),
        Match.orElse(
          () =>
            ({
              strategy: 'retry' as const,
              reason: 'Unknown error category - trying retry',
              confidence: 0.5,
            }) as const
        )
      )
    ),
    Effect.succeed
  )

// ================================
// Helper Functions
// ================================

/**
 * エラー分類
 */
const categorizeError = (error: GenerationErrors.GenerationError): ErrorCategory => {
  const message = error.message.toLowerCase()
  const code = error.code?.toLowerCase() || ''

  // if文連鎖 → Match.when連鎖
  return pipe(
    { code, message },
    Match.value,
    Match.when(
      ({ code, message }) => code.includes('timeout') || message.includes('timeout'),
      () => 'timeout' as const
    ),
    Match.when(
      ({ code, message }) =>
        code.includes('network') ||
        message.includes('network') ||
        code.includes('connection') ||
        message.includes('connection'),
      () => 'transient' as const
    ),
    Match.when(
      ({ code, message }) =>
        code.includes('memory') ||
        message.includes('memory') ||
        code.includes('resource') ||
        message.includes('resource'),
      () => 'resource' as const
    ),
    Match.when(
      ({ code, message }) =>
        code.includes('validation') ||
        message.includes('validation') ||
        code.includes('invalid') ||
        message.includes('invalid'),
      () => 'validation' as const
    ),
    Match.when(
      ({ code, message }) => code.includes('config') || message.includes('config'),
      () => 'configuration' as const
    ),
    Match.when(
      ({ code, message }) =>
        code.includes('data') ||
        message.includes('data') ||
        code.includes('corruption') ||
        message.includes('corruption'),
      () => 'data' as const
    ),
    Match.when(
      ({ code, message }) => code.includes('cancel') || message.includes('cancel'),
      () => 'cancelled' as const
    ),
    Match.when(
      ({ code, message }) => code.includes('system') || message.includes('system'),
      () => 'system' as const
    ),
    Match.orElse(() => 'unknown' as const)
  )
}

/**
 * 重要度判定
 */
const determineSeverity = (error: GenerationErrors.GenerationError, category: ErrorCategory): ErrorSeverity => {
  // switch文 → Match.value
  return pipe(
    category,
    Match.value,
    Match.when(
      (c) => c === 'critical' || c === 'system',
      () => 'critical' as const
    ),
    Match.when(
      (c) => c === 'configuration' || c === 'data',
      () => 'high' as const
    ),
    Match.when(
      (c) => c === 'resource' || c === 'timeout',
      () => 'medium' as const
    ),
    Match.when(
      (c) => c === 'transient' || c === 'validation',
      () => 'low' as const
    ),
    Match.orElse(() => 'medium' as const)
  )
}

/**
 * エラートレンド分析
 */
const analyzeErrorTrend = (errors: readonly SessionError[]): 'increasing' | 'decreasing' | 'stable' =>
  pipe(
    Match.value(errors.length),
    Match.when(
      (length) => length < 4,
      () => 'stable' as const
    ),
    Match.orElse(() => {
      const sortedErrors = [...errors].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      const midpoint = Math.floor(sortedErrors.length / 2)
      const firstHalf = sortedErrors.slice(0, midpoint)
      const secondHalf = sortedErrors.slice(midpoint)

      return pipe(
        { secondHalfLen: secondHalf.length, firstHalfLen: firstHalf.length },
        Match.value,
        Match.when(
          ({ secondHalfLen, firstHalfLen }) => secondHalfLen > firstHalfLen * 1.5,
          () => 'increasing' as const
        ),
        Match.when(
          ({ secondHalfLen, firstHalfLen }) => secondHalfLen < firstHalfLen * 0.5,
          () => 'decreasing' as const
        ),
        Match.orElse(() => 'stable' as const)
      )
    })
  )

// ================================
// Exports
// ================================

export { type ErrorAnalysis, type ErrorCategory, type ErrorSeverity, type RetryStrategy }
