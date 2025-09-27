import { Context, Effect, Layer, pipe, Match, Ref } from 'effect'
import { Player } from '../entities/Player'
import { Direction, MOVEMENT_SPEEDS, JUMP_VELOCITY } from './PlayerState'
import type { PlayerId } from '@domain/core/types/brands'
import type { Vector3D } from '@domain/core/types/spatial'
import { PlayerPhysicsService, type PlayerPhysicsState, type PlayerPhysicsError } from '../physics/PlayerPhysicsService'
import { CannonPhysicsService } from '../physics/CannonPhysicsService'
import { TerrainAdaptationService } from '../physics/TerrainAdaptationService'

/**
 * Enhanced Player Movement Service
 * Cannon-es物理エンジンと統合された高度なプレイヤー移動システム
 */

// 移動エラー定義
export interface EnhancedMovementError {
  readonly _tag: 'EnhancedMovementError'
  readonly message: string
  readonly playerId?: PlayerId
  readonly reason: 'PhysicsError' | 'InvalidInput' | 'PlayerNotFound' | 'InitializationFailed'
  readonly cause?: unknown
}

// プレイヤー入力状態
export interface PlayerInputState {
  readonly movement: Direction
  readonly mouseRotation: { deltaX: number; deltaY: number }
  readonly timestamp: number
}

// プレイヤー管理状態
interface PlayerMovementState {
  readonly player: Player
  readonly physicsState: PlayerPhysicsState
  readonly lastInputTime: number
  readonly coyoteTime: number // 空中ジャンプ許可時間
  readonly inputBuffer: PlayerInputState[] // 入力バッファリング
}

// Enhanced Player Movement Service インターフェース
export interface EnhancedPlayerMovementService {
  /**
   * プレイヤー移動システムの初期化
   */
  readonly initializePlayer: (player: Player) => Effect.Effect<void, EnhancedMovementError>

  /**
   * プレイヤーの移動処理（WASD + マウスルック統合）
   */
  readonly processMovementInput: (
    playerId: PlayerId,
    input: PlayerInputState,
    deltaTime: number
  ) => Effect.Effect<Player, EnhancedMovementError>

  /**
   * プレイヤーのジャンプ処理（バッファリング対応）
   */
  readonly processJumpInput: (playerId: PlayerId, timestamp: number) => Effect.Effect<Player, EnhancedMovementError>

  /**
   * 物理シミュレーションの更新
   */
  readonly updatePhysics: (deltaTime: number) => Effect.Effect<void, EnhancedMovementError>

  /**
   * プレイヤーの削除
   */
  readonly removePlayer: (playerId: PlayerId) => Effect.Effect<void, EnhancedMovementError>

  /**
   * プレイヤー状態の取得
   */
  readonly getPlayerState: (playerId: PlayerId) => Effect.Effect<Player, EnhancedMovementError>

  /**
   * すべてのプレイヤー状態の取得
   */
  readonly getAllPlayerStates: () => Effect.Effect<ReadonlyArray<Player>, EnhancedMovementError>

  /**
   * サービスのクリーンアップ
   */
  readonly cleanup: () => Effect.Effect<void, EnhancedMovementError>
}

// Context Tag定義
export const EnhancedPlayerMovementService = Context.GenericTag<EnhancedPlayerMovementService>(
  '@minecraft/EnhancedPlayerMovementService'
)

// Enhanced Player Movement Service実装
const makeEnhancedPlayerMovementService: Effect.Effect<
  EnhancedPlayerMovementService,
  EnhancedMovementError,
  PlayerPhysicsService | CannonPhysicsService | TerrainAdaptationService
> = Effect.gen(function* () {
  const playerPhysics = yield* PlayerPhysicsService
  const cannonPhysics = yield* CannonPhysicsService
  const terrainAdaptation = yield* TerrainAdaptationService

  // プレイヤー管理状態
  const playerStatesRef = yield* Ref.make(new Map<PlayerId, PlayerMovementState>())

  // 物理世界の初期化
  yield* pipe(
    cannonPhysics.initializeWorld(),
    Effect.mapError(
      (error): EnhancedMovementError => ({
        _tag: 'EnhancedMovementError',
        message: 'Failed to initialize physics world',
        reason: 'InitializationFailed',
        cause: error,
      })
    )
  )

  // プレイヤー移動システムの初期化
  const initializePlayer = (player: Player) =>
    Effect.gen(function* () {
      // プレイヤーの物理状態を初期化
      const physicsState = yield* pipe(
        playerPhysics.initializePlayerPhysics(player),
        Effect.mapError(
          (error): EnhancedMovementError => ({
            _tag: 'EnhancedMovementError',
            message: `Failed to initialize player physics for ${player.id}`,
            playerId: player.id,
            reason: 'PhysicsError',
            cause: error,
          })
        )
      )

      // 地形適応を初期化
      yield* pipe(
        terrainAdaptation.initializePlayerTerrain(player.id),
        Effect.mapError(
          (error): EnhancedMovementError => ({
            _tag: 'EnhancedMovementError',
            message: `Failed to initialize terrain adaptation for ${player.id}`,
            playerId: player.id,
            reason: 'InitializationFailed',
            cause: error,
          })
        )
      )

      const playerMovementState: PlayerMovementState = {
        player,
        physicsState,
        lastInputTime: Date.now(),
        coyoteTime: 0,
        inputBuffer: [],
      }

      // 管理状態に追加
      yield* Ref.update(playerStatesRef, (states) => states.set(player.id, playerMovementState))

      console.log(`Enhanced player movement initialized for ${player.id}`)
    })

  // プレイヤーの移動処理
  const processMovementInput = (playerId: PlayerId, input: PlayerInputState, deltaTime: number) =>
    Effect.gen(function* () {
      const states = yield* Ref.get(playerStatesRef)
      const playerState = states.get(playerId)

      if (!playerState) {
        return yield* Effect.fail({
          _tag: 'EnhancedMovementError',
          message: `Player not found: ${playerId}`,
          playerId,
          reason: 'PlayerNotFound',
        } as EnhancedMovementError)
      }

      // 地形適応状態を更新
      const terrainState = yield* pipe(
        terrainAdaptation.adaptToTerrain(playerId, playerState.player.position, deltaTime),
        Effect.mapError(
          (error): EnhancedMovementError => ({
            _tag: 'EnhancedMovementError',
            message: `Failed to adapt to terrain for ${playerId}`,
            playerId,
            reason: 'PhysicsError',
            cause: error,
          })
        )
      )

      // マウスルック処理（カメラ回転）
      const updatedPlayer = yield* Effect.gen(function* () {
        const mouseSensitivity = 0.002
        const newYaw = playerState.player.rotation.yaw + input.mouseRotation.deltaX * mouseSensitivity
        const newPitch = Math.max(
          -Math.PI / 2,
          Math.min(Math.PI / 2, playerState.player.rotation.pitch + input.mouseRotation.deltaY * mouseSensitivity)
        )

        return {
          ...playerState.player,
          rotation: {
            ...playerState.player.rotation,
            yaw: newYaw,
            pitch: newPitch,
          },
        }
      })

      // 移動方向をプレイヤーの向きに合わせて変換
      const worldDirection = yield* Effect.gen(function* () {
        const yawRad = updatedPlayer.rotation.yaw
        const cosYaw = Math.cos(yawRad)
        const sinYaw = Math.sin(yawRad)

        // ローカル移動方向をワールド座標に変換
        let worldX = 0
        let worldZ = 0

        if (input.movement.forward) {
          worldX += -sinYaw
          worldZ += cosYaw
        }
        if (input.movement.backward) {
          worldX += sinYaw
          worldZ += -cosYaw
        }
        if (input.movement.left) {
          worldX += -cosYaw
          worldZ += -sinYaw
        }
        if (input.movement.right) {
          worldX += cosYaw
          worldZ += sinYaw
        }

        // ベクトル正規化
        const length = Math.sqrt(worldX * worldX + worldZ * worldZ)
        if (length > 0) {
          worldX /= length
          worldZ /= length
        }

        // 地形による移動速度修正を適用
        const modifiedDirection = {
          ...input.movement,
          forward: worldX !== 0 || worldZ !== 0 ? worldX < 0 : input.movement.forward,
          backward: worldX !== 0 || worldZ !== 0 ? worldX > 0 : input.movement.backward,
          left: worldZ !== 0 ? worldZ < 0 : input.movement.left,
          right: worldZ !== 0 ? worldZ > 0 : input.movement.right,
          // 地形特性による速度・ジャンプ修正
          sprint: input.movement.sprint && terrainState.currentTerrain.speedModifier > 0.8,
          jump: input.movement.jump && terrainState.currentTerrain.jumpHeightModifier > 0.0,
        } as Direction

        return modifiedDirection
      })

      // プレイヤー物理移動を適用
      const newPhysicsState = yield* pipe(
        playerPhysics.movePlayer(playerState.physicsState, worldDirection, deltaTime),
        Effect.mapError(
          (error): EnhancedMovementError => ({
            _tag: 'EnhancedMovementError',
            message: `Failed to move player ${playerId}`,
            playerId,
            reason: 'PhysicsError',
            cause: error,
          })
        )
      )

      // 自動ステップアップ処理
      const stepUpResult = yield* pipe(
        terrainAdaptation.processStepUp(
          playerId,
          newPhysicsState.physicsState.position,
          newPhysicsState.physicsState.velocity,
          terrainState.currentTerrain.stepHeight
        ),
        Effect.mapError(
          (error): EnhancedMovementError => ({
            _tag: 'EnhancedMovementError',
            message: `Failed to process step up for ${playerId}`,
            playerId,
            reason: 'PhysicsError',
            cause: error,
          })
        )
      )

      // 水中物理の適用
      const swimmingVelocity = yield* pipe(
        terrainAdaptation.applySwimmingPhysics(playerId, terrainState.submersionLevel, stepUpResult.velocity),
        Effect.mapError(
          (error): EnhancedMovementError => ({
            _tag: 'EnhancedMovementError',
            message: `Failed to apply swimming physics for ${playerId}`,
            playerId,
            reason: 'PhysicsError',
            cause: error,
          })
        )
      )

      // 地形摩擦の適用
      const frictionVelocity = yield* pipe(
        terrainAdaptation.applyTerrainFriction(playerId, terrainState.currentTerrain, swimmingVelocity, deltaTime),
        Effect.mapError(
          (error): EnhancedMovementError => ({
            _tag: 'EnhancedMovementError',
            message: `Failed to apply terrain friction for ${playerId}`,
            playerId,
            reason: 'PhysicsError',
            cause: error,
          })
        )
      )

      // 最終物理状態を更新
      const finalPhysicsState = {
        ...newPhysicsState,
        physicsState: {
          ...newPhysicsState.physicsState,
          position: stepUpResult.position,
          velocity: frictionVelocity,
        },
      }

      // プレイヤーエンティティに物理状態を同期
      const finalPlayer = yield* pipe(
        playerPhysics.syncPlayerState(updatedPlayer, finalPhysicsState),
        Effect.mapError(
          (error): EnhancedMovementError => ({
            _tag: 'EnhancedMovementError',
            message: `Failed to sync player state for ${playerId}`,
            playerId,
            reason: 'PhysicsError',
            cause: error,
          })
        )
      )

      // 状態を更新
      const updatedPlayerState: PlayerMovementState = {
        ...playerState,
        player: finalPlayer,
        physicsState: finalPhysicsState,
        lastInputTime: input.timestamp,
        inputBuffer: [...playerState.inputBuffer.slice(-4), input], // 最新5個の入力を保持
      }

      yield* Ref.update(playerStatesRef, (states) => states.set(playerId, updatedPlayerState))

      return finalPlayer
    })

  // プレイヤーのジャンプ処理
  const processJumpInput = (playerId: PlayerId, timestamp: number) =>
    Effect.gen(function* () {
      const states = yield* Ref.get(playerStatesRef)
      const playerState = states.get(playerId)

      if (!playerState) {
        return yield* Effect.fail({
          _tag: 'EnhancedMovementError',
          message: `Player not found: ${playerId}`,
          playerId,
          reason: 'PlayerNotFound',
        } as EnhancedMovementError)
      }

      // 地形状態を確認してジャンプ可能性を判定
      const terrainState = yield* pipe(
        terrainAdaptation.getPlayerTerrainState(playerId),
        Effect.mapError(
          (error): EnhancedMovementError => ({
            _tag: 'EnhancedMovementError',
            message: `Failed to get terrain state for ${playerId}`,
            playerId,
            reason: 'PhysicsError',
            cause: error,
          })
        )
      )

      // 水中や特殊地形でのジャンプ制限
      const canJump = terrainState.currentTerrain.jumpHeightModifier > 0.0 && !terrainState.isSwimming

      return yield* pipe(
        Match.value(canJump),
        Match.when(false, () => Effect.succeed(playerState.player)),
        Match.orElse(() =>
          Effect.gen(function* () {
            // ジャンプ処理を実行
            const newPhysicsState = yield* pipe(
              playerPhysics.jumpPlayer(playerState.physicsState),
              Effect.mapError(
                (error): EnhancedMovementError => ({
                  _tag: 'EnhancedMovementError',
                  message: `Failed to jump player ${playerId}`,
                  playerId,
                  reason: 'PhysicsError',
                  cause: error,
                })
              )
            )

            // プレイヤーエンティティに同期
            const updatedPlayer = yield* pipe(
              playerPhysics.syncPlayerState(playerState.player, newPhysicsState),
              Effect.mapError(
                (error): EnhancedMovementError => ({
                  _tag: 'EnhancedMovementError',
                  message: `Failed to sync player state after jump for ${playerId}`,
                  playerId,
                  reason: 'PhysicsError',
                  cause: error,
                })
              )
            )

            // 状態を更新
            const updatedPlayerState: PlayerMovementState = {
              ...playerState,
              player: updatedPlayer,
              physicsState: newPhysicsState,
              lastInputTime: timestamp,
            }

            yield* Ref.update(playerStatesRef, (states) => states.set(playerId, updatedPlayerState))

            return updatedPlayer
          })
        )
      )
    })

  // 物理シミュレーションの更新
  const updatePhysics = (deltaTime: number) =>
    Effect.gen(function* () {
      // Cannon-es物理ステップを実行
      yield* pipe(
        cannonPhysics.step(deltaTime),
        Effect.mapError(
          (error): EnhancedMovementError => ({
            _tag: 'EnhancedMovementError',
            message: 'Physics step failed',
            reason: 'PhysicsError',
            cause: error,
          })
        )
      )

      // すべてのプレイヤーの物理状態を更新
      const states = yield* Ref.get(playerStatesRef)
      const updatedStates = new Map<PlayerId, PlayerMovementState>()

      for (const [playerId, playerState] of states.entries()) {
        const updatedPhysicsState = yield* pipe(
          playerPhysics.updatePlayerPhysics(playerState.physicsState, deltaTime),
          Effect.mapError(
            (error): EnhancedMovementError => ({
              _tag: 'EnhancedMovementError',
              message: `Failed to update physics for player ${playerId}`,
              playerId,
              reason: 'PhysicsError',
              cause: error,
            })
          )
        )

        // 落下ダメージの計算
        const fallDamageResult = yield* pipe(
          playerPhysics.calculateFallDamage(updatedPhysicsState, updatedPhysicsState.physicsState.position.y),
          Effect.mapError(
            (error): EnhancedMovementError => ({
              _tag: 'EnhancedMovementError',
              message: `Failed to calculate fall damage for player ${playerId}`,
              playerId,
              reason: 'PhysicsError',
              cause: error,
            })
          )
        )

        // プレイヤーエンティティに同期
        let updatedPlayer = yield* pipe(
          playerPhysics.syncPlayerState(playerState.player, fallDamageResult.newState),
          Effect.mapError(
            (error): EnhancedMovementError => ({
              _tag: 'EnhancedMovementError',
              message: `Failed to sync player state for ${playerId}`,
              playerId,
              reason: 'PhysicsError',
              cause: error,
            })
          )
        )

        // 落下ダメージを適用
        if (fallDamageResult.damage > 0) {
          updatedPlayer = {
            ...updatedPlayer,
            stats: {
              ...updatedPlayer.stats,
              health: Math.max(0, updatedPlayer.stats.health - fallDamageResult.damage),
            },
          }
        }

        updatedStates.set(playerId, {
          ...playerState,
          player: updatedPlayer,
          physicsState: fallDamageResult.newState,
        })
      }

      yield* Ref.set(playerStatesRef, updatedStates)
    })

  // プレイヤーの削除
  const removePlayer = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const states = yield* Ref.get(playerStatesRef)
      const playerState = states.get(playerId)

      if (playerState) {
        // 物理状態を削除
        yield* pipe(
          playerPhysics.destroyPlayerPhysics(playerState.physicsState),
          Effect.mapError(
            (error): EnhancedMovementError => ({
              _tag: 'EnhancedMovementError',
              message: `Failed to destroy physics for player ${playerId}`,
              playerId,
              reason: 'PhysicsError',
              cause: error,
            })
          )
        )

        // 地形適応をクリーンアップ
        yield* pipe(
          terrainAdaptation.cleanupPlayerTerrain(playerId),
          Effect.mapError(
            (error): EnhancedMovementError => ({
              _tag: 'EnhancedMovementError',
              message: `Failed to cleanup terrain adaptation for player ${playerId}`,
              playerId,
              reason: 'PhysicsError',
              cause: error,
            })
          )
        )

        // 管理状態から削除
        yield* Ref.update(playerStatesRef, (states) => {
          const newStates = new Map(states)
          newStates.delete(playerId)
          return newStates
        })

        console.log(`Player ${playerId} removed from enhanced movement service`)
      }
    })

  // プレイヤー状態の取得
  const getPlayerState = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const states = yield* Ref.get(playerStatesRef)
      const playerState = states.get(playerId)

      if (!playerState) {
        return yield* Effect.fail({
          _tag: 'EnhancedMovementError',
          message: `Player not found: ${playerId}`,
          playerId,
          reason: 'PlayerNotFound',
        } as EnhancedMovementError)
      }

      return playerState.player
    })

  // すべてのプレイヤー状態の取得
  const getAllPlayerStates = () =>
    Effect.gen(function* () {
      const states = yield* Ref.get(playerStatesRef)
      return Array.from(states.values()).map((state) => state.player)
    })

  // サービスのクリーンアップ
  const cleanup = () =>
    Effect.gen(function* () {
      const states = yield* Ref.get(playerStatesRef)

      // すべてのプレイヤーの物理状態を削除
      for (const [playerId, playerState] of states.entries()) {
        yield* pipe(
          playerPhysics.destroyPlayerPhysics(playerState.physicsState),
          Effect.catchAll(() => Effect.void) // エラーは無視してクリーンアップを続行
        )

        yield* pipe(
          terrainAdaptation.cleanupPlayerTerrain(playerId),
          Effect.catchAll(() => Effect.void) // エラーは無視してクリーンアップを続行
        )
      }

      // Cannon-es物理世界をクリーンアップ
      yield* pipe(
        cannonPhysics.cleanup(),
        Effect.mapError(
          (error): EnhancedMovementError => ({
            _tag: 'EnhancedMovementError',
            message: 'Failed to cleanup physics world',
            reason: 'PhysicsError',
            cause: error,
          })
        )
      )

      // 状態をクリア
      yield* Ref.set(playerStatesRef, new Map())

      console.log('Enhanced player movement service cleaned up')
    })

  const service: EnhancedPlayerMovementService = {
    initializePlayer,
    processMovementInput,
    processJumpInput,
    updatePhysics,
    removePlayer,
    getPlayerState,
    getAllPlayerStates,
    cleanup,
  }

  return service
})

// Live Layer実装
export const EnhancedPlayerMovementServiceLive = Layer.effect(
  EnhancedPlayerMovementService,
  makeEnhancedPlayerMovementService
)
