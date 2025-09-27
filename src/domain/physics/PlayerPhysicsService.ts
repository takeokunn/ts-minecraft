import { Context, Effect, Layer, pipe, Match } from 'effect'
import { Player } from '../entities/Player'
import { Direction, MOVEMENT_SPEEDS, JUMP_VELOCITY } from '../player/PlayerState'
import type { PlayerId } from '@domain/core/types/brands'
import type { Vector3D } from '@domain/core/types/spatial'
import { CannonPhysicsService, type PhysicsBodyState } from './CannonPhysicsService'

/**
 * Player Physics Service
 * プレイヤー専用の物理演算サービス - Cannon-esとの統合層
 */

// Player物理状態エラー
export interface PlayerPhysicsError {
  readonly _tag: 'PlayerPhysicsError'
  readonly message: string
  readonly playerId?: PlayerId
  readonly cause?: unknown
}

// Player物理設定
export interface PlayerPhysicsConfig {
  readonly moveForceMultiplier: number
  readonly jumpVelocity: number
  readonly maxSpeed: number
  readonly airControlFactor: number
  readonly groundFriction: number
}

// デフォルト物理設定
export const DEFAULT_PHYSICS_CONFIG: PlayerPhysicsConfig = {
  moveForceMultiplier: 500.0, // プレイヤーの移動力
  jumpVelocity: JUMP_VELOCITY,
  maxSpeed: MOVEMENT_SPEEDS.SPRINT,
  airControlFactor: 0.3, // 空中での制御力
  groundFriction: 0.8, // 地上での摩擦
} as const

// プレイヤー物理状態
export interface PlayerPhysicsState {
  readonly playerId: PlayerId
  readonly bodyId: string
  readonly physicsState: PhysicsBodyState
  readonly movementConfig: PlayerPhysicsConfig
  readonly lastGroundTime: number
  readonly fallStartY: number
}

// Player Physics Serviceインターフェース
export interface PlayerPhysicsService {
  /**
   * プレイヤー物理の初期化
   */
  readonly initializePlayerPhysics: (
    player: Player,
    config?: Partial<PlayerPhysicsConfig>
  ) => Effect.Effect<PlayerPhysicsState, PlayerPhysicsError>

  /**
   * プレイヤーの移動処理（WASD + マウスルック）
   */
  readonly movePlayer: (
    physicsState: PlayerPhysicsState,
    direction: Direction,
    deltaTime: number
  ) => Effect.Effect<PlayerPhysicsState, PlayerPhysicsError>

  /**
   * プレイヤーのジャンプ処理
   */
  readonly jumpPlayer: (physicsState: PlayerPhysicsState) => Effect.Effect<PlayerPhysicsState, PlayerPhysicsError>

  /**
   * 物理状態の同期（Playerエンティティに反映）
   */
  readonly syncPlayerState: (
    player: Player,
    physicsState: PlayerPhysicsState
  ) => Effect.Effect<Player, PlayerPhysicsError>

  /**
   * 落下ダメージの計算
   */
  readonly calculateFallDamage: (
    physicsState: PlayerPhysicsState,
    currentY: number
  ) => Effect.Effect<{ damage: number; newState: PlayerPhysicsState }, PlayerPhysicsError>

  /**
   * プレイヤー物理状態の更新
   */
  readonly updatePlayerPhysics: (
    physicsState: PlayerPhysicsState,
    deltaTime: number
  ) => Effect.Effect<PlayerPhysicsState, PlayerPhysicsError>

  /**
   * プレイヤー物理の終了処理
   */
  readonly destroyPlayerPhysics: (physicsState: PlayerPhysicsState) => Effect.Effect<void, PlayerPhysicsError>
}

// Context Tag定義
export const PlayerPhysicsService = Context.GenericTag<PlayerPhysicsService>('@minecraft/domain/PlayerPhysicsService')

// Player Physics Service実装
const makePlayerPhysicsService: Effect.Effect<PlayerPhysicsService, never, CannonPhysicsService> = Effect.gen(
  function* () {
    const cannonPhysics = yield* CannonPhysicsService

    // プレイヤー物理の初期化
    const initializePlayerPhysics = (player: Player, config: Partial<PlayerPhysicsConfig> = {}) =>
      Effect.gen(function* () {
        const finalConfig: PlayerPhysicsConfig = {
          ...DEFAULT_PHYSICS_CONFIG,
          ...config,
        }

        // Cannon-es Character Controllerを作成
        const bodyId = yield* pipe(
          cannonPhysics.createPlayerController(player.id, player.position),
          Effect.mapError(
            (error): PlayerPhysicsError => ({
              _tag: 'PlayerPhysicsError',
              message: `Failed to create physics controller for player ${player.id}`,
              playerId: player.id,
              cause: error,
            })
          )
        )

        // 初期物理状態を取得
        const physicsState = yield* pipe(
          cannonPhysics.getPlayerState(bodyId),
          Effect.mapError(
            (error): PlayerPhysicsError => ({
              _tag: 'PlayerPhysicsError',
              message: `Failed to get initial physics state for player ${player.id}`,
              playerId: player.id,
              cause: error,
            })
          )
        )

        const playerPhysicsState: PlayerPhysicsState = {
          playerId: player.id,
          bodyId,
          physicsState,
          movementConfig: finalConfig,
          lastGroundTime: Date.now(),
          fallStartY: player.position.y,
        }

        console.log(`Player physics initialized for ${player.id} with bodyId: ${bodyId}`)
        return playerPhysicsState
      })

    // プレイヤーの移動処理
    const movePlayer = (physicsState: PlayerPhysicsState, direction: Direction, deltaTime: number) =>
      Effect.gen(function* () {
        // 移動速度の決定 - Effect-TSパターン
        const speed = yield* pipe(
          Match.value({
            sprint: direction.sprint,
            sneak: direction.sneak,
            isOnGround: physicsState.physicsState.isOnGround,
          }),
          Match.when(
            ({ sprint, sneak, isOnGround }) => sprint && !sneak && isOnGround,
            () => Effect.succeed(MOVEMENT_SPEEDS.SPRINT)
          ),
          Match.when(
            ({ sneak }) => sneak,
            () => Effect.succeed(MOVEMENT_SPEEDS.SNEAK)
          ),
          Match.orElse(() => Effect.succeed(MOVEMENT_SPEEDS.WALK))
        )

        // 移動方向ベクトルの計算（水平面のみ）
        const moveVector = yield* Effect.sync(() => {
          const baseVector = { x: 0, y: 0, z: 0 }

          // Forward/Backward
          if (direction.forward) {
            baseVector.z -= 1
          }
          if (direction.backward) {
            baseVector.z += 1
          }

          // Left/Right
          if (direction.left) {
            baseVector.x -= 1
          }
          if (direction.right) {
            baseVector.x += 1
          }

          // ベクトルを正規化
          const length = Math.sqrt(baseVector.x * baseVector.x + baseVector.z * baseVector.z)
          if (length > 0) {
            baseVector.x /= length
            baseVector.z /= length
          }

          return baseVector
        })

        // 移動力の適用 - 地上と空中で制御力を変える
        const forceMultiplier = physicsState.physicsState.isOnGround
          ? physicsState.movementConfig.moveForceMultiplier
          : physicsState.movementConfig.moveForceMultiplier * physicsState.movementConfig.airControlFactor

        const force: Vector3D = {
          x: moveVector.x * speed * forceMultiplier * deltaTime,
          y: 0, // Y方向は重力とジャンプで制御
          z: moveVector.z * speed * forceMultiplier * deltaTime,
        }

        // Cannon-esに移動力を適用
        yield* pipe(
          cannonPhysics.applyMovementForce(physicsState.bodyId, force),
          Effect.mapError(
            (error): PlayerPhysicsError => ({
              _tag: 'PlayerPhysicsError',
              message: `Failed to apply movement force to player ${physicsState.playerId}`,
              playerId: physicsState.playerId,
              cause: error,
            })
          )
        )

        // 更新された物理状態を取得
        const newPhysicsState = yield* pipe(
          cannonPhysics.getPlayerState(physicsState.bodyId),
          Effect.mapError(
            (error): PlayerPhysicsError => ({
              _tag: 'PlayerPhysicsError',
              message: `Failed to get updated physics state for player ${physicsState.playerId}`,
              playerId: physicsState.playerId,
              cause: error,
            })
          )
        )

        // 地面接触時間の更新
        const lastGroundTime = newPhysicsState.isOnGround ? Date.now() : physicsState.lastGroundTime

        return {
          ...physicsState,
          physicsState: newPhysicsState,
          lastGroundTime,
        }
      })

    // プレイヤーのジャンプ処理
    const jumpPlayer = (physicsState: PlayerPhysicsState) =>
      Effect.gen(function* () {
        // ジャンプ可能条件チェック - Effect-TSパターン
        const canJump = yield* pipe(
          Match.value({
            isOnGround: physicsState.physicsState.isOnGround,
            timeSinceGround: Date.now() - physicsState.lastGroundTime,
          }),
          Match.when(
            ({ isOnGround }) => !isOnGround,
            () => Effect.succeed(false) // 地上にいない場合はジャンプ不可
          ),
          Match.when(
            ({ timeSinceGround }) => timeSinceGround > 200, // 200ms以内なら許可（コヨーテタイム）
            () => Effect.succeed(false)
          ),
          Match.orElse(() => Effect.succeed(true))
        )

        return yield* pipe(
          Match.value(canJump),
          Match.when(false, () => Effect.succeed(physicsState)),
          Match.orElse(() =>
            Effect.gen(function* () {
              // Cannon-esでジャンプ速度を適用
              yield* pipe(
                cannonPhysics.jumpPlayer(physicsState.bodyId, physicsState.movementConfig.jumpVelocity),
                Effect.mapError(
                  (error): PlayerPhysicsError => ({
                    _tag: 'PlayerPhysicsError',
                    message: `Failed to jump player ${physicsState.playerId}`,
                    playerId: physicsState.playerId,
                    cause: error,
                  })
                )
              )

              // 更新された物理状態を取得
              const newPhysicsState = yield* pipe(
                cannonPhysics.getPlayerState(physicsState.bodyId),
                Effect.mapError(
                  (error): PlayerPhysicsError => ({
                    _tag: 'PlayerPhysicsError',
                    message: `Failed to get physics state after jump for player ${physicsState.playerId}`,
                    playerId: physicsState.playerId,
                    cause: error,
                  })
                )
              )

              return {
                ...physicsState,
                physicsState: newPhysicsState,
                fallStartY: newPhysicsState.position.y, // ジャンプ開始位置を記録
              }
            })
          )
        )
      })

    // 物理状態の同期（Playerエンティティに反映）
    const syncPlayerState = (player: Player, physicsState: PlayerPhysicsState) =>
      Effect.gen(function* () {
        return yield* Effect.succeed({
          ...player,
          position: physicsState.physicsState.position,
          velocity: physicsState.physicsState.velocity,
          isOnGround: physicsState.physicsState.isOnGround,
          // 角速度は通常プレイヤーには適用しない（固定回転）
        })
      })

    // 落下ダメージの計算
    const calculateFallDamage = (physicsState: PlayerPhysicsState, currentY: number) =>
      Effect.gen(function* () {
        // 地面に着地した時のみダメージ計算
        const shouldCalculate =
          physicsState.physicsState.isOnGround &&
          physicsState.fallStartY > currentY &&
          physicsState.physicsState.velocity.y <= 0

        return yield* pipe(
          Match.value(shouldCalculate),
          Match.when(false, () =>
            Effect.succeed({
              damage: 0,
              newState: physicsState,
            })
          ),
          Match.orElse(() =>
            Effect.gen(function* () {
              const fallDistance = physicsState.fallStartY - currentY
              const damageThreshold = 3.0 // 3ブロック以上で落下ダメージ

              const damage = Math.max(0, Math.floor(fallDistance - damageThreshold))

              return {
                damage: Math.min(damage, 20), // 最大20ダメージ
                newState: {
                  ...physicsState,
                  fallStartY: currentY, // 新しい落下開始点を設定
                },
              }
            })
          )
        )
      })

    // プレイヤー物理状態の更新
    const updatePlayerPhysics = (physicsState: PlayerPhysicsState, deltaTime: number) =>
      Effect.gen(function* () {
        // 最新の物理状態を取得
        const newPhysicsState = yield* pipe(
          cannonPhysics.getPlayerState(physicsState.bodyId),
          Effect.mapError(
            (error): PlayerPhysicsError => ({
              _tag: 'PlayerPhysicsError',
              message: `Failed to update physics state for player ${physicsState.playerId}`,
              playerId: physicsState.playerId,
              cause: error,
            })
          )
        )

        // 地面状態が変わったかチェック
        const wasOnGround = physicsState.physicsState.isOnGround
        const isNowOnGround = newPhysicsState.isOnGround

        // 地面から離れた時は落下開始位置を記録
        const fallStartY = wasOnGround && !isNowOnGround ? newPhysicsState.position.y : physicsState.fallStartY

        // 地面接触時間の更新
        const lastGroundTime = isNowOnGround ? Date.now() : physicsState.lastGroundTime

        return {
          ...physicsState,
          physicsState: newPhysicsState,
          lastGroundTime,
          fallStartY,
        }
      })

    // プレイヤー物理の終了処理
    const destroyPlayerPhysics = (physicsState: PlayerPhysicsState) =>
      Effect.gen(function* () {
        yield* pipe(
          cannonPhysics.removeBody(physicsState.bodyId),
          Effect.mapError(
            (error): PlayerPhysicsError => ({
              _tag: 'PlayerPhysicsError',
              message: `Failed to destroy physics for player ${physicsState.playerId}`,
              playerId: physicsState.playerId,
              cause: error,
            })
          )
        )

        console.log(`Player physics destroyed for ${physicsState.playerId}`)
      })

    const service: PlayerPhysicsService = {
      initializePlayerPhysics,
      movePlayer,
      jumpPlayer,
      syncPlayerState,
      calculateFallDamage,
      updatePlayerPhysics,
      destroyPlayerPhysics,
    }

    return service
  }
)

// Live Layer実装
export const PlayerPhysicsServiceLive = Layer.effect(PlayerPhysicsService, makePlayerPhysicsService)
