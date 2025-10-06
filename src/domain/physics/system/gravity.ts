import { Effect, Match, pipe } from 'effect'
import type { Vector3 } from '../../world/types'
import { PHYSICS_CONSTANTS } from '../types/constants'

/**
 * 重力システム
 * Minecraftの物理演算に基づいた重力と終端速度の実装
 */
export const Gravity = {
  /**
   * 重力加速度を適用
   * @param velocity 現在の速度ベクトル
   * @param deltaTime 経過時間（秒）
   * @param inFluid 流体内かどうか
   * @returns 更新された速度ベクトル
   */
  apply: (velocity: Vector3, deltaTime: number, inFluid: boolean): Effect.Effect<Vector3> =>
    Effect.gen(function* () {
      // 流体内では重力の影響が変わる
      const gravityMultiplier = inFluid ? 0.4 : 1.0
      const effectiveGravity = PHYSICS_CONSTANTS.GRAVITY * gravityMultiplier

      // Y軸速度に重力加速度を適用
      const newVelocityY = velocity.y - effectiveGravity * deltaTime

      // 終端速度の適用
      const terminalVelocity = inFluid ? PHYSICS_CONSTANTS.TERMINAL_VELOCITY * 0.4 : PHYSICS_CONSTANTS.TERMINAL_VELOCITY

      // 下降速度を終端速度で制限
      const clampedVelocityY = Math.max(newVelocityY, -terminalVelocity)

      return {
        x: velocity.x,
        y: clampedVelocityY,
        z: velocity.z,
      }
    }),

  /**
   * ジャンプ速度を計算
   * @param jumpHeight 目標ジャンプ高さ（ブロック）
   * @returns 必要な初速度
   */
  calculateJumpVelocity: (jumpHeight: number): number => {
    // v² = 2gh の物理公式から初速度を計算
    return Math.sqrt(2 * PHYSICS_CONSTANTS.GRAVITY * jumpHeight)
  },

  /**
   * 落下ダメージを計算
   * @param fallDistance 落下距離（ブロック）
   * @returns ダメージ量（ハート単位）
   */
  calculateFallDamage: (fallDistance: number): number =>
    pipe(
      fallDistance,
      Match.value,
      Match.when(
        (distance) => distance <= 3,
        () => 0
      ), // 3ブロック以下は無害
      Match.orElse((distance) => Math.floor(distance - 3) * 0.5) // 3ブロックを超えた分だけダメージ
    ),

  /**
   * 空気抵抗を適用
   * @param velocity 現在の速度ベクトル
   * @returns 空気抵抗適用後の速度ベクトル
   */
  applyAirResistance: (velocity: Vector3): Effect.Effect<Vector3> =>
    Effect.succeed({
      x: velocity.x * PHYSICS_CONSTANTS.AIR_RESISTANCE,
      y: velocity.y, // Y軸は重力で制御するため空気抵抗なし
      z: velocity.z * PHYSICS_CONSTANTS.AIR_RESISTANCE,
    }),
}
