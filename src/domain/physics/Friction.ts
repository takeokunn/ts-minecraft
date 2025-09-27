import { Effect, pipe, Match } from 'effect'
import type { Vector3 } from '../world/types'
import type { BlockTypeId } from '@domain/core/types/brands'
import { BLOCK_FRICTION } from './types'

/**
 * 摩擦システム
 * ブロックタイプに応じた摩擦係数を適用
 */
export const Friction = {
  /**
   * ブロックタイプから摩擦係数を取得
   */
  getFrictionCoefficient: (blockType: BlockTypeId): number => {
    const blockId = Number(blockType)
    return BLOCK_FRICTION[blockId] ?? BLOCK_FRICTION[0] ?? 0.6
  },

  /**
   * 地面との摩擦を適用
   * @param velocity 現在の速度ベクトル
   * @param isGrounded 接地しているか
   * @param groundBlockType 接地しているブロックタイプ
   */
  applyGroundFriction: (velocity: Vector3, isGrounded: boolean, groundBlockType: BlockTypeId): Effect.Effect<Vector3> =>
    Effect.gen(function* () {
      return pipe(
        isGrounded,
        Match.value,
        Match.when(false, () => velocity), // 空中では摩擦を適用しない
        Match.when(true, () => {
          const friction = Friction.getFrictionCoefficient(groundBlockType)

          // 水平方向の速度に摩擦を適用
          return {
            x: velocity.x * friction,
            y: velocity.y, // Y軸（垂直方向）には摩擦を適用しない
            z: velocity.z * friction,
          }
        }),
        Match.exhaustive
      )
    }),

  /**
   * 移動摩擦を適用（歩行/走行時）
   * @param velocity 現在の速度
   * @param inputVelocity 入力による速度
   * @param isGrounded 接地状態
   * @param groundBlockType 地面のブロックタイプ
   */
  applyMovementFriction: (
    velocity: Vector3,
    inputVelocity: Vector3,
    isGrounded: boolean,
    groundBlockType: BlockTypeId
  ): Effect.Effect<Vector3> =>
    Effect.gen(function* () {
      return pipe(
        isGrounded,
        Match.value,
        Match.when(false, () => {
          // 空中では摩擦の影響を減少
          const airControl = 0.2
          return {
            x: velocity.x + inputVelocity.x * airControl,
            y: velocity.y,
            z: velocity.z + inputVelocity.z * airControl,
          }
        }),
        Match.when(true, () => {
          const friction = Friction.getFrictionCoefficient(groundBlockType)

          return pipe(
            friction > 0.9,
            Match.value,
            Match.when(true, () => {
              // 氷の上では加速が遅く、減速も遅い
              const iceControl = 0.1
              return {
                x: velocity.x * friction + inputVelocity.x * iceControl,
                y: velocity.y,
                z: velocity.z * friction + inputVelocity.z * iceControl,
              }
            }),
            Match.when(false, () => {
              // 通常の地面
              return {
                x: inputVelocity.x,
                y: velocity.y,
                z: inputVelocity.z,
              }
            }),
            Match.exhaustive
          )
        }),
        Match.exhaustive
      )
    }),

  /**
   * スニーク時の摩擦（エッジから落ちない）
   */
  applySneakFriction: (velocity: Vector3, isGrounded: boolean): Effect.Effect<Vector3> =>
    Effect.gen(function* () {
      return pipe(
        isGrounded,
        Match.value,
        Match.when(false, () => velocity),
        Match.when(true, () => {
          // スニーク時は移動速度を大幅に減少
          const sneakMultiplier = 0.3
          return {
            x: velocity.x * sneakMultiplier,
            y: velocity.y,
            z: velocity.z * sneakMultiplier,
          }
        }),
        Match.exhaustive
      )
    }),

  /**
   * 速度制限を適用
   */
  clampVelocity: (velocity: Vector3, maxSpeed: number): Vector3 => {
    const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z)

    return pipe(
      horizontalSpeed <= maxSpeed,
      Match.value,
      Match.when(true, () => velocity),
      Match.when(false, () => {
        // 水平速度を制限
        const scale = maxSpeed / horizontalSpeed
        return {
          x: velocity.x * scale,
          y: velocity.y,
          z: velocity.z * scale,
        }
      }),
      Match.exhaustive
    )
  },

  /**
   * 完全停止判定
   * 非常に小さい速度を0にする
   */
  applyDeadZone: (velocity: Vector3, threshold: number = 0.001): Vector3 => ({
    x: Math.abs(velocity.x) < threshold ? 0 : velocity.x,
    y: Math.abs(velocity.y) < threshold ? 0 : velocity.y,
    z: Math.abs(velocity.z) < threshold ? 0 : velocity.z,
  }),
}
