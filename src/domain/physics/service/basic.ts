import type { BlockTypeId } from '@domain/core/types/brands'
import { Context, Effect } from 'effect'
import type { Vector3 } from '../../world/types'
import type { AABB, CollisionResult, FluidPhysicsResult, FluidType, PhysicsError } from '../types'

/**
 * 物理エンジンサービスインターフェース
 * 重力、衝突検出、摩擦、流体物理を統合管理
 */
export interface PhysicsService {
  /**
   * 重力を適用
   */
  readonly applyGravity: (
    velocity: Vector3,
    deltaTime: number,
    inFluid: boolean
  ) => Effect.Effect<Vector3, PhysicsError>

  /**
   * 衝突検出
   */
  readonly checkCollision: (
    position: Vector3,
    velocity: Vector3,
    boundingBox: AABB
  ) => Effect.Effect<CollisionResult, PhysicsError>

  /**
   * 摩擦を適用
   */
  readonly applyFriction: (
    velocity: Vector3,
    isGrounded: boolean,
    blockType: BlockTypeId
  ) => Effect.Effect<Vector3, PhysicsError>

  /**
   * 流体物理演算
   */
  readonly calculateFluidPhysics: (
    position: Vector3,
    velocity: Vector3,
    fluidType: FluidType
  ) => Effect.Effect<FluidPhysicsResult, PhysicsError>

  /**
   * 統合物理ステップ実行
   */
  readonly physicsStep: (params: {
    position: Vector3
    velocity: Vector3
    boundingBox: AABB
    deltaTime: number
    groundBlockType: BlockTypeId
  }) => Effect.Effect<
    {
      position: Vector3
      velocity: Vector3
      isGrounded: boolean
      isInFluid: boolean
      fluidType: FluidType
    },
    PhysicsError
  >
}

/**
 * PhysicsService タグ
 */
export const PhysicsService = Context.GenericTag<PhysicsService>('@minecraft/domain/PhysicsService')
