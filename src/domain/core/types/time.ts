import { Schema } from '@effect/schema'

/**
 * 時間関連のブランド型定義
 */

/**
 * タイムスタンプ用のブランド型（ミリ秒）
 */
export const TimestampSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('Timestamp'),
  Schema.annotations({
    title: 'Timestamp',
    description: 'Timestamp in milliseconds',
  })
)
export type Timestamp = Schema.Schema.Type<typeof TimestampSchema>

/**
 * デルタタイム用のブランド型（秒）
 */
export const DeltaTimeSchema = Schema.Number.pipe(
  Schema.positive(),
  Schema.brand('DeltaTime'),
  Schema.annotations({
    title: 'DeltaTime',
    description: 'Delta time in seconds',
  })
)
export type DeltaTime = Schema.Schema.Type<typeof DeltaTimeSchema>

/**
 * 時間関連のヘルパー関数
 */
export const TimeBrands = {
  createTimestamp: (ms: number): Timestamp => Schema.decodeSync(TimestampSchema)(ms),

  createDeltaTime: (seconds: number): DeltaTime => Schema.decodeSync(DeltaTimeSchema)(seconds),

  now: (): Timestamp => Schema.decodeSync(TimestampSchema)(Date.now()),
}
