/**
 * @fileoverview Milliseconds - Time unit Brand type
 * ミリ秒単位のBrand型定義
 */

import * as Schema from 'effect/Schema'

/**
 * Milliseconds Schema
 *
 * ミリ秒を表すBrand型。非負の数値のみ許可。
 * 主な用途：
 * - デルタタイム（フレーム間隔）
 * - アニメーション時間
 * - タイムアウト設定
 */
export const MillisecondsSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('Milliseconds'),
  Schema.annotations({
    title: 'Milliseconds',
    description: 'Time duration in milliseconds (non-negative)',
    examples: [0, 16.67, 1000, 5000],
  })
)

export type Milliseconds = Schema.Schema.Type<typeof MillisecondsSchema>

/**
 * Milliseconds constants
 */
export const MILLISECONDS_ZERO: Milliseconds = 0 as Milliseconds
export const FRAME_16MS: Milliseconds = 16.67 as Milliseconds // 60 FPS
export const ONE_SECOND: Milliseconds = 1000 as Milliseconds
