/**
 * @fileoverview Timestamp - Epoch milliseconds Brand type
 * エポックミリ秒タイムスタンプのBrand型定義
 */

import * as Schema from 'effect/Schema'

/**
 * Timestamp Schema
 *
 * Unix Epoch（1970-01-01 00:00:00 UTC）からのミリ秒を表すBrand型。
 * 主な用途：
 * - イベントタイムスタンプ
 * - ログ記録時刻
 * - キャッシュ有効期限
 * - ゲーム内時刻管理
 */
export const TimestampSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('Timestamp'),
  Schema.annotations({
    title: 'Timestamp',
    description: 'Unix Epoch milliseconds timestamp (non-negative)',
    examples: [0, 1609459200000, Date.now()],
  })
)

export type Timestamp = Schema.Schema.Type<typeof TimestampSchema>

/**
 * Timestamp constants
 */
export const EPOCH_ZERO: Timestamp = Schema.make(TimestampSchema)(0) // 1970-01-01 00:00:00 UTC
