/**
 * @fileoverview Meters - Distance unit Brand type
 * メートル単位の距離Brand型定義
 */

import { unsafeCoerce } from 'effect/Function'
import * as Schema from 'effect/Schema'

/**
 * Meters Schema
 *
 * メートル（m）で表される距離のBrand型。
 * 主な用途：
 * - プレイヤー座標
 * - 距離計算
 * - 物理シミュレーション
 * - 衝突判定範囲
 */
export const MetersSchema = Schema.Number.pipe(
  Schema.brand('Meters'),
  Schema.annotations({
    title: 'Meters',
    description: 'Distance in meters (can be negative for relative positions)',
    examples: [0, 1.0, 10.5, -5.3, 100.0],
  })
)

export type Meters = Schema.Schema.Type<typeof MetersSchema>

/**
 * Meters constants
 */
export const METERS_ZERO: Meters = unsafeCoerce<number, Meters>(0)
export const ONE_METER: Meters = unsafeCoerce<number, Meters>(1)
export const ONE_BLOCK: Meters = unsafeCoerce<number, Meters>(1) // Minecraft 1 block = 1 meter
