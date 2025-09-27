import { Effect, Context, Layer, pipe, Match } from 'effect'
import { Schema } from '@effect/schema'
import { Player } from '../entities/Player'
import {
  Direction,
  PlayerPhysicsState,
  DEFAULT_PHYSICS_STATE,
  MOVEMENT_SPEEDS,
  JUMP_VELOCITY,
  PHYSICS_CONSTANTS,
} from './PlayerState'
import type { PlayerId } from '@domain/core/types/brands'
import { type Vector3D, VectorMath, type MutableVector3D } from '@domain/core/types/spatial'

// 移動エラー定義 - 関数型スタイル
export const MovementError = Schema.TaggedStruct('MovementError', {
  message: Schema.String,
  playerId: Schema.String,
  reason: Schema.Literal('InvalidPosition', 'CollisionDetected', 'OutOfBounds', 'PhysicsError'),
})
export type MovementError = Schema.Schema.Type<typeof MovementError>

// PlayerMovementService インターフェース
export interface PlayerMovementService {
  /**
   * プレイヤーを指定方向に移動
   */
  readonly move: (player: Player, direction: Direction, deltaTime: number) => Effect.Effect<Player, MovementError>

  /**
   * ジャンプ処理
   */
  readonly jump: (player: Player) => Effect.Effect<Player, MovementError>

  /**
   * 物理シミュレーション更新
   */
  readonly updatePhysics: (player: Player, deltaTime: number) => Effect.Effect<Player, MovementError>

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
  readonly calculateFallDamage: (fallDistance: number) => Effect.Effect<number>
}

// Context Tag定義
export const PlayerMovementService = Context.GenericTag<PlayerMovementService>(
  '@minecraft/domain/PlayerMovementService'
)

// PlayerMovementService実装
const makePlayerMovementService: Effect.Effect<PlayerMovementService> = Effect.gen(function* () {
  // 移動処理
  const move = (player: Player, direction: Direction, deltaTime: number) =>
    Effect.gen(function* () {
      // ゲームモードチェック - Effect-TSパターン
      return yield* pipe(
        Match.value(player.gameMode),
        Match.when('spectator', () => Effect.succeed(moveSpectator(player, direction, deltaTime))),
        Match.orElse(() =>
          Effect.gen(function* () {
            // 移動速度の決定 - Effect-TSパターン
            const speed = yield* pipe(
              Match.value({
                sprint: direction.sprint,
                sneak: direction.sneak,
                hunger: player.stats.hunger,
                isFlying: player.abilities.isFlying,
              }),
              Match.when(
                ({ sprint, sneak, hunger }) => sprint && !sneak && hunger > 6,
                () => Effect.succeed(MOVEMENT_SPEEDS.SPRINT)
              ),
              Match.when(
                ({ sneak }) => sneak,
                () => Effect.succeed(MOVEMENT_SPEEDS.SNEAK)
              ),
              Match.when(
                ({ isFlying }) => isFlying,
                () => Effect.succeed(MOVEMENT_SPEEDS.FLY)
              ),
              Match.orElse(() => Effect.succeed(MOVEMENT_SPEEDS.WALK))
            )

            // 方向ベクトルの計算 - Effect-TSパターン
            const moveVector = yield* Effect.gen(function* () {
              // 回転を考慮した移動方向の計算
              const yawRad = (player.rotation.yaw * Math.PI) / 180
              const cosYaw = Math.cos(yawRad)
              const sinYaw = Math.sin(yawRad)

              const baseVector: MutableVector3D = { x: 0, y: 0, z: 0 }

              // 各方向の移動をパイプラインで処理
              const withForwardBackward = pipe(baseVector, (vec) => ({
                ...vec,
                x:
                  vec.x +
                  (direction.forward ? -sinYaw * speed * deltaTime : 0) +
                  (direction.backward ? sinYaw * speed * deltaTime : 0),
                z:
                  vec.z +
                  (direction.forward ? cosYaw * speed * deltaTime : 0) +
                  (direction.backward ? -cosYaw * speed * deltaTime : 0),
              }))

              const withStrafe = pipe(withForwardBackward, (vec) => ({
                ...vec,
                x:
                  vec.x +
                  (direction.left ? -cosYaw * speed * deltaTime : 0) +
                  (direction.right ? cosYaw * speed * deltaTime : 0),
                z:
                  vec.z +
                  (direction.left ? -sinYaw * speed * deltaTime : 0) +
                  (direction.right ? sinYaw * speed * deltaTime : 0),
              }))

              // 飛行モードでの上下移動 - Effect-TSパターン
              return yield* pipe(
                Match.value(player.abilities.isFlying),
                Match.when(true, () =>
                  Effect.succeed({
                    ...withStrafe,
                    y:
                      withStrafe.y +
                      (direction.jump ? speed * deltaTime : 0) +
                      (direction.sneak ? -speed * deltaTime : 0),
                  })
                ),
                Match.orElse(() => Effect.succeed(withStrafe))
              )
            })

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

            // 空腹度消費の計算 - Effect-TSパターン
            const hungerCost = yield* pipe(
              Match.value(isSprinting),
              Match.when(true, () => Effect.succeed(0.1 * deltaTime)),
              Match.orElse(() => Effect.succeed(0))
            )

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
        )
      )
    })

  // スペクテイターモード移動
  const moveSpectator = (player: Player, direction: Direction, deltaTime: number): Player => {
    const speed = MOVEMENT_SPEEDS.FLY * 2 // スペクテイターは高速移動

    const yawRad = (player.rotation.yaw * Math.PI) / 180
    const pitchRad = (player.rotation.pitch * Math.PI) / 180
    const cosYaw = Math.cos(yawRad)
    const sinYaw = Math.sin(yawRad)
    const cosPitch = Math.cos(pitchRad)
    const sinPitch = Math.sin(pitchRad)

    // Effect-TS パターンで移動ベクトル計算
    const moveVector = pipe(
      { x: 0, y: 0, z: 0 } as MutableVector3D,
      // Forward/Backward movement
      (vec) => ({
        x:
          vec.x +
          (direction.forward ? -sinYaw * cosPitch * speed * deltaTime : 0) +
          (direction.backward ? sinYaw * cosPitch * speed * deltaTime : 0),
        y:
          vec.y +
          (direction.forward ? -sinPitch * speed * deltaTime : 0) +
          (direction.backward ? sinPitch * speed * deltaTime : 0),
        z:
          vec.z +
          (direction.forward ? cosYaw * cosPitch * speed * deltaTime : 0) +
          (direction.backward ? -cosYaw * cosPitch * speed * deltaTime : 0),
      }),
      // Strafe movement
      (vec) => ({
        x:
          vec.x +
          (direction.left ? -cosYaw * speed * deltaTime : 0) +
          (direction.right ? cosYaw * speed * deltaTime : 0),
        y: vec.y,
        z:
          vec.z +
          (direction.left ? -sinYaw * speed * deltaTime : 0) +
          (direction.right ? sinYaw * speed * deltaTime : 0),
      }),
      // Vertical movement
      (vec) => ({
        x: vec.x,
        y: vec.y + (direction.jump ? speed * deltaTime : 0) + (direction.sneak ? -speed * deltaTime : 0),
        z: vec.z,
      })
    )

    return {
      ...player,
      position: VectorMath.add(player.position, moveVector),
      velocity: { x: 0, y: 0, z: 0 }, // スペクテイターは物理影響なし
    }
  }

  // ジャンプ処理
  const jump = (player: Player) =>
    Effect.gen(function* () {
      // ジャンプ可能条件チェック - Effect-TSパターン
      const canJump = yield* pipe(
        Match.value({
          isOnGround: player.isOnGround,
          canFly: player.abilities.canFly,
          gameMode: player.gameMode,
          hunger: player.stats.hunger,
        }),
        Match.when(
          ({ isOnGround, canFly, gameMode }) => !isOnGround && !canFly && gameMode !== 'creative',
          () => Effect.succeed(false)
        ),
        Match.when(
          ({ gameMode, hunger }) => gameMode === 'survival' && hunger <= 0,
          () => Effect.succeed(false)
        ),
        Match.orElse(() => Effect.succeed(true))
      )

      return yield* pipe(
        Match.value(canJump),
        Match.when(false, () => Effect.succeed(player)),
        Match.orElse(() =>
          Effect.gen(function* () {
            // ジャンプ速度を設定
            const jumpVelocity = JUMP_VELOCITY

            // 空腹度消費の計算 - Effect-TSパターン
            const hungerCost = yield* pipe(
              Match.value(player.gameMode),
              Match.when('survival', () => Effect.succeed(0.2)),
              Match.orElse(() => Effect.succeed(0))
            )

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
        )
      )
    })

  // 物理シミュレーション更新
  const updatePhysics = (player: Player, deltaTime: number) =>
    Effect.gen(function* () {
      // ゲームモードによる物理処理の分岐 - Effect-TSパターン
      return yield* pipe(
        Match.value({
          gameMode: player.gameMode,
          isFlying: player.abilities.isFlying,
        }),
        Match.when(
          ({ gameMode }) => gameMode === 'spectator',
          () => Effect.succeed(player) // スペクテイターは物理影響なし
        ),
        Match.when(
          ({ gameMode, isFlying }) => gameMode === 'creative' && isFlying,
          () => Effect.succeed(player) // クリエイティブ飛行中も物理影響なし
        ),
        Match.orElse(() =>
          Effect.gen(function* () {
            // 重力の適用
            const gravity = PHYSICS_CONSTANTS.GRAVITY
            // 将来的な実装: 水中/溶岩中での重力変更

            // 速度の更新（重力）
            const newVelocityY = Math.max(PHYSICS_CONSTANTS.TERMINAL_VELOCITY, player.velocity.y + gravity * deltaTime)

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

            // 地面接触の処理 - Effect-TSパターン
            return yield* pipe(
              Match.value({
                isNewlyGrounded: isOnGround && !player.isOnGround,
                isOnGround,
              }),
              Match.when(
                ({ isNewlyGrounded }) => isNewlyGrounded,
                () =>
                  Effect.succeed({
                    ...player,
                    position: { ...newPosition, y: 64 }, // 地面に固定
                    velocity: { x: newVelocityX, y: 0, z: newVelocityZ },
                    isOnGround: true,
                  })
              ),
              Match.orElse(({ isOnGround }) =>
                Effect.succeed({
                  ...player,
                  position: newPosition,
                  velocity: { x: newVelocityX, y: newVelocityY, z: newVelocityZ },
                  isOnGround,
                })
              )
            )
          })
        )
      )
    })

  // 衝突検出と解決
  const resolveCollisions = (player: Player, worldBounds: { min: Vector3D; max: Vector3D }) =>
    Effect.gen(function* () {
      const position = player.position
      const velocity = player.velocity

      // 各軸での衝突処理を関数型で実装
      const resolveAxis = (
        value: number,
        vel: number,
        min: number,
        max: number
      ): { position: number; velocity: number; isColliding: boolean } =>
        pipe(
          Match.value({ value, min, max }),
          Match.when(
            ({ value, min }) => value < min,
            () => ({ position: min, velocity: 0, isColliding: true })
          ),
          Match.when(
            ({ value, max }) => value > max,
            () => ({ position: max, velocity: 0, isColliding: true })
          ),
          Match.orElse(() => ({ position: value, velocity: vel, isColliding: false }))
        )

      // 各軸の衝突を解決
      const xResult = resolveAxis(position.x, velocity.x, worldBounds.min.x, worldBounds.max.x)
      const yResult = resolveAxis(position.y, velocity.y, worldBounds.min.y, worldBounds.max.y)
      const zResult = resolveAxis(position.z, velocity.z, worldBounds.min.z, worldBounds.max.z)

      // 新しい位置と速度
      const newPosition: Vector3D = {
        x: xResult.position,
        y: yResult.position,
        z: zResult.position,
      }

      const newVelocity: Vector3D = {
        x: xResult.velocity,
        y: yResult.velocity,
        z: zResult.velocity,
      }

      // 地面判定の更新
      const isOnGround = yResult.isColliding && velocity.y <= 0

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

      // Effect-TSパターンでダメージ計算
      return yield* pipe(
        Match.value(fallDistance),
        Match.when(
          (distance) => distance <= damageThreshold,
          () => Effect.succeed(0)
        ),
        Match.orElse((distance) => {
          // 3ブロックを超えた分だけダメージ（1ブロックあたり1ダメージ）
          const damage = Math.floor(distance - damageThreshold)
          return Effect.succeed(Math.min(damage, 20)) // 最大20ダメージ
        })
      )
    })

  const service: PlayerMovementService = {
    move,
    jump,
    updatePhysics,
    resolveCollisions,
    calculateFallDamage,
  }

  return service
})

// Live Layer実装
export const PlayerMovementServiceLive = Layer.effect(PlayerMovementService, makePlayerMovementService)
