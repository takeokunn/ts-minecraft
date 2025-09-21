import { Option, Match, pipe } from 'effect'

/**
 * エラーレポート用のヘルパー
 */
export const ErrorReporter = {
  /**
   * エラーを構造化された形式でフォーマット
   */
  format: (error: unknown): string =>
    pipe(
      Match.value(error),
      Match.when(
        (e): e is { _tag: string; message?: string; [key: string]: unknown } =>
          e !== null && typeof e === 'object' && '_tag' in e,
        (e) =>
          JSON.stringify(
            {
              type: e._tag,
              message: e.message,
              details: e,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          )
      ),
      Match.orElse((e) => String(e))
    ),

  /**
   * エラースタックトレースを取得
   */
  getStackTrace: (error: unknown): string | undefined =>
    pipe(
      Match.value(error),
      Match.when(
        (e): e is Error => e instanceof Error,
        (e) => e.stack
      ),
      Match.when(
        (e): e is { stack: unknown } => e !== null && typeof e === 'object' && 'stack' in e,
        (e) => String(e.stack)
      ),
      Match.orElse(() => undefined)
    ),

  /**
   * エラーの原因チェーンを取得
   */
  getCauseChain: (error: unknown): unknown[] => {
    const chain: unknown[] = [error]
    let current = error

    while (current && typeof current === 'object' && 'cause' in current) {
      const withCause = current as { cause?: unknown }
      current = withCause.cause
      pipe(
        Option.fromNullable(current),
        Option.match({
          onNone: () => {},
          onSome: (c) => chain.push(c)
        })
      )
    }

    return chain
  },
}