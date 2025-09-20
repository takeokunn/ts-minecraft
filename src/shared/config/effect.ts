import { Schema, Effect } from 'effect'

/**
 * ゲームエラーの構造を定義
 */
export const GameErrorSchema = Schema.Struct({
  _tag: Schema.Literal('GameError'),
  message: Schema.String,
  code: Schema.String,
  timestamp: Schema.DateFromSelf,
})

/**
 * GameError型の定義
 */
export type GameError = Schema.Schema.Type<typeof GameErrorSchema>

/**
 * GameErrorを作成するファクトリー関数
 */
export const createGameError = (message: string, code: string = 'UNKNOWN_ERROR'): GameError => ({
  _tag: 'GameError' as const,
  message,
  code,
  timestamp: new Date(),
})

/**
 * 操作結果を表現する型
 * Effect型を使用した関数型アプローチ
 */
export type GameResult<T, E = GameError> = Effect.Effect<T, E>

/**
 * Effect-TSの基本設定を提供するユーティリティ
 */
export const EffectConfig = {
  /**
   * 成功値を持つEffectを作成
   */
  succeed: <T>(value: T): GameResult<T, never> => Effect.succeed(value),

  /**
   * エラーを持つEffectを作成
   */
  fail: (message: string, code?: string): GameResult<never> => Effect.fail(createGameError(message, code)),

  /**
   * GameErrorかどうかを判定
   */
  isGameError: (value: unknown): value is GameError => Schema.is(GameErrorSchema)(value),

  /**
   * Schemaを使用したバリデーション
   */
  validate:
    <A, I>(schema: Schema.Schema<A, I>) =>
    (input: I): GameResult<A> =>
      Effect.try({
        try: () => Schema.decodeSync(schema)(input),
        catch: (error) => createGameError(`Validation failed: ${String(error)}`, 'VALIDATION_ERROR'),
      }),
} as const
