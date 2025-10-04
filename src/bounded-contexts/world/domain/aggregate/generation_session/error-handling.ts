/**
 * @fileoverview Error Handling - エラーハンドリングシステム
 *
 * 生成セッションでのエラー処理を統合管理します。
 * - エラー分類と重要度判定
 * - リトライ戦略の実装
 * - エラー回復メカニズム
 * - 診断情報の収集
 */

import { Effect, Schema, Duration } from "effect"
import type * as GenerationErrors from "../../types/errors/generation-errors.js"

// ================================
// Error Categories
// ================================

export const ErrorCategorySchema = Schema.Literal(
  "transient",      // 一時的エラー (ネットワーク等)
  "resource",       // リソース不足
  "configuration",  // 設定エラー
  "data",          // データ不整合
  "system",        // システムエラー
  "validation",    // バリデーションエラー
  "timeout",       // タイムアウト
  "cancelled",     // キャンセル
  "unknown"        // 未分類
)

export type ErrorCategory = typeof ErrorCategorySchema.Type

// ================================
// Error Severity
// ================================

export const ErrorSeveritySchema = Schema.Literal(
  "low",      // 情報レベル
  "medium",   // 警告レベル
  "high",     // エラーレベル
  "critical"  // 致命的レベル
)

export type ErrorSeverity = typeof ErrorSeveritySchema.Type

// ================================
// Retry Strategy
// ================================

export const RetryStrategySchema = Schema.Struct({
  maxAttempts: Schema.Number.pipe(Schema.int(), Schema.between(1, 10)),
  backoffStrategy: Schema.Literal("linear", "exponential", "constant"),
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
  details: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  })),
  stackTrace: Schema.optional(Schema.String),
  timestamp: Schema.DateTimeUtc,
  context: Schema.Struct({
    sessionId: Schema.String,
    chunkCoordinate: Schema.optional(Schema.String),
    attempt: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
    operation: Schema.String,
    additionalInfo: Schema.optional(Schema.Record({
      key: Schema.String,
      value: Schema.Unknown
    })),
  }),
  resolution: Schema.optional(Schema.Struct({
    strategy: Schema.Literal("retry", "skip", "abort", "fallback"),
    appliedAt: Schema.DateTimeUtc,
    successful: Schema.Boolean,
    notes: Schema.optional(Schema.String),
  })),
})

export type SessionError = typeof SessionErrorSchema.Type

// ================================
// Error Analysis
// ================================

export const ErrorAnalysisSchema = Schema.Struct({
  totalErrors: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  errorsByCategory: Schema.Record({
    key: ErrorCategorySchema,
    value: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
  }),
  errorsBySeverity: Schema.Record({
    key: ErrorSeveritySchema,
    value: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
  }),
  mostCommonError: Schema.optional(Schema.Struct({
    code: Schema.String,
    message: Schema.String,
    occurrences: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  })),
  errorRate: Schema.Number.pipe(Schema.between(0, 1)),
  criticalErrorCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  recentErrorTrend: Schema.Literal("increasing", "decreasing", "stable"),
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
): SessionError => {
  const now = new Date()
  const errorId = `err_${now.getTime()}_${Math.random().toString(36).substr(2, 9)}`

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
}

/**
 * リトライ判定
 */
export const shouldRetryBatch = (
  retryStrategy: RetryStrategy,
  error: SessionError
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    // 最大試行回数チェック
    if (error.context.attempt >= retryStrategy.maxAttempts) {
      return false
    }

    // カテゴリベースの判定
    if (!retryStrategy.retryableCategories.includes(error.category)) {
      return false
    }

    // 重要度による判定
    if (error.severity === "critical") {
      return false
    }

    // 特定エラーコードの判定
    const nonRetryableCodes = [
      'VALIDATION_ERROR',
      'CONFIGURATION_ERROR',
      'PERMISSION_DENIED',
      'INVALID_REQUEST',
    ]

    if (nonRetryableCodes.includes(error.code)) {
      return false
    }

    return true
  })

/**
 * リトライ遅延計算
 */
export const calculateRetryDelay = (
  retryStrategy: RetryStrategy,
  attempt: number
): Effect.Effect<number, never> =>
  Effect.gen(function* () {
    let delay: number

    switch (retryStrategy.backoffStrategy) {
      case "linear":
        delay = retryStrategy.baseDelayMs * attempt
        break
      case "exponential":
        delay = retryStrategy.baseDelayMs * Math.pow(2, attempt - 1)
        break
      case "constant":
      default:
        delay = retryStrategy.baseDelayMs
        break
    }

    // 最大遅延時間の適用
    delay = Math.min(delay, retryStrategy.maxDelayMs)

    // ジッター適用
    if (retryStrategy.jitterEnabled) {
      const jitter = Math.random() * 0.1 * delay // 最大10%のジッター
      delay += jitter
    }

    return Math.round(delay)
  })

/**
 * エラー分析実行
 */
export const analyzeErrors = (
  errors: readonly SessionError[]
): Effect.Effect<ErrorAnalysis, never> =>
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

    // エラーコード別集計
    const errorCounts: Record<string, number> = {}

    for (const error of errors) {
      errorsByCategory[error.category]++
      errorsBySeverity[error.severity]++

      errorCounts[error.code] = (errorCounts[error.code] || 0) + 1
    }

    // 最頻出エラー
    let mostCommonError: ErrorAnalysis['mostCommonError']
    if (Object.keys(errorCounts).length > 0) {
      const [code, occurrences] = Object.entries(errorCounts)
        .reduce((max, current) => current[1] > max[1] ? current : max)

      const sampleError = errors.find(e => e.code === code)
      if (sampleError) {
        mostCommonError = {
          code,
          message: sampleError.message,
          occurrences,
        }
      }
    }

    // エラー率計算 (仮の総操作数を使用)
    const assumedTotalOperations = Math.max(totalErrors * 2, 100)
    const errorRate = totalErrors / assumedTotalOperations

    // 致命的エラー数
    const criticalErrorCount = errorsBySeverity.critical

    // 最近のエラートレンド分析
    const recentErrorTrend = analyzeErrorTrend(errors)

    return {
      totalErrors,
      errorsByCategory,
      errorsBySeverity,
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
): Effect.Effect<{
  strategy: 'retry' | 'skip' | 'abort' | 'fallback'
  reason: string
  confidence: number
}, never> =>
  Effect.gen(function* () {
    // 重要度による判定
    if (error.severity === "critical") {
      return {
        strategy: 'abort',
        reason: 'Critical error detected - aborting session',
        confidence: 0.9,
      }
    }

    // カテゴリによる判定
    switch (error.category) {
      case "transient":
        return {
          strategy: 'retry',
          reason: 'Transient error - likely to succeed on retry',
          confidence: 0.8,
        }

      case "resource":
        if (analysis.errorsByCategory.resource > 5) {
          return {
            strategy: 'abort',
            reason: 'Multiple resource errors - system may be overloaded',
            confidence: 0.7,
          }
        }
        return {
          strategy: 'retry',
          reason: 'Resource error - may be temporary',
          confidence: 0.6,
        }

      case "configuration":
        return {
          strategy: 'abort',
          reason: 'Configuration error - manual intervention required',
          confidence: 0.9,
        }

      case "validation":
        return {
          strategy: 'skip',
          reason: 'Validation error - skip invalid chunk',
          confidence: 0.8,
        }

      case "timeout":
        return {
          strategy: 'retry',
          reason: 'Timeout error - may succeed with retry',
          confidence: 0.7,
        }

      default:
        return {
          strategy: 'retry',
          reason: 'Unknown error category - trying retry',
          confidence: 0.5,
        }
    }
  })

// ================================
// Helper Functions
// ================================

/**
 * エラー分類
 */
const categorizeError = (error: GenerationErrors.GenerationError): ErrorCategory => {
  const message = error.message.toLowerCase()
  const code = error.code?.toLowerCase() || ''

  if (code.includes('timeout') || message.includes('timeout')) {
    return 'timeout'
  }

  if (code.includes('network') || message.includes('network') ||
      code.includes('connection') || message.includes('connection')) {
    return 'transient'
  }

  if (code.includes('memory') || message.includes('memory') ||
      code.includes('resource') || message.includes('resource')) {
    return 'resource'
  }

  if (code.includes('validation') || message.includes('validation') ||
      code.includes('invalid') || message.includes('invalid')) {
    return 'validation'
  }

  if (code.includes('config') || message.includes('config')) {
    return 'configuration'
  }

  if (code.includes('data') || message.includes('data') ||
      code.includes('corruption') || message.includes('corruption')) {
    return 'data'
  }

  if (code.includes('cancel') || message.includes('cancel')) {
    return 'cancelled'
  }

  if (code.includes('system') || message.includes('system')) {
    return 'system'
  }

  return 'unknown'
}

/**
 * 重要度判定
 */
const determineSeverity = (
  error: GenerationErrors.GenerationError,
  category: ErrorCategory
): ErrorSeverity => {
  // カテゴリベースの重要度
  switch (category) {
    case 'critical':
    case 'system':
      return 'critical'

    case 'configuration':
    case 'data':
      return 'high'

    case 'resource':
    case 'timeout':
      return 'medium'

    case 'transient':
    case 'validation':
      return 'low'

    default:
      return 'medium'
  }
}

/**
 * エラートレンド分析
 */
const analyzeErrorTrend = (
  errors: readonly SessionError[]
): 'increasing' | 'decreasing' | 'stable' => {
  if (errors.length < 4) return 'stable'

  // 最近のエラーを時間順にソート
  const sortedErrors = [...errors].sort((a, b) =>
    a.timestamp.getTime() - b.timestamp.getTime()
  )

  // 前半と後半で比較
  const midpoint = Math.floor(sortedErrors.length / 2)
  const firstHalf = sortedErrors.slice(0, midpoint)
  const secondHalf = sortedErrors.slice(midpoint)

  if (secondHalf.length > firstHalf.length * 1.5) {
    return 'increasing'
  } else if (secondHalf.length < firstHalf.length * 0.5) {
    return 'decreasing'
  } else {
    return 'stable'
  }
}

// ================================
// Exports
// ================================

export {
  type ErrorCategory,
  type ErrorSeverity,
  type RetryStrategy,
  type ErrorAnalysis,
}