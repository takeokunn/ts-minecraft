import { Effect, Context, Layer, pipe, Runtime } from 'effect'
import * as Schema from 'effect/Schema'
import * as ParseResult from 'effect/ParseResult'
import * as Config from 'effect/Config'
import { Cause, Exit } from 'effect'
import * as Schedule from 'effect/Schedule'

/**
 * Effect-TS基本設定とヘルパー関数
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

// Re-export commonly used Effect utilities
export { Effect, Context, Layer, pipe, Runtime, Schema, Config }
export type { Schedule }

// Runtime configuration
export const runtime = Runtime.defaultRuntime

// Helper functions for Effect composition
export const tap = Effect.tap
export const map = Effect.map
export const flatMap = Effect.flatMap
export const catchAll = Effect.catchAll
export const catchTag = Effect.catchTag
export const succeed = Effect.succeed
export const fail = Effect.fail
export const sync = Effect.sync
export const promise = Effect.promise
export const tryPromise = Effect.tryPromise
export const gen = Effect.gen
export const all = Effect.all
export const forEach = Effect.forEach

// Schema utilities
export const parse = Schema.decodeUnknown
export const parseSync = Schema.decodeUnknownSync
export const encode = Schema.encode
export const encodeSync = Schema.encodeSync

// Layer utilities
export const layerFrom = Layer.succeed
export const layerEffect = Layer.effect
export const layerScoped = Layer.scoped
export const layerFail = Layer.fail
export const layerMerge = Layer.merge
export const layerProvide = Layer.provide

// Context utilities
export const service = <T>(tag: Context.Tag<T, T>) => Effect.serviceConstants(tag)

// Common error handling patterns
export const mapError =
  <E, E2>(f: (e: E) => E2) =>
  <A, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E2, R> =>
    Effect.mapError(effect, f)

export const orElse =
  <A2, E2, R2>(that: Effect.Effect<A2, E2, R2>) =>
  <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A | A2, E2, R | R2> =>
    Effect.orElse(self, () => that)

// Utility to run an effect synchronously (for testing)
export const runSync = <A, E>(effect: Effect.Effect<A, E>): A => {
  const result = Effect.runSyncExit(effect)
  if (Exit.isFailure(result)) {
    throw Cause.squash(result.cause)
  }
  return result.value
}

// Utility to run an effect as a promise
export const runPromise = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)

// Utility for creating tagged errors
export const taggedError =
  <Tag extends string>(tag: Tag) =>
  <Fields extends Record<string, any>>(fields: Fields) =>
    Schema.TaggedError<Tag>()(tag, {
      ...Object.entries(fields).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: value,
        }),
        {} as Fields
      ),
    })

// Utility for creating services
export const makeService = <T>(name: string) => Context.GenericTag<T>(`@app/${name}`)

// Common effect patterns for the game
export const withRetry = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  options?: { times?: number; delay?: number }
): Effect.Effect<A, E, R> => {
  const { times = 3, delay = 100 } = options ?? {}
  return pipe(effect, Effect.retry(Schedule.spaced(delay).pipe(Schedule.compose(Schedule.recurs(times)))))
}

// Logging utilities
export const logInfo = (message: string) => Effect.log(message)
export const logError = (message: string) => Effect.logError(message)
export const logDebug = (message: string) => Effect.logDebug(message)

// Performance measurement utility
export const timed = <A, E, R>(label: string, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  pipe(
    Effect.Do,
    Effect.bind('start', () => Effect.sync(() => Date.now())),
    Effect.bind('result', () => effect),
    Effect.tap(({ start }) => {
      const duration = Date.now() - start
      return logDebug(`${label} took ${duration}ms`)
    }),
    Effect.map(({ result }) => result)
  )

// Validation utility
export const validate =
  <A, I>(schema: Schema.Schema<A, I>) =>
  (input: I): Effect.Effect<A, ParseResult.ParseError> =>
    Schema.decodeUnknown(schema)(input)

// Batch processing utility
export const batch = <A, B, E, R>(
  items: ReadonlyArray<A>,
  f: (item: A) => Effect.Effect<B, E, R>,
  options?: { concurrency?: number }
): Effect.Effect<ReadonlyArray<B>, E, R> => {
  const { concurrency = 5 } = options ?? {}
  return Effect.forEach(items, f, { concurrency })
}

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
