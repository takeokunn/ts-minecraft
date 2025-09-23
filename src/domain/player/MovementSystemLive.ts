import { Effect, Layer, Ref, pipe, HashMap, Option } from 'effect'
import { MovementSystem } from './MovementSystem.js'
import { PlayerService } from './PlayerService.js'
import type { PlayerId } from '../../shared/types/branded.js'
import {
  type MovementInput,
  type MovementState,
  type VelocityVector,
  type PhysicsResult,
  type PlayerPosition,
  validateMovementInput,
  validateMovementState,
  DEFAULT_MOVEMENT_STATE,
  PHYSICS_CONSTANTS,
  PhysicsUtils,
  InputUtils,
  createPlayerError,
} from './MovementSystem.js'

/**
 * パフォーマンス統計
 */
interface PerformanceStats {
  totalCalculations: number
  totalProcessingTime: number
  maxProcessingTime: number
  frameRateHistory: number[]
  lastFrameTime: number
}

/**
 * MovementSystemLive - 移動システムの実装
 *
 * 高性能な物理ベース移動システム:
 * - フレームレート独立の計算
 * - 60FPS対応の最適化
 * - リアルタイム衝突検出
 * - パフォーマンス監視
 */
const makeMovementSystemLive = Effect.gen(function* () {
  // Dependencies
  const playerService = yield* PlayerService

  // Internal state
  const movementStatesRef = yield* Ref.make<HashMap.HashMap<PlayerId, MovementState>>(HashMap.empty())
  const performanceStatsRef = yield* Ref.make<PerformanceStats>({
    totalCalculations: 0,
    totalProcessingTime: 0,
    maxProcessingTime: 0,
    frameRateHistory: [],
    lastFrameTime: performance.now(),
  })

  // Helper: パフォーマンス測定開始
  const startPerformanceMeasurement = (): number => performance.now()

  // Helper: パフォーマンス測定終了と統計更新
  const endPerformanceMeasurement = (startTime: number) =>
    Effect.gen(function* () {
      const endTime = performance.now()
      const processingTime = endTime - startTime

      yield* Ref.update(performanceStatsRef, (stats) => {
        const newFrameRate = 1000 / (endTime - stats.lastFrameTime)
        const newFrameRateHistory = [...stats.frameRateHistory, newFrameRate].slice(-60) // 直近60フレーム

        return {
          totalCalculations: stats.totalCalculations + 1,
          totalProcessingTime: stats.totalProcessingTime + processingTime,
          maxProcessingTime: Math.max(stats.maxProcessingTime, processingTime
    }),
    frameRateHistory: newFrameRateHistory,
          lastFrameTime: endTime,
        }
      })

      return processingTime
    })

  // Helper: プレイヤーの移動状態取得（存在しない場合はデフォルト作成）
  const getOrCreateMovementState = (playerId: PlayerId): Effect.Effect<MovementState, never> =>
    pipe(
      Ref.get(movementStatesRef),
      Effect.map((states) =>
        pipe(
          HashMap.get(states, playerId),
          Option.getOrElse(() => ({ ...DEFAULT_MOVEMENT_STATE, lastUpdate: Date.now() }))
        )
      )
    )

  // Helper: 移動状態の更新
  const updateMovementState = (playerId: PlayerId, state: MovementState): Effect.Effect<void, never> =>
    Ref.update(movementStatesRef, (states) => HashMap.set(states, playerId, state))

  // Helper: 地面判定（簡易実装 - 実際のゲームではより複雑な地形データを使用）
  const checkGroundedInternal = (position: PlayerPosition): boolean => {
    // 地面の高さを64とした簡易実装
    const groundLevel = 64
    const playerHeight = 1.8
    return position.y <= groundLevel + playerHeight + PHYSICS_CONSTANTS.COLLISION_EPSILON
  }

  // Helper: 衝突検出（簡易実装 - 実際のゲームではオクツリーやBVHを使用）
  const checkCollisionsInternal = (position: PlayerPosition, velocity: VelocityVector): ReadonlyArray<string> => {
    const collisions: string[] = []

    // 境界チェック（例: ワールドの端）
    const worldBounds = {
      minX: -1000,
      maxX: 1000,
      minY: 0,
      maxY: 256,
      minZ: -1000,
      maxZ: 1000,
    }

    if (position.x + velocity.x < worldBounds.minX || position.x + velocity.x > worldBounds.maxX) {
      collisions.push('world-boundary-x')
    }
    if (position.y + velocity.y < worldBounds.minY || position.y + velocity.y > worldBounds.maxY) {
      collisions.push('world-boundary-y')
    }
    if (position.z + velocity.z < worldBounds.minZ || position.z + velocity.z > worldBounds.maxZ) {
      collisions.push('world-boundary-z')
    }

    // 地面との衝突
    if (position.y <= 64) {
      collisions.push('ground')
    }

    return collisions
  }

  // 移動入力の処理
  const processMovementInput = (playerId: PlayerId, input: unknown) =>
    Effect.gen(function* () {
      const startTime = startPerformanceMeasurement()

      // 入力の検証
      const validatedInput = yield* validateMovementInput(input)

      // プレイヤーの現在状態を取得
      const playerState = yield* playerService.getPlayerState(playerId)
      const movementState = yield* getOrCreateMovementState(playerId)

      // 入力から移動ベクトルを計算
      const inputVelocity = InputUtils.calculateMovementVector(
        validatedInput,
        playerState.rotation,
        validatedInput.sprint ? 1.5 : 1.0
      )

      // ジャンプ処理
      const velocityWithJump = InputUtils.processJumpInput(validatedInput, inputVelocity, movementState.isGrounded)

      // 重力適用
      const velocityWithGravity = PhysicsUtils.applyGravity(velocityWithJump, validatedInput.deltaTime)

      // 摩擦適用（地面にいる場合のみ）
      const finalVelocity = movementState.isGrounded
        ? PhysicsUtils.applyFriction(velocityWithGravity, PHYSICS_CONSTANTS.FRICTION)
        : velocityWithGravity

      // 速度制限適用
      const limitedVelocity = PhysicsUtils.normalizeVelocity(finalVelocity, PHYSICS_CONSTANTS.MAX_SPEED)

      // 新しい位置計算
      const newPosition = {
        x: playerState.position.x + limitedVelocity.x * (validatedInput.deltaTime / 1000),
        y: playerState.position.y + limitedVelocity.y * (validatedInput.deltaTime / 1000
    }),
    z: playerState.position.z + limitedVelocity.z * (validatedInput.deltaTime / 1000),
      }

      // 衝突検出
      const collisions = checkCollisionsInternal(newPosition, limitedVelocity)

      // 衝突による位置補正
      let correctedPosition = newPosition
      let correctedVelocity = limitedVelocity

      if (collisions.includes('ground')) {
        correctedPosition = { ...correctedPosition, y: 64 + 1.8 }
        correctedVelocity = { ...correctedVelocity, y: 0 }
      }

      // 境界衝突の処理
      if (collisions.includes('world-boundary-x')) {
        correctedVelocity = { ...correctedVelocity, x: 0 }
        correctedPosition = {
          ...correctedPosition,
          x: Math.max(-1000, Math.min(1000, correctedPosition.x)),
        }
      }

      // 新しい移動状態
      const newMovementState: MovementState = {
        velocity: correctedVelocity,
        isGrounded: checkGroundedInternal(correctedPosition),
        isJumping: validatedInput.jump && movementState.isGrounded,
        isSprinting: validatedInput.sprint,
        lastUpdate: Date.now(),
      }

      // 状態更新
      yield* updateMovementState(playerId, newMovementState)

      // プレイヤーサービス経由で位置更新
      yield* playerService.setPlayerPosition(playerId, correctedPosition)

      const result: PhysicsResult = {
        newPosition: correctedPosition,
        newVelocity: correctedVelocity,
        newState: newMovementState,
        collisions,
      }

      // パフォーマンス測定終了
      yield* endPerformanceMeasurement(startTime)

      return result
    })

  // 物理計算の実行
  const updatePhysics = (playerId: PlayerId, deltaTime: number) =>
    Effect.gen(function* () {
      const startTime = startPerformanceMeasurement()

      // プレイヤーの現在状態を取得
      const playerState = yield* playerService.getPlayerState(playerId)
      const movementState = yield* getOrCreateMovementState(playerId)

      // 重力適用（ジャンプ中または空中の場合）
      let newVelocity = movementState.velocity
      if (!movementState.isGrounded) {
        newVelocity = PhysicsUtils.applyGravity(newVelocity, deltaTime)
      }

      // 摩擦適用
      if (movementState.isGrounded) {
        newVelocity = PhysicsUtils.applyFriction(newVelocity, PHYSICS_CONSTANTS.FRICTION)
      }

      // 新しい位置計算
      const newPosition = {
        x: playerState.position.x + newVelocity.x * (deltaTime / 1000),
        y: playerState.position.y + newVelocity.y * (deltaTime / 1000),
        z: playerState.position.z + newVelocity.z * (deltaTime / 1000),
      }

      // 衝突検出と補正
      const collisions = checkCollisionsInternal(newPosition, newVelocity)
      let correctedPosition = newPosition
      let correctedVelocity = newVelocity

      if (collisions.includes('ground')) {
        correctedPosition = { ...correctedPosition, y: 64 + 1.8 }
        correctedVelocity = { ...correctedVelocity, y: 0 }
      }

      // 新しい移動状態
      const newMovementState: MovementState = {
        velocity: correctedVelocity,
        isGrounded: checkGroundedInternal(correctedPosition),
        isJumping: false, // 物理更新ではジャンプ状態をリセット
        isSprinting: movementState.isSprinting,
        lastUpdate: Date.now(),
      }

      // 状態更新
      yield* updateMovementState(playerId, newMovementState)

      const result: PhysicsResult = {
        newPosition: correctedPosition,
        newVelocity: correctedVelocity,
        newState: newMovementState,
        collisions,
      }

      // パフォーマンス測定終了
      yield* endPerformanceMeasurement(startTime)

      return result
    })

  // プレイヤーの移動状態取得
  const getMovementState = (playerId: PlayerId) =>
    Effect.gen(function* () {
      // プレイヤーの存在確認
      const exists = yield* playerService.playerExists(playerId)
      if (!exists) {
        return yield* Effect.fail(createPlayerError.playerNotFound(playerId, 'get movement state'))
      }

      return yield* getOrCreateMovementState(playerId)
    })

  // プレイヤーの移動状態設定
  const setMovementState = (playerId: PlayerId, state: unknown) =>
    Effect.gen(function* () {
      // 状態の検証
      const validatedState = yield* validateMovementState(state)

      // 追加の検証: NaN, Infinity, 無効な値のチェック
      if (
        !Number.isFinite(validatedState.velocity.x) ||
        !Number.isFinite(validatedState.velocity.y) ||
        !Number.isFinite(validatedState.velocity.z)
      ) {
        return yield* Effect.fail(
          createPlayerError.validationError('Movement state contains invalid numeric values (NaN or Infinity)', state)
        )
      }

      // プレイヤーの存在確認
      const exists = yield* playerService.playerExists(playerId)
      if (!exists) {
        return yield* Effect.fail(createPlayerError.playerNotFound(playerId, 'set movement state'))
      }

      // 状態更新
      yield* updateMovementState(playerId, validatedState)
    })

  // 衝突検出
  const checkCollisions = (position: PlayerPosition, velocity: VelocityVector) =>
    Effect.succeed(checkCollisionsInternal(position, velocity))

  // 地面との接触判定
  const checkGrounded = (position: PlayerPosition) => Effect.succeed(checkGroundedInternal(position))

  // 速度制限の適用
  const applyVelocityLimits = (velocity: VelocityVector) =>
    Effect.succeed(PhysicsUtils.normalizeVelocity(velocity, PHYSICS_CONSTANTS.MAX_SPEED))

  // フレームレート独立の移動計算
  const calculateFrameIndependentMovement = (
    currentPosition: PlayerPosition,
    velocity: VelocityVector,
    deltaTime: number
  ) =>
    Effect.succeed({
      x: currentPosition.x + velocity.x * (deltaTime / 1000),
      y: currentPosition.y + velocity.y * (deltaTime / 1000),
      z: currentPosition.z + velocity.z * (deltaTime / 1000),
    })

  // パフォーマンス統計の取得
  const getPerformanceStats = () => Effect.gen(function* () {
      const stats = yield* Ref.get(performanceStatsRef)

      const averageProcessingTime =
        stats.totalCalculations > 0 ? stats.totalProcessingTime / stats.totalCalculations : 0

      const averageFrameRate =
        stats.frameRateHistory.length > 0
          ? stats.frameRateHistory.reduce((sum, rate) => sum + rate, 0) / stats.frameRateHistory.length
          : 0

      return {
        averageProcessingTime,
        maxProcessingTime: stats.maxProcessingTime,
        frameRate: averageFrameRate,
        totalCalculations: stats.totalCalculations,
      }
    })

  return MovementSystem.of({
    processMovementInput,
    updatePhysics,
    getMovementState,
    setMovementState,
    checkCollisions,
    checkGrounded,
    applyVelocityLimits,
    calculateFrameIndependentMovement,
    getPerformanceStats,
  })
})

/**
 * MovementSystemLive Layer
 */
export const MovementSystemLive = Layer.effect(MovementSystem, makeMovementSystemLive)
