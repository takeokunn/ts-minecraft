import { Option, Match, pipe } from 'effect'

/**
 * エラーレポート用のヘルパー
 */
export const ErrorReporter = {
  /**
   * エラーを構造化された形式でフォーマット
   */
  format: (error: unknown): string => {
    if (error !== null && typeof error === 'object' && '_tag' in error) {
      const taggedError = error as { _tag: string; message?: string; [key: string]: unknown }
      return JSON.stringify(
        {
          type: taggedError._tag,
          message: taggedError.message,
          details: taggedError,
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
    if (error !== null && typeof error === 'object' && 'stack' in error) {
      const stackError = error as { stack: unknown }
      return String(stackError.stack)
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
