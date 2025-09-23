import { Effect, Layer, pipe } from 'effect'
import type { Vector3 } from '../world/types'
import type { BlockTypeId } from '../../shared/types/branded'
import type { AABB, CollisionResult, FluidPhysicsResult, FluidType, PhysicsError } from './types'
import { PhysicsService } from './PhysicsService'
import { Gravity } from './Gravity'
import { CollisionDetection } from './CollisionDetection'
import { Friction } from './Friction'
import { FluidPhysics } from './FluidPhysics'

/**
 * 物理システム実装
 * 全ての物理コンポーネントを統合
 */
export const makePhysicsSystem = (getBlockAt: (pos: Vector3) => BlockTypeId | null): PhysicsService => ({
  applyGravity: (velocity: Vector3, deltaTime: number, inFluid: boolean) =>
    pipe(
      Gravity.apply(velocity, deltaTime, inFluid),
      Effect.mapError(
        (error) =>
          ({
            _tag: 'PhysicsError',
            message: `Failed to apply gravity: ${error}`,
            cause: error,
          }) as PhysicsError
      )
    ),

  checkCollision: (position: Vector3, velocity: Vector3, boundingBox: AABB) =>
    pipe(
      CollisionDetection.detectCollision(position, velocity, boundingBox, getBlockAt),
      Effect.mapError(
        (error) =>
          ({
            _tag: 'PhysicsError',
            message: `Collision detection failed: ${error}`,
            cause: error,
          }) as PhysicsError
      )
    ),

  applyFriction: (velocity: Vector3, isGrounded: boolean, blockType: BlockTypeId) =>
    pipe(
      Friction.applyGroundFriction(velocity, isGrounded, blockType),
      Effect.mapError(
        (error) =>
          ({
            _tag: 'PhysicsError',
            message: `Failed to apply friction: ${error}`,
            cause: error,
          }) as PhysicsError
      )
    ),

  calculateFluidPhysics: (position: Vector3, velocity: Vector3, fluidType: FluidType) =>
    pipe(
      FluidPhysics.calculateFluidPhysics(position, velocity, fluidType, getBlockAt),
      Effect.mapError(
        (error) =>
          ({
            _tag: 'PhysicsError',
            message: `Fluid physics calculation failed: ${error}`,
            cause: error,
          }) as PhysicsError
      )
    ),

  physicsStep: (params) =>
    Effect.gen(function* () {
      const { position, velocity, boundingBox, deltaTime, groundBlockType } = params

      // 1. 現在位置の流体をチェック
      const currentBlockPos = {
        x: Math.floor(position.x),
        y: Math.floor(position.y + 0.5),
        z: Math.floor(position.z),
      }
      const currentBlock = getBlockAt(currentBlockPos)
      const fluidType = FluidPhysics.getFluidType(currentBlock)

      // 2. 流体物理を適用
      let updatedVelocity = velocity
      if (fluidType !== 'none') {
        const fluidResult = yield* pipe(
          FluidPhysics.calculateFluidPhysics(position, velocity, fluidType, getBlockAt),
          Effect.mapError(
            (error) =>
              ({
                _tag: 'PhysicsError',
                message: `Fluid physics failed: ${error}`,
                cause: error,
              }) as PhysicsError
          )
        )
        updatedVelocity = fluidResult.velocity
      }

      // 3. 重力を適用
      updatedVelocity = yield* pipe(
        Gravity.apply(updatedVelocity, deltaTime, fluidType !== 'none'),
        Effect.mapError(
          (error) =>
            ({
              _tag: 'PhysicsError',
              message: `Gravity application failed: ${error}`,
              cause: error,
            }) as PhysicsError
        )
      )

      // 4. 衝突検出と応答
      const collisionResult = yield* pipe(
        CollisionDetection.detectCollision(position, updatedVelocity, boundingBox, getBlockAt),
        Effect.mapError(
          (error) =>
            ({
              _tag: 'PhysicsError',
              message: `Collision detection failed: ${error}`,
              cause: error,
            }) as PhysicsError
        )
      )

      // 5. 摩擦を適用
      if (collisionResult.isGrounded) {
        updatedVelocity = yield* pipe(
          Friction.applyGroundFriction(collisionResult.velocity, true, groundBlockType),
          Effect.mapError(
            (error) =>
              ({
                _tag: 'PhysicsError',
                message: `Friction application failed: ${error}`,
                cause: error,
              }) as PhysicsError
          )
        )
      } else if (fluidType === 'none') {
        // 空中では空気抵抗を適用
        updatedVelocity = yield* pipe(
          Gravity.applyAirResistance(collisionResult.velocity),
          Effect.mapError(
            (error) =>
              ({
                _tag: 'PhysicsError',
                message: `Air resistance failed: ${error}`,
                cause: error,
              }) as PhysicsError
          )
        )
      }

      // 6. デッドゾーンを適用（微小な速度を0にする）
      updatedVelocity = Friction.applyDeadZone(updatedVelocity)

      return {
        position: collisionResult.position,
        velocity: updatedVelocity,
        isGrounded: collisionResult.isGrounded,
        isInFluid: fluidType !== 'none',
        fluidType,
      }
    }),
})

/**
 * PhysicsService Layer実装
 * ワールドのブロック取得関数を必要とする
 */
export const PhysicsServiceLive = (getBlockAt: (pos: Vector3) => BlockTypeId | null) =>
  Layer.succeed(PhysicsService, makePhysicsSystem(getBlockAt))

/**
 * テスト用のモックPhysicsService
 */
export const PhysicsServiceTest = Layer.succeed(
  PhysicsService,
  makePhysicsSystem(() => null) // 全てのブロックを空気として扱う
)
