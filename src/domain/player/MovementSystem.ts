import type { PlayerId } from '@domain/core/types/brands'
import { Schema } from '@effect/schema'
import { Context, Effect, Match, pipe } from 'effect'
import type { PlayerError, PlayerPosition, PlayerRotation } from './PlayerService'
import { createPlayerError } from './PlayerService'

// Re-export types and functions needed by MovementSystem consumers
export { createPlayerError } from './PlayerService'
export type { PlayerError, PlayerPosition, PlayerRotation } from './PlayerService'

/**
 * 物理定数
 */
export const PHYSICS_CONSTANTS = {
  GRAVITY: -9.81, // m/s²
  MAX_SPEED: 10.0, // m/s
  FRICTION: 0.8, // 摩擦係数
  JUMP_FORCE: 8.0, // ジャンプ力
  TERMINAL_VELOCITY: -50.0, // 終端速度
  COLLISION_EPSILON: 0.001, // 衝突判定の許容誤差
} as const

/**
 * 移動方向
 */
export const MovementDirection = Schema.Literal('FORWARD', 'BACKWARD', 'LEFT', 'RIGHT', 'UP', 'DOWN')
export type MovementDirection = Schema.Schema.Type<typeof MovementDirection>

/**
 * 入力状態
 */
export const MovementInput = Schema.Struct({
  forward: Schema.Boolean,
  backward: Schema.Boolean,
  left: Schema.Boolean,
  right: Schema.Boolean,
  jump: Schema.Boolean,
  sprint: Schema.Boolean,
  deltaTime: Schema.Number.pipe(Schema.positive()), // milliseconds
})
export type MovementInput = Schema.Schema.Type<typeof MovementInput>

/**
 * 速度ベクトル
 */
export const VelocityVector = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})
export type VelocityVector = Schema.Schema.Type<typeof VelocityVector>

/**
 * 移動状態
 */
export const MovementState = Schema.Struct({
  velocity: VelocityVector,
  isGrounded: Schema.Boolean,
  isJumping: Schema.Boolean,
  isSprinting: Schema.Boolean,
  lastUpdate: Schema.Number,
})
export type MovementState = Schema.Schema.Type<typeof MovementState>

/**
 * 物理計算の結果
 */
export const PhysicsResult = Schema.Struct({
  newPosition: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  newVelocity: VelocityVector,
  newState: MovementState,
  collisions: Schema.Array(Schema.String), // 衝突したオブジェクトのリスト
})
export type PhysicsResult = Schema.Schema.Type<typeof PhysicsResult>

/**
 * MovementSystem - プレイヤー移動システム
 *
 * 物理ベースの移動システム:
 * - WASD入力処理
 * - 重力・摩擦・ジャンプの物理計算
 * - 衝突検出
 * - 60FPS対応の高精度計算
 */
export interface MovementSystem {
  /**
   * 移動入力の処理
   */
  readonly processMovementInput: (playerId: PlayerId, input: unknown) => Effect.Effect<PhysicsResult, PlayerError>

  /**
   * 物理計算の実行
   */
  readonly updatePhysics: (playerId: PlayerId, deltaTime: number) => Effect.Effect<PhysicsResult, PlayerError>

  /**
   * プレイヤーの移動状態取得
   */
  readonly getMovementState: (playerId: PlayerId) => Effect.Effect<MovementState, PlayerError>

  /**
   * プレイヤーの移動状態設定
   */
  readonly setMovementState: (playerId: PlayerId, state: unknown) => Effect.Effect<void, PlayerError>

  /**
   * 衝突検出
   */
  readonly checkCollisions: (
    position: PlayerPosition,
    velocity: VelocityVector
  ) => Effect.Effect<ReadonlyArray<string>, never>

  /**
   * 地面との接触判定
   */
  readonly checkGrounded: (position: PlayerPosition) => Effect.Effect<boolean, never>

  /**
   * 速度制限の適用
   */
  readonly applyVelocityLimits: (velocity: VelocityVector) => Effect.Effect<VelocityVector, never>

  /**
   * フレームレート独立の移動計算
   */
  readonly calculateFrameIndependentMovement: (
    currentPosition: PlayerPosition,
    velocity: VelocityVector,
    deltaTime: number
  ) => Effect.Effect<PlayerPosition, never>

  /**
   * パフォーマンス統計の取得
   */
  readonly getPerformanceStats: () => Effect.Effect<
    {
      averageProcessingTime: number
      maxProcessingTime: number
      frameRate: number
      totalCalculations: number
    },
    never
  >
}

/**
 * MovementSystem サービスタグ
 */
export const MovementSystem = Context.GenericTag<MovementSystem>('@minecraft/domain/MovementSystem')

/**
 * 移動入力の検証
 */
export const validateMovementInput = (input: unknown): Effect.Effect<MovementInput, PlayerError> =>
  pipe(
    Schema.decodeUnknown(MovementInput)(input),
    Effect.mapError((parseError) =>
      createPlayerError.validationError(`Movement input validation failed: ${parseError.message}`, input)
    )
  )

/**
 * 移動状態の検証
 */
export const validateMovementState = (state: unknown): Effect.Effect<MovementState, PlayerError> =>
  pipe(
    Schema.decodeUnknown(MovementState)(state),
    Effect.mapError((parseError) =>
      createPlayerError.validationError(`Movement state validation failed: ${parseError.message}`, state)
    )
  )

/**
 * 速度ベクトルの検証
 */
export const validateVelocityVector = (velocity: unknown): Effect.Effect<VelocityVector, PlayerError> =>
  pipe(
    Schema.decodeUnknown(VelocityVector)(velocity),
    Effect.mapError((parseError) =>
      createPlayerError.validationError(`Velocity vector validation failed: ${parseError.message}`, velocity)
    )
  )

/**
 * デフォルトの移動状態
 */
export const DEFAULT_MOVEMENT_STATE: MovementState = {
  velocity: { x: 0, y: 0, z: 0 },
  isGrounded: true,
  isJumping: false,
  isSprinting: false,
  lastUpdate: 0,
}

/**
 * 物理計算ユーティリティ
 */
export const PhysicsUtils = {
  /**
   * 重力の適用
   */
  applyGravity: (velocity: VelocityVector, deltaTime: number): VelocityVector => {
    const gravityDelta = PHYSICS_CONSTANTS.GRAVITY * (deltaTime / 1000)
    return {
      ...velocity,
      y: Math.max(velocity.y + gravityDelta, PHYSICS_CONSTANTS.TERMINAL_VELOCITY),
    }
  },

  /**
   * 摩擦の適用
   */
  applyFriction: (velocity: VelocityVector, friction: number): VelocityVector => {
    return {
      x: velocity.x * friction,
      y: velocity.y,
      z: velocity.z * friction,
    }
  },

  /**
   * 速度の正規化
   */
  normalizeVelocity: (velocity: VelocityVector, maxSpeed: number): VelocityVector => {
    const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z)

    return pipe(
      horizontalSpeed > maxSpeed,
      Match.value,
      Match.when(false, () => velocity),
      Match.orElse(() => {
        const ratio = maxSpeed / horizontalSpeed
        return {
          x: velocity.x * ratio,
          y: velocity.y,
          z: velocity.z * ratio,
        }
      })
    )
  },

  /**
   * ベクトルの大きさ計算
   */
  getMagnitude: (velocity: VelocityVector): number => {
    return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z)
  },

  /**
   * ベクトルの距離計算
   */
  getDistance: (pos1: PlayerPosition, pos2: PlayerPosition): number => {
    const dx = pos1.x - pos2.x
    const dy = pos1.y - pos2.y
    const dz = pos1.z - pos2.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  },

  /**
   * 線形補間
   */
  lerp: (from: number, to: number, t: number): number => {
    return from + (to - from) * Math.max(0, Math.min(1, t))
  },

  /**
   * ベクトルの線形補間
   */
  lerpVector: (from: VelocityVector, to: VelocityVector, t: number): VelocityVector => {
    return {
      x: PhysicsUtils.lerp(from.x, to.x, t),
      y: PhysicsUtils.lerp(from.y, to.y, t),
      z: PhysicsUtils.lerp(from.z, to.z, t),
    }
  },
}

/**
 * 入力処理ユーティリティ
 */
export const InputUtils = {
  /**
   * WASD入力から方向ベクトルを計算
   */
  calculateMovementVector: (
    input: MovementInput,
    rotation: PlayerRotation,
    sprintMultiplier: number = 1.5
  ): VelocityVector => {
    // Forward/backward movement
    const forward = input.forward && !input.backward ? 1 : !input.forward && input.backward ? -1 : 0

    // Right/left movement
    const right = input.right && !input.left ? 1 : !input.right && input.left ? -1 : 0

    // 回転を考慮した方向計算
    const yaw = rotation.yaw
    const cos = Math.cos(yaw)
    const sin = Math.sin(yaw)

    const worldX = forward * sin + right * cos
    const worldZ = forward * cos - right * sin

    const speedMultiplier = pipe(
      input.sprint,
      Match.value,
      Match.when(false, () => 1.0),
      Match.orElse(() => sprintMultiplier)
    )

    const baseSpeed = PHYSICS_CONSTANTS.MAX_SPEED * speedMultiplier

    return {
      x: worldX * baseSpeed,
      y: 0,
      z: worldZ * baseSpeed,
    }
  },

  /**
   * ジャンプ入力の処理
   */
  processJumpInput: (input: MovementInput, currentVelocity: VelocityVector, isGrounded: boolean): VelocityVector => {
    return pipe(
      Match.value({ jump: input.jump, isGrounded }),
      Match.when(
        ({ jump, isGrounded }) => jump && isGrounded,
        () => ({
          ...currentVelocity,
          y: PHYSICS_CONSTANTS.JUMP_FORCE,
        })
      ),
      Match.orElse(() => currentVelocity)
    )
  },
}
