import { Effect, Schedule, Duration, Either } from 'effect'

// ゲームエラー
export * from './GameErrors'

// ネットワークエラー
export * from './NetworkErrors'

// 全エラータイプのインポート
import type { AnyGameError } from './GameErrors'
import type { AnyNetworkError } from './NetworkErrors'

// 全エラータイプのユニオン型
export type AllErrors = AnyGameError | AnyNetworkError

/**
 * エラーリカバリー戦略
 */
export const ErrorRecovery = {
  /**
   * 指数バックオフによるリトライ
   * ネットワークエラーや一時的な失敗に対して使用
   */
  exponentialBackoff: (maxRetries: number = 3, baseDelay: Duration.DurationInput = Duration.seconds(1)) => {
    const exponential = Schedule.exponential(baseDelay)
    const jittered = Schedule.jittered(exponential)
    const capped = Schedule.whileOutput(jittered, Duration.lessThanOrEqualTo(Duration.seconds(30)))
    return Schedule.intersect(capped, Schedule.recurs(maxRetries))
  },

  /**
   * 線形リトライ
   * 均等な間隔でのリトライが必要な場合
   */
  linearRetry: (maxRetries: number = 3, delay: Duration.DurationInput = Duration.seconds(1)) =>
    Schedule.intersect(Schedule.spaced(delay), Schedule.recurs(maxRetries)),

  /**
   * 即座にリトライ
   * 軽微なエラーに対して使用
   */
  immediateRetry: (maxRetries: number = 1) => Schedule.recurs(maxRetries),

  /**
   * 条件付きリトライ
   * 特定のエラータイプのみリトライ
   */
  conditionalRetry: <Out, In, R>(shouldRetry: (error: In) => boolean, schedule: Schedule.Schedule<Out, In, R>) =>
    Schedule.whileInput(schedule, shouldRetry),

  /**
   * サーキットブレーカーパターン
   * 連続した失敗後に一定期間リクエストを遮断
   */
  circuitBreaker: (failureThreshold: number = 5, resetDelay: Duration.DurationInput = Duration.seconds(60)) => {
    let failureCount = 0
    let lastFailureTime: number | null = null
    let circuitOpen = false

    return <R, E, A>(effect: Effect.Effect<A, E, R>) =>
      Effect.gen(function* (_) {
        const now = Date.now()

        // サーキットがオープンの場合、リセット時間をチェック
        if (circuitOpen && lastFailureTime) {
          const resetTime = Duration.toMillis(resetDelay)
          if (now - lastFailureTime > resetTime) {
            circuitOpen = false
            failureCount = 0
          } else {
            return yield* _(Effect.fail(new Error('Circuit breaker is open')) as Effect.Effect<never, E>)
          }
        }

        // エフェクトを実行
        return yield* _(
          effect.pipe(
            Effect.tapError(() =>
              Effect.sync(() => {
                failureCount++
                lastFailureTime = now
                if (failureCount >= failureThreshold) {
                  circuitOpen = true
                }
              })
            ),
            Effect.tap(() =>
              Effect.sync(() => {
                failureCount = 0
                circuitOpen = false
              })
            )
          )
        )
      })
  },
}

/**
 * エラーハンドリングユーティリティ
 */
export const ErrorHandlers = {
  /**
   * エラーをログに記録してフォールバック値を返す
   */
  logAndFallback:
    <E, A>(fallbackValue: A, logger?: (error: E) => void) =>
    (error: E) => {
      if (logger) {
        logger(error)
      } else {
        console.error('Error occurred:', error)
      }
      return Effect.succeed(fallbackValue)
    },

  /**
   * エラーを変換
   */
  mapError:
    <E1, E2>(mapper: (error: E1) => E2) =>
    (error: E1) =>
      Effect.fail(mapper(error)),

  /**
   * 部分的な成功を許可
   */
  partial: <R, E, A>(effects: Array<Effect.Effect<A, E, R>>, minSuccess: number = 1) =>
    Effect.gen(function* (_) {
      const results = yield* _(
        Effect.all(
          effects.map((e) => Effect.either(e)),
          { concurrency: 'unbounded' }
        )
      )

      const successes = results.filter((r) => r._tag === 'Right')

      if (successes.length >= minSuccess) {
        return successes.map((r) => (Either.isRight(r) ? r.right : undefined)).filter((v): v is A => v !== undefined)
      } else {
        return yield* _(
          Effect.fail(new Error(`Minimum success requirement not met: ${successes.length}/${minSuccess}`))
        ) as Effect.Effect<never, E>
      }
    }),

  /**
   * タイムアウト付き実行
   */
  withTimeout: <TimeoutError>(duration: Duration.DurationInput, onTimeout: () => TimeoutError) => {
    return <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | TimeoutError, R> =>
      Effect.timeoutFail({
        duration,
        onTimeout,
      })(effect)
  },
}

/**
 * エラーレポート用のヘルパー
 */
export const ErrorReporter = {
  /**
   * エラーを構造化された形式でフォーマット
   */
  format: (error: unknown): string => {
    if (error && typeof error === 'object' && '_tag' in error) {
      const e = error as { _tag: string; message?: string; [key: string]: unknown }
      return JSON.stringify(
        {
          type: e._tag,
          message: e.message,
          details: e,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    }
    return String(error)
  },

  /**
   * エラースタックトレースを取得
   */
  getStackTrace: (error: unknown): string | undefined => {
    if (error instanceof Error) {
      return error.stack
    }
    if (error && typeof error === 'object' && 'stack' in error) {
      return String(error.stack)
    }
    return undefined
  },

  /**
   * エラーの原因チェーンを取得
   */
  getCauseChain: (error: unknown): unknown[] => {
    const chain: unknown[] = [error]
    let current = error

    while (current && typeof current === 'object' && 'cause' in current) {
      const withCause = current as { cause?: unknown }
      current = withCause.cause
      if (current) {
        chain.push(current)
      }
    }

    return chain
  },
}

/**
 * エラーの型ガード
 */
export const ErrorGuards = {
  isGameError: (error: unknown): error is AnyGameError =>
    error !== null &&
    typeof error === 'object' &&
    '_tag' in error &&
    [
      'GameError',
      'InvalidStateError',
      'ResourceNotFoundError',
      'ValidationError',
      'PerformanceError',
      'ConfigError',
      'RenderError',
      'WorldGenerationError',
      'EntityError',
      'PhysicsError',
    ].includes((error as { _tag: string })._tag),

  isNetworkError: (error: unknown): error is AnyNetworkError =>
    error !== null &&
    typeof error === 'object' &&
    '_tag' in error &&
    [
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
    ].includes((error as { _tag: string })._tag),

  isRetryableError: (error: unknown): boolean => {
    if (!error || typeof error !== 'object' || !('_tag' in error)) {
      return false
    }

    const retryableTags = ['NetworkError', 'ConnectionError', 'TimeoutError', 'ServerError']

    return retryableTags.includes((error as { _tag: string })._tag)
  },
}
