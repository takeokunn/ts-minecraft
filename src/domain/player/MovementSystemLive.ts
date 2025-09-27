import { Effect, Layer, Ref, pipe, HashMap, Option, Match } from 'effect'
import { MovementSystem } from './MovementSystem'
import { PlayerService } from './PlayerService'
import type { PlayerId } from '../../shared/types/branded'
import { SpatialBrands } from '../../shared/types/spatial-brands'
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
} from './MovementSystem'

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
          maxProcessingTime: Math.max(stats.maxProcessingTime, processingTime),
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
    // 境界チェック（例: ワールドの端）
    const worldBounds = {
      minX: -1000,
      maxX: 1000,
      minY: 0,
      maxY: 256,
      minZ: -1000,
      maxZ: 1000,
    }

    const xBoundaryCollision = pipe(
      position.x + velocity.x < worldBounds.minX || position.x + velocity.x > worldBounds.maxX,
      Match.value,
      Match.when(true, () => ['world-boundary-x']),
      Match.when(false, () => []),
      Match.exhaustive
    )

    const yBoundaryCollision = pipe(
      position.y + velocity.y < worldBounds.minY || position.y + velocity.y > worldBounds.maxY,
      Match.value,
      Match.when(true, () => ['world-boundary-y']),
      Match.when(false, () => []),
      Match.exhaustive
    )

    const zBoundaryCollision = pipe(
      position.z + velocity.z < worldBounds.minZ || position.z + velocity.z > worldBounds.maxZ,
      Match.value,
      Match.when(true, () => ['world-boundary-z']),
      Match.when(false, () => []),
      Match.exhaustive
    )

    // 地面との衝突
    const groundCollision = pipe(
      position.y <= 64,
      Match.value,
      Match.when(true, () => ['ground']),
      Match.when(false, () => []),
      Match.exhaustive
    )

    return [...xBoundaryCollision, ...yBoundaryCollision, ...zBoundaryCollision, ...groundCollision]
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
      const newPosition = SpatialBrands.createVector3D(
        playerState.position.x + limitedVelocity.x * (validatedInput.deltaTime / 1000),
        playerState.position.y + limitedVelocity.y * (validatedInput.deltaTime / 1000),
        playerState.position.z + limitedVelocity.z * (validatedInput.deltaTime / 1000)
      )

      // 衝突検出
      const collisions = checkCollisionsInternal(newPosition, limitedVelocity)

      // 衝突による位置補正
      const correctedState = pipe(
        { position: newPosition, velocity: limitedVelocity, collisions },
        (state) =>
          pipe(
            collisions.includes('ground'),
            Match.value,
            Match.when(true, () => ({
              ...state,
              position: SpatialBrands.createVector3D(state.position.x, 64 + 1.8, state.position.z),
              velocity: { ...state.velocity, y: 0 },
            })),
            Match.when(false, () => state),
            Match.exhaustive
          ),
        (state) =>
          pipe(
            collisions.includes('world-boundary-x'),
            Match.value,
            Match.when(true, () => ({
              ...state,
              velocity: { ...state.velocity, x: 0 },
              position: SpatialBrands.createVector3D(
                Math.max(-1000, Math.min(1000, state.position.x)),
                state.position.y,
                state.position.z
              ),
            })),
            Match.when(false, () => state),
            Match.exhaustive
          )
      )

      const correctedPosition = correctedState.position
      const correctedVelocity = correctedState.velocity

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
      const velocityWithGravity = pipe(
        movementState.isGrounded,
        Match.value,
        Match.when(false, () => PhysicsUtils.applyGravity(movementState.velocity, deltaTime)),
        Match.when(true, () => movementState.velocity),
        Match.exhaustive
      )

      // 摩擦適用
      const newVelocity = pipe(
        movementState.isGrounded,
        Match.value,
        Match.when(true, () => PhysicsUtils.applyFriction(velocityWithGravity, PHYSICS_CONSTANTS.FRICTION)),
        Match.when(false, () => velocityWithGravity),
        Match.exhaustive
      )

      // 新しい位置計算
      const newPosition = SpatialBrands.createVector3D(
        playerState.position.x + newVelocity.x * (deltaTime / 1000),
        playerState.position.y + newVelocity.y * (deltaTime / 1000),
        playerState.position.z + newVelocity.z * (deltaTime / 1000)
      )

      // 衝突検出と補正
      const collisions = checkCollisionsInternal(newPosition, newVelocity)
      const { correctedPosition, correctedVelocity } = pipe(
        collisions.includes('ground'),
        Match.value,
        Match.when(true, () => ({
          correctedPosition: SpatialBrands.createVector3D(newPosition.x, 64 + 1.8, newPosition.z),
          correctedVelocity: { ...newVelocity, y: 0 },
        })),
        Match.when(false, () => ({
          correctedPosition: newPosition,
          correctedVelocity: newVelocity,
        })),
        Match.exhaustive
      )

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

      return yield* pipe(
        exists,
        Match.value,
        Match.when(false, () => Effect.fail(createPlayerError.playerNotFound(playerId, 'get movement state'))),
        Match.when(true, () => getOrCreateMovementState(playerId)),
        Match.exhaustive
      )
    })

  // プレイヤーの移動状態設定
  const setMovementState = (playerId: PlayerId, state: unknown) =>
    Effect.gen(function* () {
      // 状態の検証
      const validatedState = yield* validateMovementState(state)

      // 追加の検証: NaN, Infinity, 無効な値のチェック
      yield* pipe(
        Number.isFinite(validatedState.velocity.x) &&
          Number.isFinite(validatedState.velocity.y) &&
          Number.isFinite(validatedState.velocity.z),
        Match.value,
        Match.when(false, () =>
          Effect.fail(
            createPlayerError.validationError('Movement state contains invalid numeric values (NaN or Infinity)', state)
          )
        ),
        Match.when(true, () => Effect.void),
        Match.exhaustive
      )

      // プレイヤーの存在確認
      const exists = yield* playerService.playerExists(playerId)
      yield* pipe(
        exists,
        Match.value,
        Match.when(false, () => Effect.fail(createPlayerError.playerNotFound(playerId, 'set movement state'))),
        Match.when(true, () => Effect.void),
        Match.exhaustive
      )

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
    Effect.succeed(
      SpatialBrands.createVector3D(
        currentPosition.x + velocity.x * (deltaTime / 1000),
        currentPosition.y + velocity.y * (deltaTime / 1000),
        currentPosition.z + velocity.z * (deltaTime / 1000)
      )
    )

  // パフォーマンス統計の取得
  const getPerformanceStats = () =>
    Effect.gen(function* () {
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
