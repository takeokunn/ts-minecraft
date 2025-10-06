/**
 * @fileoverview MetersPerSecond - Velocity unit Brand type
 * メートル毎秒単位の速度Brand型定義
 */

import * as Schema from 'effect/Schema'

/**
 * MetersPerSecond Schema
 *
 * メートル毎秒（m/s）で表される速度のBrand型。
 * 主な用途：
 * - プレイヤー移動速度
 * - 物理シミュレーション（重力加速度など）
 * - 弾道計算
 * - アニメーション速度
 */
export const MetersPerSecondSchema = Schema.Number.pipe(
  Schema.brand('MetersPerSecond'),
  Schema.annotations({
    title: 'MetersPerSecond',
    description: 'Velocity in meters per second (can be negative for direction)',
    examples: [0, 1.0, 5.5, -3.2, 9.8], // 9.8 is Earth's gravity
  })
)

export type MetersPerSecond = Schema.Schema.Type<typeof MetersPerSecondSchema>

/**
 * MetersPerSecond constants
 */
export const VELOCITY_ZERO: MetersPerSecond = 0 as MetersPerSecond
export const WALKING_SPEED: MetersPerSecond = 4.317 as MetersPerSecond // Minecraft walking speed
export const SPRINTING_SPEED: MetersPerSecond = 5.612 as MetersPerSecond // Minecraft sprinting speed
export const GRAVITY_ACCELERATION: MetersPerSecond = 9.8 as MetersPerSecond // Earth gravity (positive for downward)
