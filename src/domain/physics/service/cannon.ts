import type { PlayerId } from '@domain/entities'
import type { Vector3D } from '@domain/entities'
import * as CANNON from 'cannon-es'
import { Context, Effect, Layer, pipe } from 'effect'

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
  readonly cause?: unknown
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

        // ソルバー設定 (Cannon-es 0.20+)
        if ('iterations' in world.solver) {
          ;(world.solver as any).iterations = 10
        }
        if ('tolerance' in world.solver) {
          ;(world.solver as any).tolerance = 0.1
        }

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

        console.log('Cannon-es physics world initialized')
      })
    })

  // プレイヤーCharacter Controllerの作成
  const createPlayerController = (
    playerId: PlayerId,
    initialPosition: Vector3D,
    config: Partial<CharacterControllerConfig> = {}
  ) =>
    Effect.gen(function* () {
      return yield* pipe(
        Effect.sync(() => {
          if (!world) {
            throw new Error('Physics world not initialized')
          }

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
          world.addBody(body)

          // 管理データに追加
          const bodyId = generateBodyId()
          bodies.set(bodyId, body)
          playerControllers.set(bodyId, playerId)

          console.log(`Player controller created for ${playerId} with bodyId: ${bodyId}`)
          return bodyId
        }),
        Effect.mapError(
          (error): PhysicsEngineError => ({
            _tag: 'PhysicsEngineError',
            message: `Failed to create player controller: ${error}`,
            cause: error,
          })
        )
      )
    })

  // 物理ステップの実行
  const step = (deltaTime: number) =>
    Effect.gen(function* () {
      return yield* pipe(
        Effect.sync(() => {
          if (!world) {
            throw new Error('Physics world not initialized')
          }

          // 固定タイムステップで物理演算を実行
          world.fixedStep(PHYSICS_CONSTANTS.TIME_STEP, deltaTime)
        }),
        Effect.mapError(
          (error): PhysicsEngineError => ({
            _tag: 'PhysicsEngineError',
            message: `Physics step failed: ${error}`,
            cause: error,
          })
        )
      )
    })

  // プレイヤーボディの状態取得
  const getPlayerState = (bodyId: string) =>
    Effect.gen(function* () {
      return yield* pipe(
        Effect.sync(() => {
          const body = bodies.get(bodyId)
          if (!body) {
            throw new Error(`Body not found: ${bodyId}`)
          }

          // 地面判定のためのレイキャスト
          const rayStart = body.position.clone()
          const rayEnd = rayStart.clone()
          rayEnd.y -= PHYSICS_CONSTANTS.PLAYER_RADIUS + 0.1

          const raycastResult = new CANNON.RaycastResult()
          world?.raycastClosest(rayStart, rayEnd, {}, raycastResult)

          const isOnGround = raycastResult.hasHit && raycastResult.distance < PHYSICS_CONSTANTS.PLAYER_RADIUS + 0.05

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
            cause: error,
          })
        )
      )
    })

  // プレイヤーに移動力を適用
  const applyMovementForce = (bodyId: string, force: Vector3D) =>
    Effect.gen(function* () {
      return yield* pipe(
        Effect.sync(() => {
          const body = bodies.get(bodyId)
          if (!body) {
            throw new Error(`Body not found: ${bodyId}`)
          }

          // 水平方向のみに力を適用（Y方向は重力とジャンプで管理）
          const worldForce = new CANNON.Vec3(force.x, 0, force.z)
          body.applyForce(worldForce)
        }),
        Effect.mapError(
          (error): PhysicsEngineError => ({
            _tag: 'PhysicsEngineError',
            message: `Failed to apply movement force: ${error}`,
            cause: error,
          })
        )
      )
    })

  // プレイヤーのジャンプ
  const jumpPlayer = (bodyId: string, jumpVelocity: number) =>
    Effect.gen(function* () {
      return yield* pipe(
        Effect.sync(() => {
          const body = bodies.get(bodyId)
          if (!body) {
            throw new Error(`Body not found: ${bodyId}`)
          }

          // Y方向に瞬間的な速度を与える
          body.velocity.y = jumpVelocity
        }),
        Effect.mapError(
          (error): PhysicsEngineError => ({
            _tag: 'PhysicsEngineError',
            message: `Failed to jump player: ${error}`,
            cause: error,
          })
        )
      )
    })

  // 地面・ブロックとの衝突検知
  const raycastGround = (position: Vector3D, distance: number) =>
    Effect.gen(function* () {
      return yield* pipe(
        Effect.sync(() => {
          if (!world) {
            throw new Error('Physics world not initialized')
          }

          const rayStart = new CANNON.Vec3(position.x, position.y, position.z)
          const rayEnd = new CANNON.Vec3(position.x, position.y - distance, position.z)

          const raycastResult = new CANNON.RaycastResult()
          world.raycastClosest(rayStart, rayEnd, {}, raycastResult)

          if (raycastResult.hasHit) {
            return {
              hit: true,
              distance: raycastResult.distance,
              normal: {
                x: raycastResult.hitNormalWorld.x,
                y: raycastResult.hitNormalWorld.y,
                z: raycastResult.hitNormalWorld.z,
              },
            }
          }

          return null
        }),
        Effect.mapError(
          (error): PhysicsEngineError => ({
            _tag: 'PhysicsEngineError',
            message: `Ground raycast failed: ${error}`,
            cause: error,
          })
        )
      )
    })

  // 静的ブロックボディの追加
  const addStaticBlock = (position: Vector3D, size: Vector3D) =>
    Effect.gen(function* () {
      return yield* pipe(
        Effect.sync(() => {
          if (!world) {
            throw new Error('Physics world not initialized')
          }

          const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2))
          const body = new CANNON.Body({
            mass: 0, // 静的オブジェクト
            shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            material: new CANNON.Material('ground'),
          })

          world.addBody(body)

          const bodyId = generateBodyId()
          bodies.set(bodyId, body)

          return bodyId
        }),
        Effect.mapError(
          (error): PhysicsEngineError => ({
            _tag: 'PhysicsEngineError',
            message: `Failed to add static block: ${error}`,
            cause: error,
          })
        )
      )
    })

  // ボディの削除
  const removeBody = (bodyId: string) =>
    Effect.gen(function* () {
      return yield* pipe(
        Effect.sync(() => {
          const body = bodies.get(bodyId)
          if (!body) {
            throw new Error(`Body not found: ${bodyId}`)
          }

          if (world) {
            world.removeBody(body)
          }

          bodies.delete(bodyId)
          playerControllers.delete(bodyId)
        }),
        Effect.mapError(
          (error): PhysicsEngineError => ({
            _tag: 'PhysicsEngineError',
            message: `Failed to remove body: ${error}`,
            cause: error,
          })
        )
      )
    })

  // 物理世界のクリーンアップ
  const cleanup = () =>
    Effect.gen(function* () {
      return yield* Effect.sync(() => {
        if (world) {
          // 全てのボディを削除
          for (const body of bodies.values()) {
            world.removeBody(body)
          }
        }

        bodies.clear()
        playerControllers.clear()
        world = null

        console.log('Cannon-es physics world cleaned up')
      })
    })

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
