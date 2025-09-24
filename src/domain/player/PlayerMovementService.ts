import { Effect, Context, Layer, pipe, Match, Schema } from 'effect'
import { Player } from '../entities/Player.js'
import {
  Direction,
  PlayerPhysicsState,
  DEFAULT_PHYSICS_STATE,
  MOVEMENT_SPEEDS,
  JUMP_VELOCITY,
  PHYSICS_CONSTANTS
} from './PlayerState.js'
import type { PlayerId } from '../../shared/types/branded.js'
import { type Vector3D, VectorMath, type MutableVector3D } from '../../shared/schemas/spatial.js'

// 移動エラー定義
export class MovementError extends Schema.TaggedError<MovementError>()('MovementError', {
  message: Schema.String,
  playerId: Schema.String,
  reason: Schema.Literal('InvalidPosition', 'CollisionDetected', 'OutOfBounds', 'PhysicsError'),
}) {}

// PlayerMovementService インターフェース
export interface PlayerMovementService {
  /**
   * プレイヤーを指定方向に移動
   */
  readonly move: (
    player: Player,
    direction: Direction,
    deltaTime: number
  ) => Effect.Effect<Player, MovementError>

  /**
   * ジャンプ処理
   */
  readonly jump: (player: Player) => Effect.Effect<Player, MovementError>

  /**
   * 物理シミュレーション更新
   */
  readonly updatePhysics: (
    player: Player,
    deltaTime: number
  ) => Effect.Effect<Player, MovementError>

  /**
   * 衝突検出と解決
   */
  readonly resolveCollisions: (
    player: Player,
    worldBounds: { min: Vector3D; max: Vector3D }
  ) => Effect.Effect<Player, MovementError>

  /**
   * 落下ダメージ計算
   */
  readonly calculateFallDamage: (
    fallDistance: number
  ) => Effect.Effect<number>
}

// Context Tag定義
export class PlayerMovementService extends Context.Tag('PlayerMovementService')<
  PlayerMovementService,
  PlayerMovementService
>() {}

// PlayerMovementService実装
const makePlayerMovementService = Effect.gen(function* () {
  // 移動処理
  const move = (player: Player, direction: Direction, deltaTime: number) =>
    Effect.gen(function* () {
      // ゲームモードチェック
      if (player.gameMode === 'spectator') {
        // スペクテイターモードは自由移動
        return moveSpectator(player, direction, deltaTime)
      }

      // 移動速度の決定
      let speed: number = MOVEMENT_SPEEDS.WALK

      // スプリント/スニーク状態の処理
      if (direction.sprint && !direction.sneak && player.stats.hunger > 6) {
        speed = MOVEMENT_SPEEDS.SPRINT
      } else if (direction.sneak) {
        speed = MOVEMENT_SPEEDS.SNEAK
      } else if (player.abilities.isFlying) {
        speed = MOVEMENT_SPEEDS.FLY
      }

      // 方向ベクトルの計算
      const moveVector: MutableVector3D = { x: 0, y: 0, z: 0 }

      // 回転を考慮した移動方向の計算
      const yawRad = (player.rotation.yaw * Math.PI) / 180
      const cosYaw = Math.cos(yawRad)
      const sinYaw = Math.sin(yawRad)

      // Forward/Backward
      if (direction.forward) {
        moveVector.x -= sinYaw * speed * deltaTime
        moveVector.z += cosYaw * speed * deltaTime
      }
      if (direction.backward) {
        moveVector.x += sinYaw * speed * deltaTime
        moveVector.z -= cosYaw * speed * deltaTime
      }

      // Strafe Left/Right
      if (direction.left) {
        moveVector.x -= cosYaw * speed * deltaTime
        moveVector.z -= sinYaw * speed * deltaTime
      }
      if (direction.right) {
        moveVector.x += cosYaw * speed * deltaTime
        moveVector.z += sinYaw * speed * deltaTime
      }

      // 飛行モードでの上下移動
      if (player.abilities.isFlying) {
        if (direction.jump) moveVector.y += speed * deltaTime
        if (direction.sneak) moveVector.y -= speed * deltaTime
      }

      // 新しい位置の計算
      const newPosition = VectorMath.add(player.position, moveVector)

      // 速度の更新（移動による速度変更）
      const newVelocity: Vector3D = {
        x: moveVector.x / deltaTime,
        y: player.velocity.y, // Y速度は物理計算で更新
        z: moveVector.z / deltaTime,
      }

      // スプリント/スニーク状態の更新
      const isSprinting = direction.sprint && !direction.sneak && player.stats.hunger > 6
      const isSneaking = direction.sneak

      // 空腹度消費（スプリント時）
      const hungerCost = isSprinting ? 0.1 * deltaTime : 0

      return {
        ...player,
        position: newPosition,
        velocity: newVelocity,
        isSprinting,
        isSneaking,
        stats: {
          ...player.stats,
          hunger: Math.max(0, player.stats.hunger - hungerCost),
        },
      }
    })

  // スペクテイターモード移動
  const moveSpectator = (player: Player, direction: Direction, deltaTime: number): Player => {
    const speed = MOVEMENT_SPEEDS.FLY * 2 // スペクテイターは高速移動

    const moveVector: MutableVector3D = { x: 0, y: 0, z: 0 }
    const yawRad = (player.rotation.yaw * Math.PI) / 180
    const pitchRad = (player.rotation.pitch * Math.PI) / 180
    const cosYaw = Math.cos(yawRad)
    const sinYaw = Math.sin(yawRad)
    const cosPitch = Math.cos(pitchRad)
    const sinPitch = Math.sin(pitchRad)

    // 3D空間での自由移動
    if (direction.forward) {
      moveVector.x -= sinYaw * cosPitch * speed * deltaTime
      moveVector.y -= sinPitch * speed * deltaTime
      moveVector.z += cosYaw * cosPitch * speed * deltaTime
    }
    if (direction.backward) {
      moveVector.x += sinYaw * cosPitch * speed * deltaTime
      moveVector.y += sinPitch * speed * deltaTime
      moveVector.z -= cosYaw * cosPitch * speed * deltaTime
    }

    // Strafe
    if (direction.left) {
      moveVector.x -= cosYaw * speed * deltaTime
      moveVector.z -= sinYaw * speed * deltaTime
    }
    if (direction.right) {
      moveVector.x += cosYaw * speed * deltaTime
      moveVector.z += sinYaw * speed * deltaTime
    }

    // 垂直移動
    if (direction.jump) moveVector.y += speed * deltaTime
    if (direction.sneak) moveVector.y -= speed * deltaTime

    return {
      ...player,
      position: VectorMath.add(player.position, moveVector),
      velocity: { x: 0, y: 0, z: 0 }, // スペクテイターは物理影響なし
    }
  }

  // ジャンプ処理
  const jump = (player: Player) =>
    Effect.gen(function* () {
      // ジャンプ可能条件チェック
      if (!player.isOnGround && !player.abilities.canFly && player.gameMode !== 'creative') {
        return player // ジャンプできない
      }

      // 空腹度チェック（サバイバルモード）
      if (player.gameMode === 'survival' && player.stats.hunger <= 0) {
        return player // 空腹でジャンプ不可
      }

      // ジャンプ速度を設定
      const jumpVelocity = JUMP_VELOCITY

      // 空腹度消費（サバイバルモード）
      const hungerCost = player.gameMode === 'survival' ? 0.2 : 0

      return {
        ...player,
        velocity: {
          ...player.velocity,
          y: jumpVelocity,
        },
        isOnGround: false,
        stats: {
          ...player.stats,
          hunger: Math.max(0, player.stats.hunger - hungerCost),
        },
      }
    })

  // 物理シミュレーション更新
  const updatePhysics = (player: Player, deltaTime: number) =>
    Effect.gen(function* () {
      // クリエイティブ/スペクテイターモードは物理影響なし
      if (player.gameMode === 'creative' || player.gameMode === 'spectator') {
        if (!player.abilities.isFlying && player.gameMode === 'creative') {
          // クリエイティブでも飛行していない場合は重力あり
        } else {
          return player
        }
      }

      // 重力の適用
      let gravity = PHYSICS_CONSTANTS.GRAVITY

      // 水中/溶岩中での重力減少（将来的な実装のプレースホルダー）
      // if (isInWater(player)) gravity = PHYSICS_CONSTANTS.WATER_GRAVITY
      // if (isInLava(player)) gravity = PHYSICS_CONSTANTS.LAVA_GRAVITY

      // 速度の更新（重力）
      const newVelocityY = Math.max(
        PHYSICS_CONSTANTS.TERMINAL_VELOCITY,
        player.velocity.y + gravity * deltaTime
      )

      // 空気抵抗の適用（水平方向）
      const horizontalDrag = PHYSICS_CONSTANTS.AIR_RESISTANCE
      const newVelocityX = player.velocity.x * Math.pow(horizontalDrag, deltaTime)
      const newVelocityZ = player.velocity.z * Math.pow(horizontalDrag, deltaTime)

      // 位置の更新
      const deltaPosition: Vector3D = {
        x: newVelocityX * deltaTime,
        y: newVelocityY * deltaTime,
        z: newVelocityZ * deltaTime,
      }

      const newPosition = VectorMath.add(player.position, deltaPosition)

      // 地面判定（簡易版 - 実際はワールドとの衝突判定が必要）
      const isOnGround = newPosition.y <= 64 && newVelocityY <= 0 // Y=64を仮の地面とする

      // 地面に接触した場合の処理
      if (isOnGround && !player.isOnGround) {
        // 落下ダメージ計算用の落下距離（将来実装）
        const fallDistance = Math.abs(player.velocity.y * deltaTime)

        // 速度リセット
        return {
          ...player,
          position: { ...newPosition, y: 64 }, // 地面に固定
          velocity: { x: newVelocityX, y: 0, z: newVelocityZ },
          isOnGround: true,
        }
      }

      return {
        ...player,
        position: newPosition,
        velocity: { x: newVelocityX, y: newVelocityY, z: newVelocityZ },
        isOnGround,
      }
    })

  // 衝突検出と解決
  const resolveCollisions = (
    player: Player,
    worldBounds: { min: Vector3D; max: Vector3D }
  ) =>
    Effect.gen(function* () {
      const position = player.position
      const velocity = player.velocity
      let newPosition = { ...position }
      let newVelocity = { ...velocity }
      let collisionFlags = {
        isCollidingX: false,
        isCollidingY: false,
        isCollidingZ: false,
      }

      // ワールド境界との衝突検出
      // X軸
      if (newPosition.x < worldBounds.min.x) {
        newPosition.x = worldBounds.min.x
        newVelocity.x = 0
        collisionFlags.isCollidingX = true
      } else if (newPosition.x > worldBounds.max.x) {
        newPosition.x = worldBounds.max.x
        newVelocity.x = 0
        collisionFlags.isCollidingX = true
      }

      // Y軸
      if (newPosition.y < worldBounds.min.y) {
        newPosition.y = worldBounds.min.y
        newVelocity.y = 0
        collisionFlags.isCollidingY = true
      } else if (newPosition.y > worldBounds.max.y) {
        newPosition.y = worldBounds.max.y
        newVelocity.y = 0
        collisionFlags.isCollidingY = true
      }

      // Z軸
      if (newPosition.z < worldBounds.min.z) {
        newPosition.z = worldBounds.min.z
        newVelocity.z = 0
        collisionFlags.isCollidingZ = true
      } else if (newPosition.z > worldBounds.max.z) {
        newPosition.z = worldBounds.max.z
        newVelocity.z = 0
        collisionFlags.isCollidingZ = true
      }

      // 地面判定の更新
      const isOnGround = collisionFlags.isCollidingY && velocity.y <= 0

      return {
        ...player,
        position: newPosition,
        velocity: newVelocity,
        isOnGround: isOnGround || player.isOnGround,
      }
    })

  // 落下ダメージ計算
  const calculateFallDamage = (fallDistance: number) =>
    Effect.gen(function* () {
      // Minecraft標準: 3ブロック以上の落下でダメージ
      const damageThreshold = 3.0

      if (fallDistance <= damageThreshold) {
        return 0
      }

      // 3ブロックを超えた分だけダメージ（1ブロックあたり1ダメージ）
      const damage = Math.floor(fallDistance - damageThreshold)

      return Math.min(damage, 20) // 最大20ダメージ
    })

  return PlayerMovementService.of({
    move,
    jump,
    updatePhysics,
    resolveCollisions,
    calculateFallDamage,
  })
})

// Live Layer実装
export const PlayerMovementServiceLive = Layer.effect(
  PlayerMovementService,
  makePlayerMovementService
)