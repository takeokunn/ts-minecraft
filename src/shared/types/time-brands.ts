import { Schema } from '@effect/schema'

/**
 * 時間関連Brand型定義
 * ゲーム内の時間概念を型安全に表現
 */

/**
 * Timestamp用のブランド型（UnixタイムスタンプからTimestampへ移行）
 * 既存のTimestampを強化して、より厳密な検証を追加
 */
export const TimestampSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand('Timestamp'),
  Schema.annotations({
    title: 'Timestamp',
    description: 'Unix timestamp in milliseconds',
  })
)
export type Timestamp = Schema.Schema.Type<typeof TimestampSchema>

/**
 * DeltaTime用のブランド型（既存から移行・強化）
 * フレーム間の時間差を表現、60FPS = 16.67ms を想定
 */
export const DeltaTimeSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.lessThanOrEqualTo(1000), // 最大1秒まで（異常値防止）
  Schema.brand('DeltaTime'),
  Schema.annotations({
    title: 'DeltaTime',
    description: 'Time difference between frames in milliseconds',
  })
)
export type DeltaTime = Schema.Schema.Type<typeof DeltaTimeSchema>

/**
 * FrameTime用のブランド型
 * フレームレンダリング時間を表現
 */
export const FrameTimeSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.lessThanOrEqualTo(100), // 最大100ms（極端な遅延防止）
  Schema.brand('FrameTime'),
  Schema.annotations({
    title: 'FrameTime',
    description: 'Time taken to render a single frame in milliseconds',
  })
)
export type FrameTime = Schema.Schema.Type<typeof FrameTimeSchema>

/**
 * Duration用のブランド型
 * 継続時間や期間を表現（秒単位）
 */
export const DurationSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.finite(),
  Schema.brand('Duration'),
  Schema.annotations({
    title: 'Duration',
    description: 'Duration in seconds',
  })
)
export type Duration = Schema.Schema.Type<typeof DurationSchema>

/**
 * 時間関連Brand型の安全な作成ヘルパー
 */
export const TimeBrands = {
  /**
   * 安全なTimestamp作成
   * 現在時刻を取得
   */
  createTimestamp: (value?: number): Timestamp =>
    Schema.decodeSync(TimestampSchema)(value ?? Date.now()),

  /**
   * 現在のタイムスタンプを取得
   */
  now: (): Timestamp =>
    Schema.decodeSync(TimestampSchema)(Date.now()),

  /**
   * 安全なDeltaTime作成
   */
  createDeltaTime: (value: number): DeltaTime =>
    Schema.decodeSync(DeltaTimeSchema)(value),

  /**
   * 安全なFrameTime作成
   */
  createFrameTime: (value: number): FrameTime =>
    Schema.decodeSync(FrameTimeSchema)(value),

  /**
   * 安全なDuration作成
   */
  createDuration: (value: number): Duration =>
    Schema.decodeSync(DurationSchema)(value),

  /**
   * Duration from milliseconds
   */
  durationFromMs: (ms: number): Duration =>
    Schema.decodeSync(DurationSchema)(ms / 1000),

  /**
   * Duration from minutes
   */
  durationFromMinutes: (minutes: number): Duration =>
    Schema.decodeSync(DurationSchema)(minutes * 60),

  /**
   * Duration from hours
   */
  durationFromHours: (hours: number): Duration =>
    Schema.decodeSync(DurationSchema)(hours * 3600),
} as const