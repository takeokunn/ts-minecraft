import { Effect, Duration, Either, Option, Match, pipe } from 'effect'

/**
 * エラーハンドリングユーティリティ
 */
export const ErrorHandlers = {
  /**
   * エラーをログに記録してフォールバック値を返す
   */
  logAndFallback:
    <E, A>(fallbackValue: A, logger?: (error: E) => void) =>
    (error: E) =>
      pipe(
        Option.fromNullable(logger),
        Option.match({
          onNone: () => console.error('Error occurred:', error),
          onSome: (log) => log(error),
        }),
        () => Effect.succeed(fallbackValue)
      ),

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
  partial: <R, E, A>(effects: ReadonlyArray<Effect.Effect<A, E, R>>, minSuccess: number = 1) =>
    Effect.gen(function* (_) {
      const results = yield* _(
        Effect.all(
          effects.map((e) => Effect.either(e)),
          { concurrency: 'unbounded' }
        )
      )

      const successes = results.filter(Either.isRight)
      const successValues = successes.map((r) => r.right)

      return yield* pipe(
        Match.value(successes.length >= minSuccess),
        Match.when(true, () => Effect.succeed(successValues)),
        Match.orElse(() => Effect.fail(new Error(`Minimum success requirement not met: ${successes.length}/${minSuccess}`))
        )
      ) as Effect.Effect<A[], E>
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
