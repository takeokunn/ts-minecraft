import { physicsStepDuration } from '@application/observability/metrics'
import type { PlayerId, Vector3D } from '@domain/entities'
import { toErrorCause, type ErrorCause } from '@shared/schema/error'
import * as CANNON from 'cannon-es'
import { Clock, Context, Effect, Layer, Match, Option, pipe, ReadonlyArray } from 'effect'

/**
 * Cannon-es物理エンジン統合サービス
 * Player Movement Physics用の高性能な物理演算基盤
 */

// 物理世界の設定定数
export const PHYSICS_CONSTANTS = {
  GRAVITY: -9.81, // m/s² (Minecraft標準より現実的)
  PLAYER_MASS: 70, // kg
  PLAYER_RADIUS: 0.3, // meters (カプセル半径)
  PLAYER_HEIGHT: 1.8, // meters (カプセル高さ)
  TIME_STEP: 1 / 60, // 60 FPS
  MAX_SUB_STEPS: 3,
  FRICTION: 0.4,
  RESTITUTION: 0.3,
  LINEAR_DAMPING: 0.01,
  ANGULAR_DAMPING: 0.01,
} as const

const hasNumericSolverProperty = <K extends PropertyKey>(
  solver: CANNON.Solver,
  key: K
): solver is CANNON.Solver & Record<K, number> =>
  Object.prototype.hasOwnProperty.call(solver, key) &&
  typeof (solver as Record<PropertyKey, number | undefined>)[key] === 'number'

// 物理ボディの状態
export interface PhysicsBodyState {
  readonly position: Vector3D
  readonly velocity: Vector3D
  readonly angularVelocity: Vector3D
  readonly quaternion: { x: number; y: number; z: number; w: number }
  readonly isOnGround: boolean
  readonly isColliding: boolean
}

// 物理エラー定義
export interface PhysicsEngineError {
  readonly _tag: 'PhysicsEngineError'
  readonly message: string
  readonly cause?: ErrorCause
}

// Character Controller設定
export interface CharacterControllerConfig {
  readonly mass: number
  readonly radius: number
  readonly height: number
  readonly friction: number
  readonly restitution: number
}

// Cannon-es物理サービスインターフェース
export interface CannonPhysicsService {
  /**
   * 物理世界の初期化
   */
  readonly initializeWorld: () => Effect.Effect<void, PhysicsEngineError>

  /**
   * プレイヤーCharacter Controllerの作成
   */
  readonly createPlayerController: (
    playerId: PlayerId,
    initialPosition: Vector3D,
    config?: Partial<CharacterControllerConfig>
  ) => Effect.Effect<string, PhysicsEngineError> // bodyIdを返す

  /**
   * 物理ステップの実行
   */
  readonly step: (deltaTime: number) => Effect.Effect<void, PhysicsEngineError>

  /**
   * プレイヤーボディの状態取得
   */
  readonly getPlayerState: (bodyId: string) => Effect.Effect<PhysicsBodyState, PhysicsEngineError>

  /**
   * プレイヤーに移動力を適用
   */
  readonly applyMovementForce: (bodyId: string, force: Vector3D) => Effect.Effect<void, PhysicsEngineError>

  /**
   * プレイヤーのジャンプ
   */
  readonly jumpPlayer: (bodyId: string, jumpVelocity: number) => Effect.Effect<void, PhysicsEngineError>

  /**
   * 地面・ブロックとの衝突検知
   */
  readonly raycastGround: (
    position: Vector3D,
    distance: number
  ) => Effect.Effect<{ hit: boolean; distance: number; normal: Vector3D } | null, PhysicsEngineError>

  /**
   * 静的ブロックボディの追加
   */
  readonly addStaticBlock: (position: Vector3D, size: Vector3D) => Effect.Effect<string, PhysicsEngineError>

  /**
   * ボディの削除
   */
  readonly removeBody: (bodyId: string) => Effect.Effect<void, PhysicsEngineError>

  /**
   * 物理世界のクリーンアップ
   */
  readonly cleanup: () => Effect.Effect<void, PhysicsEngineError>
}

// Context Tag定義
export const CannonPhysicsService = Context.GenericTag<CannonPhysicsService>('@minecraft/domain/CannonPhysicsService')

// Cannon-es物理サービス実装
const makeCannonPhysicsService: Effect.Effect<CannonPhysicsService> = Effect.gen(function* () {
  // 物理世界とボディの管理
  let world: CANNON.World | null = null
  const bodies = new Map<string, CANNON.Body>()
  const playerControllers = new Map<string, PlayerId>()
  let nextBodyId = 0

  const generateBodyId = (): string => `body_${++nextBodyId}`

  const worldNotInitialized = (): PhysicsEngineError => ({
    _tag: 'PhysicsEngineError',
    message: 'Physics world not initialized',
    cause: undefined,
  })

  const requireWorld = <R>(onWorld: (activeWorld: CANNON.World) => Effect.Effect<R, PhysicsEngineError>) =>
    pipe(
      Option.fromNullable(world),
      Option.match({
        onNone: () => Effect.fail(worldNotInitialized()),
        onSome: onWorld,
      })
    )

  const requireBody = <R>(
    bodyId: string,
    onBody: (body: CANNON.Body) => Effect.Effect<R, PhysicsEngineError>
  ): Effect.Effect<R, PhysicsEngineError> =>
    pipe(
      Option.fromNullable(bodies.get(bodyId)),
      Option.match({
        onNone: () =>
          Effect.fail<PhysicsEngineError>({
            _tag: 'PhysicsEngineError',
            message: `Body not found: ${bodyId}`,
            cause: undefined,
          }),
        onSome: onBody,
      })
    )

  // 物理世界の初期化
  const initializeWorld = () =>
    Effect.gen(function* () {
      return yield* Effect.sync(() => {
        // 新しい物理世界を作成
        world = new CANNON.World({
          gravity: new CANNON.Vec3(0, PHYSICS_CONSTANTS.GRAVITY, 0),
        })

        // Broadphase設定（パフォーマンス最適化）
        world.broadphase = new CANNON.SAPBroadphase(world)
        world.broadphase.useBoundingBoxes = true

        const setNumericSolverProperty = <K extends PropertyKey>(key: K, value: number) =>
          pipe(
            Match.value(hasNumericSolverProperty(world!.solver, key)),
            Match.when(true, () => {
              ;(world!.solver as Record<PropertyKey, number>)[key] = value
              return undefined
            }),
            Match.orElse(() => undefined)
          )

        // ソルバー設定 (Cannon-es 0.20+)
        setNumericSolverProperty('iterations', 10)
        setNumericSolverProperty('tolerance', 0.1)

        // コンタクトマテリアル設定
        const groundMaterial = new CANNON.Material('ground')
        const playerMaterial = new CANNON.Material('player')

        const playerGroundContact = new CANNON.ContactMaterial(playerMaterial, groundMaterial, {
          friction: PHYSICS_CONSTANTS.FRICTION,
          restitution: PHYSICS_CONSTANTS.RESTITUTION,
          contactEquationStiffness: 1e8,
          contactEquationRelaxation: 3,
        })

        world.addContactMaterial(playerGroundContact)
        world.defaultContactMaterial.friction = PHYSICS_CONSTANTS.FRICTION
        world.defaultContactMaterial.restitution = PHYSICS_CONSTANTS.RESTITUTION
      })
    }).pipe(Effect.tap(() => Effect.logInfo('Cannon-es physics world initialized')))

  // プレイヤーCharacter Controllerの作成
  const createPlayerController = (
    playerId: PlayerId,
    initialPosition: Vector3D,
    config: Partial<CharacterControllerConfig> = {}
  ) =>
    Effect.gen(function* () {
      return yield* requireWorld((activeWorld) =>
        Effect.sync(() => {
          const finalConfig: CharacterControllerConfig = {
            mass: PHYSICS_CONSTANTS.PLAYER_MASS,
            radius: PHYSICS_CONSTANTS.PLAYER_RADIUS,
            height: PHYSICS_CONSTANTS.PLAYER_HEIGHT,
            friction: PHYSICS_CONSTANTS.FRICTION,
            restitution: PHYSICS_CONSTANTS.RESTITUTION,
            ...config,
          }

          // カプセル形状でプレイヤーボディを作成
          const shape = new CANNON.Sphere(finalConfig.radius)
          const body = new CANNON.Body({
            mass: finalConfig.mass,
            shape,
            position: new CANNON.Vec3(initialPosition.x, initialPosition.y, initialPosition.z),
            material: new CANNON.Material('player'),
          })

          // 物理的特性を設定
          body.linearDamping = PHYSICS_CONSTANTS.LINEAR_DAMPING
          body.angularDamping = PHYSICS_CONSTANTS.ANGULAR_DAMPING

          // 回転を固定（プレイヤーは倒れない）
          body.fixedRotation = true
          body.updateMassProperties()

          // ワールドに追加
          activeWorld.addBody(body)

          // 管理データに追加
          const bodyId = generateBodyId()
          bodies.set(bodyId, body)
          playerControllers.set(bodyId, playerId)

          return bodyId
        }),
        Effect.tap((bodyId) =>
          Effect.logInfo(`Player controller created`).pipe(Effect.annotateLogs({ playerId: String(playerId), bodyId }))
        ),
        Effect.mapError(
          (error): PhysicsEngineError => ({
            _tag: 'PhysicsEngineError',
            message: `Failed to create player controller: ${error}`,
            cause: toErrorCause(error),
          })
        )
      )
    })

  // 物理ステップの実行
  const step = (deltaTime: number) =>
    Effect.gen(function* () {
      const startTime = yield* Clock.currentTimeMillis

      const result = yield* requireWorld((activeWorld) =>
        pipe(
          Effect.sync(() => {
            // 固定タイムステップで物理演算を実行
            activeWorld.fixedStep(PHYSICS_CONSTANTS.TIME_STEP, deltaTime)
          }),
          Effect.mapError(
            (error): PhysicsEngineError => ({
              _tag: 'PhysicsEngineError',
              message: `Physics step failed: ${error}`,
              cause: toErrorCause(error),
            })
          )
        )
      )

      // メトリクス記録: 物理演算ステップ時間を記録
      const endTime = yield* Clock.currentTimeMillis
      const duration = endTime - startTime
      yield* physicsStepDuration(duration)

      return result
    })

  // プレイヤーボディの状態取得
  const getPlayerState = (bodyId: string) =>
    Effect.gen(function* () {
      return yield* requireWorld((activeWorld) =>
        requireBody(bodyId, (body) =>
          pipe(
            Effect.sync(() => {
              // 地面判定のためのレイキャスト
              const rayStart = body.position.clone()
              const rayEnd = rayStart.clone()
              rayEnd.y -= PHYSICS_CONSTANTS.PLAYER_RADIUS + 0.1

              const raycastResult = new CANNON.RaycastResult()
              activeWorld.raycastClosest(rayStart, rayEnd, {}, raycastResult)

              const isOnGround =
                raycastResult.hasHit && raycastResult.distance < PHYSICS_CONSTANTS.PLAYER_RADIUS + 0.05

              const state: PhysicsBodyState = {
                position: {
                  x: body.position.x,
                  y: body.position.y,
                  z: body.position.z,
                },
                velocity: {
                  x: body.velocity.x,
                  y: body.velocity.y,
                  z: body.velocity.z,
                },
                angularVelocity: {
                  x: body.angularVelocity.x,
                  y: body.angularVelocity.y,
                  z: body.angularVelocity.z,
                },
                quaternion: {
                  x: body.quaternion.x,
                  y: body.quaternion.y,
                  z: body.quaternion.z,
                  w: body.quaternion.w,
                },
                isOnGround,
                isColliding: body.collisionResponse,
              }

              return state
            }),
            Effect.mapError(
              (error): PhysicsEngineError => ({
                _tag: 'PhysicsEngineError',
                message: `Failed to get player state: ${error}`,
                cause: toErrorCause(error),
              })
            )
          )
        )
      )
    })

  // プレイヤーに移動力を適用
  const applyMovementForce = (bodyId: string, force: Vector3D) =>
    requireBody(bodyId, (body) =>
      pipe(
        Effect.sync(() => {
          const worldForce = new CANNON.Vec3(force.x, 0, force.z)
          body.applyForce(worldForce)
        }),
        Effect.mapError(
          (error): PhysicsEngineError => ({
            _tag: 'PhysicsEngineError',
            message: `Failed to apply movement force: ${error}`,
            cause: toErrorCause(error),
          })
        )
      )
    )

  // プレイヤーのジャンプ
  const jumpPlayer = (bodyId: string, jumpVelocity: number) =>
    requireBody(bodyId, (body) =>
      pipe(
        Effect.sync(() => {
          body.velocity.y = jumpVelocity
        }),
        Effect.mapError(
          (error): PhysicsEngineError => ({
            _tag: 'PhysicsEngineError',
            message: `Failed to jump player: ${error}`,
            cause: toErrorCause(error),
          })
        )
      )
    )

  // 地面・ブロックとの衝突検知
  const raycastGround = (position: Vector3D, distance: number) =>
    requireWorld((activeWorld) =>
      pipe(
        Effect.sync(() => {
          const rayStart = new CANNON.Vec3(position.x, position.y, position.z)
          const rayEnd = new CANNON.Vec3(position.x, position.y - distance, position.z)

          const raycastResult = new CANNON.RaycastResult()
          activeWorld.raycastClosest(rayStart, rayEnd, {}, raycastResult)

          return pipe(
            Match.value(raycastResult.hasHit),
            Match.when(true, () => ({
              hit: true,
              distance: raycastResult.distance,
              normal: {
                x: raycastResult.hitNormalWorld.x,
                y: raycastResult.hitNormalWorld.y,
                z: raycastResult.hitNormalWorld.z,
              },
            })),
            Match.orElse(() => null)
          )
        }),
        Effect.mapError(
          (error): PhysicsEngineError => ({
            _tag: 'PhysicsEngineError',
            message: `Ground raycast failed: ${error}`,
            cause: toErrorCause(error),
          })
        )
      )
    )

  // 静的ブロックボディの追加
  const addStaticBlock = (position: Vector3D, size: Vector3D) =>
    requireWorld((activeWorld) =>
      pipe(
        Effect.sync(() => {
          const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2))
          const body = new CANNON.Body({
            mass: 0,
            shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            material: new CANNON.Material('ground'),
          })

          activeWorld.addBody(body)

          const bodyId = generateBodyId()
          bodies.set(bodyId, body)

          return bodyId
        }),
        Effect.mapError(
          (error): PhysicsEngineError => ({
            _tag: 'PhysicsEngineError',
            message: `Failed to add static block: ${error}`,
            cause: toErrorCause(error),
          })
        )
      )
    )

  // ボディの削除
  const removeBody = (bodyId: string) =>
    requireBody(bodyId, (body) =>
      pipe(
        Effect.sync(() => {
          pipe(
            Option.fromNullable(world),
            Option.match({
              onNone: () => undefined,
              onSome: (activeWorld) => activeWorld.removeBody(body),
            })
          )

          bodies.delete(bodyId)
          playerControllers.delete(bodyId)
        }),
        Effect.mapError(
          (error): PhysicsEngineError => ({
            _tag: 'PhysicsEngineError',
            message: `Failed to remove body: ${error}`,
            cause: toErrorCause(error),
          })
        )
      )
    )

  // 物理世界のクリーンアップ
  const cleanup = () =>
    Effect.gen(function* () {
      return yield* Effect.sync(() => {
        pipe(
          Option.fromNullable(world),
          Option.match({
            onNone: () => undefined,
            onSome: (activeWorld) =>
              pipe(
                bodies.values(),
                ReadonlyArray.fromIterable,
                ReadonlyArray.forEach((body) => activeWorld.removeBody(body))
              ),
          })
        )

        bodies.clear()
        playerControllers.clear()
        world = null
      })
    }).pipe(Effect.tap(() => Effect.logInfo('Cannon-es physics world cleaned up')))

  const service: CannonPhysicsService = {
    initializeWorld,
    createPlayerController,
    step,
    getPlayerState,
    applyMovementForce,
    jumpPlayer,
    raycastGround,
    addStaticBlock,
    removeBody,
    cleanup,
  }

  return service
})

// Live Layer実装
export const CannonPhysicsServiceLive = Layer.effect(CannonPhysicsService, makeCannonPhysicsService)
