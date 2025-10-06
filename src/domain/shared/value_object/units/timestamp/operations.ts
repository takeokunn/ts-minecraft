/**
 * @fileoverview Timestamp Operations
 * Timestamp型の操作関数
 */

import * as Clock from 'effect/Clock'
import * as Effect from 'effect/Effect'
import * as Order from 'effect/Order'
import * as Schema from 'effect/Schema'
import type { Milliseconds } from '../milliseconds'
import type { Timestamp } from './schema'
import { TimestampSchema } from './schema'

/**
 * Get current timestamp using Effect Clock
 *
 * Effect Clockを使用して現在のタイムスタンプを取得
 */
export const now = (): Effect.Effect<Timestamp> => Effect.map(Clock.currentTimeMillis, (millis) => millis as Timestamp)

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
export const makeUnsafe = (value: number): Timestamp => value as Timestamp

/**
 * Create Timestamp from Date
 *
 * DateオブジェクトからTimestampを生成
 */
export const fromDate = (date: Date): Timestamp => date.getTime() as Timestamp

/**
 * Convert Timestamp to Date
 *
 * TimestampをDateオブジェクトに変換
 */
export const toDate = (timestamp: Timestamp): Date => new Date(timestamp)

/**
 * Add Milliseconds to Timestamp
 *
 * TimestampにMillisecondsを加算
 */
export const addMilliseconds = (timestamp: Timestamp, duration: Milliseconds): Timestamp =>
  (timestamp + duration) as Timestamp

/**
 * Subtract Milliseconds from Timestamp
 *
 * TimestampからMillisecondsを減算（負にならないようにクランプ）
 */
export const subtractMilliseconds = (timestamp: Timestamp, duration: Milliseconds): Timestamp =>
  Math.max(0, timestamp - duration) as Timestamp

/**
 * Calculate duration between two Timestamps
 *
 * 2つのTimestamp間の経過時間を計算（Millisecondsで返す）
 */
export const diff = (start: Timestamp, end: Timestamp): Milliseconds => Math.abs(end - start) as Milliseconds

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
export const min = (a: Timestamp, b: Timestamp): Timestamp => Math.min(a, b) as Timestamp

/**
 * Get maximum of two Timestamps
 */
export const max = (a: Timestamp, b: Timestamp): Timestamp => Math.max(a, b) as Timestamp

/**
 * Convert to ISO 8601 string
 *
 * ISO 8601形式の文字列に変換
 */
export const toISOString = (timestamp: Timestamp): string => new Date(timestamp).toISOString()

/**
 * Parse from ISO 8601 string
 *
 * ISO 8601形式の文字列からTimestampを生成
 */
export const fromISOString = (isoString: string): Effect.Effect<Timestamp, Schema.ParseError> => {
  const date = new Date(isoString)
  return make(date.getTime())
}
