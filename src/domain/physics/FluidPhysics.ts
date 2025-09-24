import { Effect, pipe, Match } from 'effect'
import type { Vector3 } from '../world/types'
import type { BlockTypeId } from '../../shared/types/branded'
import type { FluidType, FluidPhysicsResult } from './types'
import { PHYSICS_CONSTANTS } from './types'

/**
 * 流体物理システム
 * 水と溶岩の中での動作を制御
 */
export const FluidPhysics = {
  /**
   * ブロックタイプから流体タイプを判定
   */
  getFluidType: (blockType: BlockTypeId | null): FluidType => {
    return pipe(
      blockType,
      Match.value,
      Match.when((blockType) => !blockType, () => 'none' as const),
      Match.when((blockType) => {
        const id = Number(blockType)
        return id === 8 || id === 9
      }, () => 'water' as const), // 水と静水
      Match.when((blockType) => {
        const id = Number(blockType)
        return id === 10 || id === 11
      }, () => 'lava' as const), // 溶岩と静止溶岩
      Match.orElse(() => 'none' as const),
      Match.exhaustive
    )
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
    // 流体がない場合の早期リターン
    return yield* pipe(
      fluidType === 'none',
      Match.value,
      Match.when(true, () => Effect.succeed({
        velocity,
        buoyancy: 0,
        isSubmerged: false,
        submersionDepth: 0,
      })),
      Match.when(false, () => Effect.gen(function* () {
        // エンティティの頭部と足元の流体チェック
        const headPos = { x: position.x, y: position.y + 1.8, z: position.z }
        const feetPos = { x: position.x, y: position.y, z: position.z }

        const headFluid = FluidPhysics.getFluidType(getBlockAt(headPos))
        const feetFluid = FluidPhysics.getFluidType(getBlockAt(feetPos))

        const isSubmerged = headFluid !== 'none'
        const isPartiallySubmerged = feetFluid !== 'none'

        // 部分的沈満もしていない場合の早期リターン
        return yield* pipe(
          !isPartiallySubmerged,
          Match.value,
          Match.when(true, () => Effect.succeed({
            velocity,
            buoyancy: 0,
            isSubmerged: false,
            submersionDepth: 0,
          })),
          Match.when(false, () => Effect.gen(function* () {
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
          })),
          Match.exhaustive
        )
      })),
      Match.exhaustive
    )
  }),
