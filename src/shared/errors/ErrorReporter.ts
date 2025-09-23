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
      Option.fromNullable(error),
      Option.filter((e: any): e is object => typeof e === 'object'),
      Option.filter((e: any): e is { _tag: string; message?: string; [key: string]: unknown } => '_tag' in e),
      Option.match({
        onNone: () => String(error),
        onSome: (taggedError) =>
          JSON.stringify(
            {
              type: taggedError._tag,
              message: taggedError.message,
              details: taggedError,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
      })
    ),

  /**
   * エラースタックトレースを取得
   */
  getStackTrace: (error: unknown): string | undefined =>
    pipe(
      Match.value(error),
      Match.when(
        (e: any): e is Error => e instanceof Error,
        (e: any) => e.stack
      ),
      Match.when(
        (e: any): e is { stack: unknown } => e !== null && typeof e === 'object' && 'stack' in e,
        (e: any) => String(e.stack)
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
          onSome: (c: unknown) => chain.push(c),
        })
      )
    }

    return chain
  },
}
