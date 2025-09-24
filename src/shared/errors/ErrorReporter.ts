import { Option, Match, pipe, Effect, Either, Predicate } from 'effect'
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

// エラー統計用のカウンター
let errorStats = {
  critical: 0,
  warning: 0,
  info: 0,
  total: 0,
}

/**
 * 型安全なエラーレポート機能
 */
export const ErrorReporter = {
  /**
   * エラーをレポートする
   */
  reportError: (error: Error, severity: 'critical' | 'warning' | 'info'): Effect.Effect<void> =>
    Effect.sync(() => {
      errorStats[severity]++
      errorStats.total++
      console.error(`[${severity.toUpperCase()}]`, error.message)
    }),

  /**
   * エラー統計を取得する
   */
  getErrorStats: (): Effect.Effect<typeof errorStats> => Effect.succeed({ ...errorStats }),
  /**
   * エラーを構造化された形式でフォーマット（型安全版）
   */
  format: (error: unknown): Effect.Effect<string> =>
    Effect.sync(() =>
      pipe(
        Match.value(error),
        Match.when(Predicate.isNull, () => 'null'),
        Match.when(Predicate.isUndefined, () => 'undefined'),
        Match.when(Predicate.isString, (s) => s),
        Match.when(Predicate.isNumber, (n) => String(n)),
        Match.when(Predicate.isBoolean, (b) => String(b)),
        Match.orElse(() =>
          pipe(
            Effect.clockWith((clock) => clock.currentTimeMillis),
            Effect.map((millis) => new Date(millis).toISOString()),
            Effect.map((timestamp) => {
              const report = ErrorReporter.createErrorReport(error, timestamp)
              return JSON.stringify(report, null, 2)
            }),
            Effect.runSync
          )
        )
      )
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

    // 既知のエラー型であっても、_tagが空白や無効な場合はUnknownErrorとして扱う
    return pipe(
      Option.fromNullable(knownError),
      Option.filter((e) => e._tag && e._tag.trim() !== ''),
      Option.match({
        onNone: () => ({
          type: 'UnknownError',
          message: String(error),
          details: ErrorReporter.extractGenericDetails(error),
          timestamp,
          stackTrace: ErrorReporter.getStackTrace(error),
          category: 'unknown' as const,
        }),
        onSome: (e) => ({
          type: e._tag,
          message: e.message,
          details: ErrorReporter.extractErrorDetails(e),
          timestamp,
          stackTrace: ErrorReporter.getStackTrace(error),
          category: ErrorReporter.categorizeError(e._tag),
        }),
      })
    )
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
  extractGenericDetails: (error: unknown): Record<string, unknown> =>
    pipe(
      Match.value(error),
      Match.when(Predicate.isRecord, (obj) => {
        const { _tag, message, ...details } = obj as Record<string, unknown>
        return details
      }),
      Match.orElse(() => ({}))
    ),

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

    return pipe(
      Match.value(tag),
      Match.when(
        (t) => gameErrorTags.includes(t),
        () => 'game' as const
      ),
      Match.when(
        (t) => networkErrorTags.includes(t),
        () => 'network' as const
      ),
      Match.when(
        (t) => appErrorTags.includes(t),
        () => 'app' as const
      ),
      Match.orElse(() => 'unknown' as const)
    )
  },

  /**
   * エラースタックトレースを取得
   */
  getStackTrace: (error: unknown): string | undefined =>
    pipe(
      Match.value(error),
      Match.when(
        (e: unknown): e is Error =>
          Predicate.isRecord(e) &&
          'message' in e &&
          'name' in e &&
          Predicate.isString(e.name) &&
          Predicate.isString(e.message),
        (e: Error) => e.stack
      ),
      Match.when(
        (e: unknown): e is { stack: unknown } => Predicate.isRecord(e) && 'stack' in e,
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

    while (Predicate.isRecord(current) && 'cause' in current) {
      const withCause = current as { cause?: unknown }
      current = withCause.cause
      pipe(
        Option.fromNullable(current),
        Option.match({
          onNone: () => {
            current = undefined
          },
          onSome: (c) => {
            chain.push(c)
          },
        })
      )
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
