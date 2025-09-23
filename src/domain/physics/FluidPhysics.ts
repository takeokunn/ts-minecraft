import { Effect } from 'effect'
import { Vector3 } from '../world/types'
import { BlockTypeId } from '../../shared/types/branded'
import { FluidType, FluidPhysicsResult, PHYSICS_CONSTANTS } from './types'

/**
 * 流体物理システム
 * 水と溶岩の中での動作を制御
 */
export const FluidPhysics = {
  /**
   * ブロックタイプから流体タイプを判定
   */
  getFluidType: (blockType: BlockTypeId | null): FluidType => {
    if (!blockType) return 'none'
    const id = Number(blockType)
    if (id === 8 || id === 9) return 'water' // 水と静水
    if (id === 10 || id === 11) return 'lava' // 溶岩と静止溶岩
    return 'none'
  },

  /**
   * 流体内での物理演算
   * @param position エンティティ位置
   * @param velocity 現在の速度
   * @param fluidType 流体タイプ
   * @param getBlockAt ブロック取得関数
   */
  calculateFluidPhysics: (
    position: Vector3,
    velocity: Vector3,
    fluidType: FluidType,
    getBlockAt: (pos: Vector3) => BlockTypeId | null
  ): Effect.Effect<FluidPhysicsResult> =>
    Effect.gen(function* () {
      if (fluidType === 'none') {
        return {
          velocity,
          buoyancy: 0,
          isSubmerged: false,
          submersionDepth: 0,
        }
      }

      // エンティティの頭部と足元の流体チェック
      const headPos = { x: position.x, y: position.y + 1.8, z: position.z }
      const feetPos = { x: position.x, y: position.y, z: position.z }

      const headFluid = FluidPhysics.getFluidType(getBlockAt(headPos))
      const feetFluid = FluidPhysics.getFluidType(getBlockAt(feetPos))

      const isSubmerged = headFluid !== 'none'
      const isPartiallySubmerged = feetFluid !== 'none'

      if (!isPartiallySubmerged) {
        return {
          velocity,
          buoyancy: 0,
          isSubmerged: false,
          submersionDepth: 0,
        }
      }

      // 沈み込みの深さを計算
      const submersionDepth = isSubmerged ? 1.0 : 0.5

      // 流体抵抗を適用
      const resistance = fluidType === 'water' ? PHYSICS_CONSTANTS.WATER_RESISTANCE : PHYSICS_CONSTANTS.LAVA_RESISTANCE

      // 浮力を計算
      const buoyancy = fluidType === 'water' ? 0.02 : 0.01 // 水の方が浮きやすい

      // 速度に抵抗を適用
      const resistedVelocity = {
        x: velocity.x * resistance,
        y: velocity.y * resistance + buoyancy, // 浮力を追加
        z: velocity.z * resistance,
      }

      return {
        velocity: resistedVelocity,
        buoyancy,
        isSubmerged,
        submersionDepth,
      }
    }),

  /**
   * 水泳動作
   * @param velocity 現在の速度
   * @param isJumping ジャンプキーが押されているか
   * @param isSneaking スニークキーが押されているか
   */
  applySwimming: (velocity: Vector3, isJumping: boolean, isSneaking: boolean): Effect.Effect<Vector3> =>
    Effect.gen(function* () {
      let newVelocity = { ...velocity }

      if (isJumping) {
        // 上昇
        newVelocity.y = Math.min(newVelocity.y + 0.04, 0.2)
      } else if (isSneaking) {
        // 下降
        newVelocity.y = Math.max(newVelocity.y - 0.04, -0.2)
      } else {
        // 自然な沈下
        newVelocity.y = Math.max(newVelocity.y - 0.005, -0.1)
      }

      return newVelocity
    }),

  /**
   * 流体の流れ（水流）を計算
   * @param position エンティティ位置
   * @param getBlockAt ブロック取得関数
   */
  calculateFluidFlow: (position: Vector3, getBlockAt: (pos: Vector3) => BlockTypeId | null): Vector3 => {
    // 周囲の流体ブロックから流れの方向を計算
    const flow = { x: 0, y: 0, z: 0 }

    // 簡単な流れのシミュレーション
    // 実際のMinecraftでは水位差から流れを計算
    const checkPositions = [
      { x: position.x + 1, y: position.y, z: position.z, dir: { x: -1, z: 0 } },
      { x: position.x - 1, y: position.y, z: position.z, dir: { x: 1, z: 0 } },
      { x: position.x, y: position.y, z: position.z + 1, dir: { x: 0, z: -1 } },
      { x: position.x, y: position.y, z: position.z - 1, dir: { x: 0, z: 1 } },
    ]

    for (const check of checkPositions) {
      const blockType = getBlockAt(check)
      const fluidType = FluidPhysics.getFluidType(blockType)

      if (fluidType === 'water') {
        // 水がある方向から押し流される
        flow.x += check.dir.x * 0.01
        flow.z += check.dir.z * 0.01
      }
    }

    return flow
  },

  /**
   * バブルカラム（魂の砂/マグマブロック上の水柱）
   * @param position エンティティ位置
   * @param velocity 現在の速度
   * @param getBlockAt ブロック取得関数
   */
  applyBubbleColumn: (
    position: Vector3,
    velocity: Vector3,
    getBlockAt: (pos: Vector3) => BlockTypeId | null
  ): Effect.Effect<Vector3> =>
    Effect.gen(function* () {
      const belowPos = { x: position.x, y: Math.floor(position.y) - 1, z: position.z }
      const belowBlock = getBlockAt(belowPos)

      // 魂の砂（上昇流）
      if (belowBlock === 88) {
        // Soul Sand
        return {
          x: velocity.x,
          y: Math.min(velocity.y + 0.06, 0.3),
          z: velocity.z,
        }
      }

      // マグマブロック（下降流）
      if (belowBlock === 213) {
        // Magma Block
        return {
          x: velocity.x * 0.5, // 渦に巻き込まれる
          y: Math.max(velocity.y - 0.03, -0.3),
          z: velocity.z * 0.5,
        }
      }

      return velocity
    }),

  /**
   * 酸素ゲージの計算（水中呼吸）
   */
  calculateOxygenConsumption: (isSubmerged: boolean, currentOxygen: number, deltaTime: number): number => {
    if (!isSubmerged) {
      // 水上では酸素回復
      return Math.min(currentOxygen + deltaTime * 2, 20) // 最大20（10個のバブル）
    }

    // 水中では酸素消費
    return Math.max(currentOxygen - deltaTime * 0.05, 0)
  },

  /**
   * 溶岩ダメージの計算
   */
  calculateLavaDamage: (inLava: boolean, deltaTime: number): number => {
    if (!inLava) return 0
    // 溶岩は0.5秒ごとに2ハート（4ダメージ）
    return deltaTime * 8
  },
}