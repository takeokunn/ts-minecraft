import { Match, pipe, Option, Effect, Either } from 'effect'
import { Schema, ParseResult } from '@effect/schema'
import { GameErrorUnion, type AnyGameError } from './GameErrors'
import { NetworkErrorUnion, type AnyNetworkError } from './NetworkErrors'

/**
 * Schemaベースのエラー検証とデコード
 */
export const ErrorValidation = {
  /**
   * ゲームエラーのデコード
   */
  decodeGameError: (error: unknown): Either.Either<AnyGameError, ParseResult.ParseError> =>
    Schema.decodeUnknownEither(GameErrorUnion)(error),

  /**
   * ネットワークエラーのデコード
   */
  decodeNetworkError: (error: unknown): Either.Either<AnyNetworkError, ParseResult.ParseError> =>
    Schema.decodeUnknownEither(NetworkErrorUnion)(error),

  /**
   * エラーがゲームエラーかどうかをSchema検証で判定
   */
  isGameError: (error: unknown): error is AnyGameError => Schema.is(GameErrorUnion)(error),

  /**
   * エラーがネットワークエラーかどうかをSchema検証で判定
   */
  isNetworkError: (error: unknown): error is AnyNetworkError => Schema.is(NetworkErrorUnion)(error),

  /**
   * エラーがリトライ可能かどうかを判定
   */
  isRetryableError: (error: unknown): boolean =>
    pipe(
      ErrorValidation.decodeNetworkError(error),
      Either.match({
        onLeft: () => false,
        onRight: (networkError) => {
          const retryableTags = ['NetworkError', 'ConnectionError', 'TimeoutError', 'ServerError']
          return retryableTags.includes(networkError._tag)
        },
      })
    ),

  /**
   * エラーの安全なデコードとフォールバック
   */
  safeDecodeError: <T>(schema: Schema.Schema<T, unknown>, error: unknown, fallback: T): T =>
    pipe(
      Schema.decodeUnknownEither(schema)(error),
      Either.getOrElse(() => fallback)
    ),
}

/**
 * 旧式のエラーガード（互換性のため保持）
 * 新しいコードではErrorValidationを使用してください
 */
export const ErrorGuards = {
  isGameError: ErrorValidation.isGameError,
  isNetworkError: ErrorValidation.isNetworkError,
  isRetryableError: ErrorValidation.isRetryableError,
}
