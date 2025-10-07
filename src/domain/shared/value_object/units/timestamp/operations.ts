/**
 * @fileoverview Timestamp Operations
 * Timestamp型の操作関数
 */

import { DateTime } from 'effect'
import * as Clock from 'effect/Clock'
import * as Effect from 'effect/Effect'
import * as Order from 'effect/Order'
import * as Schema from 'effect/Schema'
import type { Milliseconds } from '../milliseconds'
import { MillisecondsSchema } from '../milliseconds/schema'
import type { Timestamp } from './schema'
import { TimestampSchema } from './schema'

/**
 * Get current timestamp using Effect Clock
 *
 * Effect Clockを使用して現在のタイムスタンプを取得
 */
export const now = (): Effect.Effect<Timestamp> =>
  Effect.map(Clock.currentTimeMillis, (millis) => Schema.make(TimestampSchema)(millis))

/**
 * Create Timestamp from number with validation
 *
 * 数値からTimestamp型を生成（バリデーション付き）
 */
export const make = (value: number): Effect.Effect<Timestamp, Schema.ParseError> =>
  Schema.decodeUnknown(TimestampSchema)(value)

/**
 * Create Timestamp from number without validation
 *
 * 数値からTimestamp型を生成（バリデーションなし）
 * 信頼できるソースからの値のみ使用すること
 */
export const makeUnsafe = (value: number): Timestamp => Schema.make(TimestampSchema)(value)

/**
 * Create Timestamp from Date
 *
 * DateオブジェクトからTimestampを生成
 */
export const fromDate = (date: Date): Timestamp => Schema.make(TimestampSchema)(date.getTime())

/**
 * Convert Timestamp to DateTime.Utc
 *
 * TimestampをDateTime.Utcに変換
 */
export const toDateTime = (timestamp: Timestamp): DateTime.Utc => DateTime.unsafeFromDate(new Date(timestamp))

/**
 * Add Milliseconds to Timestamp
 *
 * TimestampにMillisecondsを加算
 */
export const addMilliseconds = (timestamp: Timestamp, duration: Milliseconds): Timestamp =>
  Schema.make(TimestampSchema)(timestamp + duration)

/**
 * Subtract Milliseconds from Timestamp
 *
 * TimestampからMillisecondsを減算（負にならないようにクランプ）
 */
export const subtractMilliseconds = (timestamp: Timestamp, duration: Milliseconds): Timestamp =>
  Schema.make(TimestampSchema)(Math.max(0, timestamp - duration))

/**
 * Calculate duration between two Timestamps
 *
 * 2つのTimestamp間の経過時間を計算（Millisecondsで返す）
 */
export const diff = (start: Timestamp, end: Timestamp): Milliseconds =>
  Schema.make(MillisecondsSchema)(Math.abs(end - start))

/**
 * Compare two Timestamps
 *
 * 2つのTimestampを比較
 */
export const compare = (a: Timestamp, b: Timestamp): -1 | 0 | 1 => Order.number(a, b)

/**
 * Check if Timestamp is before another
 *
 * あるTimestampが別のTimestampより前かチェック
 */
export const isBefore = (a: Timestamp, b: Timestamp): boolean => a < b

/**
 * Check if Timestamp is after another
 *
 * あるTimestampが別のTimestampより後かチェック
 */
export const isAfter = (a: Timestamp, b: Timestamp): boolean => a > b

/**
 * Get minimum of two Timestamps
 */
export const min = (a: Timestamp, b: Timestamp): Timestamp => Schema.make(TimestampSchema)(Math.min(a, b))

/**
 * Get maximum of two Timestamps
 */
export const max = (a: Timestamp, b: Timestamp): Timestamp => Schema.make(TimestampSchema)(Math.max(a, b))

/**
 * Convert to ISO 8601 string
 *
 * ISO 8601形式の文字列に変換
 */
export const toISOString = (timestamp: Timestamp): string =>
  DateTime.formatIso(DateTime.unsafeFromDate(new Date(timestamp)))

/**
 * Parse from ISO 8601 string
 *
 * ISO 8601形式の文字列からTimestampを生成
 */
export const fromISOString = (isoString: string): Effect.Effect<Timestamp, Schema.ParseError> =>
  Effect.gen(function* () {
    const dateTime = DateTime.unsafeFromDate(new Date(isoString))
    const millis = DateTime.toEpochMillis(dateTime)
    return yield* make(millis)
  })
