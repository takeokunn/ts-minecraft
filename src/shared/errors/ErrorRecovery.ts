import { Effect, Schedule, Duration, Option, Match, pipe } from 'effect'

/**
 * エラーリカバリー戦略
 */
export const ErrorRecovery = {
  /**
   * シンプルなリトライ機能
   */
  withRetry: <A, E, R>(effect: Effect.Effect<A, E, R>, maxAttempts: number = 3): Effect.Effect<A, E, R> =>
    effect.pipe(Effect.retry(Schedule.recurs(maxAttempts - 1))),
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
        const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis)

        // サーキットがオープンの場合、リセット時間をチェック
        const shouldExecute = pipe(
          Option.fromNullable(lastFailureTime),
          Option.match({
            onNone: () => true,
            onSome: (time) =>
              pipe(
                Match.value({ circuitOpen, elapsed: now - time }),
                Match.when(
                  ({ circuitOpen, elapsed }) => !circuitOpen,
                  () => true
                ),
                Match.when(
                  ({ elapsed }) => elapsed > Duration.toMillis(resetDelay),
                  () => {
                    circuitOpen = false
                    failureCount = 0
                    return true
                  }
                ),
                Match.orElse(() => false)
              ),
          })
        )

        yield* pipe(
          shouldExecute,
          Match.value,
          Match.when(false, () => _(Effect.fail(new Error('Circuit breaker is open')) as Effect.Effect<never, E>)),
          Match.orElse(() => Effect.void)
        )

        // エフェクトを実行
        return yield* _(
          effect.pipe(
            Effect.tapError(() =>
              Effect.sync(() => {
                failureCount++
                lastFailureTime = now
                circuitOpen = failureCount >= failureThreshold
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
