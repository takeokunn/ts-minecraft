import { Option, Match, pipe, Effect, Either } from 'effect'
import { Schema } from '@effect/schema'
import { GameErrorUnion, type AnyGameError } from './GameErrors'
import { NetworkErrorUnion, type AnyNetworkError } from './NetworkErrors'
import { AppErrorUnion, type AnyAppError } from '../../core/errors/AppError'

// 全エラー型の統合スキーマ
const AllErrorsUnion = Schema.Union(GameErrorUnion, NetworkErrorUnion, AppErrorUnion)
type AnyKnownError = AnyGameError | AnyNetworkError | AnyAppError

// エラーレポート用の構造化スキーマ
const ErrorReportSchema = Schema.Struct({
  type: Schema.String,
  message: Schema.String,
  details: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  timestamp: Schema.String,
  stackTrace: Schema.optional(Schema.String),
  category: Schema.Union(
    Schema.Literal('game'),
    Schema.Literal('network'),
    Schema.Literal('app'),
    Schema.Literal('unknown')
  ),
})

type ErrorReport = Schema.Schema.Type<typeof ErrorReportSchema>

/**
 * 型安全なエラーレポート機能
 */
export const ErrorReporter = {
  /**
   * エラーを構造化された形式でフォーマット（型安全版）
   */
  format: (error: unknown): Effect.Effect<string> =>
    pipe(
      Effect.clockWith((clock) => clock.currentTimeMillis),
      Effect.map((millis) => new Date(millis).toISOString()),
      Effect.map((timestamp) => {
        const report = ErrorReporter.createErrorReport(error, timestamp)
        return JSON.stringify(report, null, 2)
      })
    ),

  /**
   * エラーレポートオブジェクトの作成
   */
  createErrorReport: (error: unknown, timestamp: string): ErrorReport => {
    // まず既知のエラー型として解析を試行
    const knownError = pipe(
      Schema.decodeUnknownEither(AllErrorsUnion)(error),
      Either.match({
        onLeft: () => null,
        onRight: (validError) => validError,
      })
    )

    if (knownError) {
      return {
        type: knownError._tag,
        message: knownError.message,
        details: ErrorReporter.extractErrorDetails(knownError),
        timestamp,
        stackTrace: ErrorReporter.getStackTrace(error),
        category: ErrorReporter.categorizeError(knownError._tag),
      }
    }

    // 既知のエラー型でない場合のフォールバック
    return {
      type: 'UnknownError',
      message: String(error),
      details: ErrorReporter.extractGenericDetails(error),
      timestamp,
      stackTrace: ErrorReporter.getStackTrace(error),
      category: 'unknown' as const,
    }
  },

  /**
   * エラーの詳細情報を抽出
   */
  extractErrorDetails: (error: AnyKnownError): Record<string, unknown> => {
    const { _tag, message, ...details } = error
    return details
  },

  /**
   * 一般的なオブジェクトから詳細情報を抽出
   */
  extractGenericDetails: (error: unknown): Record<string, unknown> => {
    if (error && typeof error === 'object') {
      const obj = error as Record<string, unknown>
      const { _tag, message, ...details } = obj
      return details
    }
    return {}
  },

  /**
   * エラーのカテゴリを判定
   */
  categorizeError: (tag: string): 'game' | 'network' | 'app' | 'unknown' => {
    const gameErrorTags = [
      'GameError',
      'InvalidStateError',
      'ResourceNotFoundError',
      'ValidationError',
      'PerformanceError',
      'RenderError',
      'WorldGenerationError',
      'EntityError',
      'PhysicsError',
    ]

    const networkErrorTags = [
      'NetworkError',
      'ConnectionError',
      'TimeoutError',
      'ProtocolError',
      'AuthenticationError',
      'SessionError',
      'SyncError',
      'RateLimitError',
      'WebSocketError',
      'PacketError',
      'ServerError',
      'P2PError',
    ]

    const appErrorTags = ['InitError', 'ConfigError']

    if (gameErrorTags.includes(tag)) return 'game'
    if (networkErrorTags.includes(tag)) return 'network'
    if (appErrorTags.includes(tag)) return 'app'
    return 'unknown'
  },

  /**
   * エラースタックトレースを取得
   */
  getStackTrace: (error: unknown): string | undefined =>
    pipe(
      Match.value(error),
      Match.when(
        (e: unknown): e is Error => e instanceof Error,
        (e: Error) => e.stack
      ),
      Match.when(
        (e: unknown): e is { stack: unknown } => e !== null && typeof e === 'object' && 'stack' in e,
        (e: { stack: unknown }) => String(e.stack)
      ),
      Match.orElse(() => undefined)
    ),

  /**
   * エラーの原因チェーンを取得（型安全版）
   */
  getCauseChain: (error: unknown): unknown[] => {
    const chain: unknown[] = [error]
    let current = error

    while (current && typeof current === 'object' && 'cause' in current) {
      const withCause = current as { cause?: unknown }
      current = withCause.cause
      if (current !== undefined) {
        chain.push(current)
      } else {
        break
      }
    }

    return chain
  },

  /**
   * 既知のエラー型かどうかを判定
   */
  isKnownError: (error: unknown): error is AnyKnownError => Schema.is(AllErrorsUnion)(error),

  /**
   * Effectとの統合 - Effect.catchAndDecode
   */
  catchAndDecode: <A, E>(effect: Effect.Effect<A, E, never>): Effect.Effect<A, AnyKnownError | E, never> =>
    pipe(
      effect,
      Effect.catchAll((error) =>
        pipe(
          Schema.decodeUnknownEither(AllErrorsUnion)(error),
          Either.match({
            onLeft: () => Effect.fail(error as E),
            onRight: (knownError) => Effect.fail(knownError as AnyKnownError as E),
          })
        )
      )
    ) as Effect.Effect<A, AnyKnownError | E, never>,
}
