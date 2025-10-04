import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Either from 'effect/Either'
import * as Match from 'effect/Match'
import * as Number from 'effect/Number'
import { pipe } from 'effect/Function'
import * as Schema from 'effect/Schema'
import * as Clock from 'effect/Clock'

/**
 * GameLoop ドメインの基本的なブランド型とスキーマ定義
 */

/**
 * タイムスタンプ（ミリ秒）
 */
export const TimestampSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('Timestamp'),
  Schema.annotations({ description: 'Epoch millisecond timestamp' })
)
export type Timestamp = Schema.Schema.Type<typeof TimestampSchema>

/**
 * デルタタイム（ミリ秒）
 */
export const FrameDurationSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('FrameDuration'),
  Schema.annotations({ description: 'Frame-to-frame duration in milliseconds' })
)
export type FrameDuration = Schema.Schema.Type<typeof FrameDurationSchema>

/**
 * フレームカウント
 */
export const FrameCountSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('FrameCount'),
  Schema.annotations({ description: 'Monotonic frame counter' })
)
export type FrameCount = Schema.Schema.Type<typeof FrameCountSchema>

/**
 * FPS ブランド型
 */
export const FramesPerSecondSchema = Schema.Number.pipe(
  Schema.positive(),
  Schema.lessThanOrEqualTo(1000),
  Schema.brand('FramesPerSecond'),
  Schema.annotations({ description: 'Frames per second' })
)
export type FramesPerSecond = Schema.Schema.Type<typeof FramesPerSecondSchema>

/**
 * ゲームループ状態
 */
export const GameLoopStateSchema = Schema.Literal('idle', 'running', 'paused', 'stopped').pipe(
  Schema.brand('GameLoopState')
)
export type GameLoopState = Schema.Schema.Type<typeof GameLoopStateSchema>

/**
 * ゲームループ構成
 */
export const GameLoopConfigSchema = Schema.Struct({
  targetFps: FramesPerSecondSchema,
  maxFrameSkip: Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.lessThanOrEqualTo(10)),
  enablePerformanceMonitoring: Schema.Boolean,
  adaptiveQuality: Schema.Boolean,
})
export type GameLoopConfig = Schema.Schema.Type<typeof GameLoopConfigSchema>

export const DefaultGameLoopConfig: GameLoopConfig = {
  targetFps: Schema.decodeSync(FramesPerSecondSchema)(60),
  maxFrameSkip: 5,
  enablePerformanceMonitoring: true,
  adaptiveQuality: true,
}

/**
 * フレーム ID ブランド
 */
export const FrameIdSchema = Schema.String.pipe(
  Schema.pattern(/^frame_[0-9]+$/u),
  Schema.brand('FrameId')
)
export type FrameId = Schema.Schema.Type<typeof FrameIdSchema>

/**
 * フレーム情報構造体
 */
export const FrameInfoSchema = Schema.Struct({
  frameId: FrameIdSchema,
  frameCount: FrameCountSchema,
  timestamp: TimestampSchema,
  delta: FrameDurationSchema,
  fps: FramesPerSecondSchema,
  skipped: Schema.Boolean,
})
export type FrameInfo = Schema.Schema.Type<typeof FrameInfoSchema>

/**
 * Performance メトリクス
 */
export const PerformanceMetricsSchema = Schema.Struct({
  averageFps: FramesPerSecondSchema,
  minimumFps: FramesPerSecondSchema,
  maximumFps: FramesPerSecondSchema,
  droppedFrames: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
export type PerformanceMetrics = Schema.Schema.Type<typeof PerformanceMetricsSchema>

/**
 * スキーマ安全なコンストラクタ
 */
export const makeTimestamp = (input: number): Either.Either<Schema.ParseError, Timestamp> =>
  Schema.decodeEither(TimestampSchema)(input)

export const makeFrameDuration = (input: number): Either.Either<Schema.ParseError, FrameDuration> =>
  Schema.decodeEither(FrameDurationSchema)(input)

export const makeFrameCount = (input: number): Either.Either<Schema.ParseError, FrameCount> =>
  Schema.decodeEither(FrameCountSchema)(input)

export const makeFps = (input: number): Either.Either<Schema.ParseError, FramesPerSecond> =>
  Schema.decodeEither(FramesPerSecondSchema)(input)

export const makeFrameId = (input: number | string): Either.Either<Schema.ParseError, FrameId> =>
  pipe(
    Match.value(input),
    Match.when(Number.isNumber, (value) => Schema.decodeEither(FrameIdSchema)(`frame_${value}`)),
    Match.orElse(() => Schema.decodeEither(FrameIdSchema)(String(input)))
  )

export const makeConfig = (
  partial: Partial<GameLoopConfig>
): Either.Either<Schema.ParseError, GameLoopConfig> =>
  Schema.decodeEither(GameLoopConfigSchema)({ ...DefaultGameLoopConfig, ...partial })

/**
 * 現在時刻を Timestamp として取得
 */
export const currentTimestamp: Effect.Effect<Timestamp, Schema.ParseError, Clock.Clock> = pipe(
  Clock.currentTimeMillis,
  Effect.flatMap((millis) => effectFromEither(makeTimestamp(millis)))
)

/**
 * FPS とデルタを整合させる
 */
export interface NonMonotonicTimestamp {
  readonly _tag: 'NonMonotonicTimestamp'
  readonly previous: Timestamp
  readonly current: Timestamp
}

export const NonMonotonicTimestamp = Data.tagged<NonMonotonicTimestamp>('NonMonotonicTimestamp')

export const reconcileFrameTiming = (
  fps: FramesPerSecond,
  previous: Timestamp,
  current: Timestamp
): Either.Either<NonMonotonicTimestamp, FrameDuration> =>
  pipe(
    Number.lessThan(previous)(current),
    Match.value,
    Match.when(true, () =>
      Either.left(NonMonotonicTimestamp({ previous, current }))
    ),
    Match.orElse(() => {
      const previousMillis = timestampToNumber(previous)
      const currentMillis = timestampToNumber(current)
      const diff = currentMillis - previousMillis
      const ideal = 1000 / fpsToNumber(fps)
      return makeFrameDuration(Math.max(diff, ideal))
    })
  )

/**
 * 安全な FrameInfo を構築
 */
export const makeFrameInfo = (
  parameters: {
    readonly frameId: FrameId
    readonly frameCount: FrameCount
    readonly timestamp: Timestamp
    readonly delta: FrameDuration
    readonly fps: FramesPerSecond
    readonly skipped: boolean
  }
): Either.Either<Schema.ParseError, FrameInfo> => Schema.decodeEither(FrameInfoSchema)(parameters)

export const timestampToNumber = Schema.encodeSync(TimestampSchema)
export const frameDurationToNumber = Schema.encodeSync(FrameDurationSchema)
export const frameCountToNumber = Schema.encodeSync(FrameCountSchema)
export const fpsToNumber = Schema.encodeSync(FramesPerSecondSchema)

export const effectFromEither = <E, A>(either: Either.Either<E, A>): Effect.Effect<A, E> =>
  pipe(
    either,
    Either.match({
      onLeft: (error) => Effect.fail(error),
      onRight: (value) => Effect.succeed(value),
    })
  )

export const GameLoopBrandedTypes = {
  createTimestamp: Schema.decodeSync(TimestampSchema),
  createDeltaTime: Schema.decodeSync(FrameDurationSchema),
  createFrameCount: Schema.decodeSync(FrameCountSchema),
  createFps: Schema.decodeSync(FramesPerSecondSchema),
}
