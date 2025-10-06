import * as CANNON from 'cannon-es'
import { Context, Effect, Layer, Pool, Scope } from 'effect'
import { PhysicsWorldError } from './errors'
import { addBody, createWorld, raycast, removeBody, step, type WorldParams } from './world/world'

/**
 * PhysicsWorldService - Cannon.js物理エンジンサービス
 *
 * Phase 1.4: Effect-TS DIパターンによる物理エンジン提供
 */

export interface PhysicsWorldService {
  /**
   * 物理シミュレーションのステップ実行
   */
  readonly step: (deltaTime: number) => Effect.Effect<void, PhysicsWorldError>

  /**
   * WorldにBodyを追加
   */
  readonly addBody: (body: CANNON.Body) => Effect.Effect<void, PhysicsWorldError>

  /**
   * WorldからBodyを削除
   */
  readonly removeBody: (body: CANNON.Body) => Effect.Effect<void, PhysicsWorldError>

  /**
   * レイキャスト実行
   */
  readonly raycast: (
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number }
  ) => Effect.Effect<
    {
      hasHit: boolean
      distance: number
      hitPoint: { x: number; y: number; z: number }
      hitNormal: { x: number; y: number; z: number }
      body: CANNON.Body | null
    } | null,
    PhysicsWorldError
  >

  /**
   * 内部のCANNON.Worldインスタンスを取得（高度な操作用）
   */
  readonly getWorld: () => Effect.Effect<CANNON.World, PhysicsWorldError>
}

export const PhysicsWorldService = Context.GenericTag<PhysicsWorldService>(
  '@minecraft/infrastructure/cannon/PhysicsWorldService'
)

/**
 * PhysicsWorldService Live Implementation
 *
 * Effect.Scopeによるリソース管理を実装
 */
export const PhysicsWorldServiceLive = Layer.scoped(
  PhysicsWorldService,
  Effect.gen(function* () {
    // デフォルトパラメータでWorld生成
    const defaultParams: WorldParams = {
      gravity: { x: 0, y: -9.82, z: 0 },
      broadphase: 'sap',
      solver: {
        iterations: 10,
        tolerance: 0.1,
      },
    }

    // World生成（Effect.acquireReleaseでリソース管理）
    const world = yield* Effect.acquireRelease(createWorld(defaultParams), (w) =>
      Effect.sync(() => {
        // Cannon.jsはdisposeメソッドを持たないが、
        // 全Bodyを削除してクリーンアップ
        w.bodies.forEach((body) => w.removeBody(body))
      })
    )

    return {
      step: (deltaTime) => step(world, deltaTime),
      addBody: (body) => addBody(world, body),
      removeBody: (body) => removeBody(world, body),
      raycast: (from, to) => raycast(world, from, to),
      getWorld: () => Effect.succeed(world),
    }
  })
)

/**
 * カスタムパラメータでPhysicsWorldServiceを生成
 */
export const makePhysicsWorldServiceLive = (params: WorldParams): Layer.Layer<PhysicsWorldService> =>
  Layer.scoped(
    PhysicsWorldService,
    Effect.gen(function* () {
      const world = yield* Effect.acquireRelease(createWorld(params), (w) =>
        Effect.sync(() => {
          w.bodies.forEach((body) => w.removeBody(body))
        })
      )

      return {
        step: (deltaTime) => step(world, deltaTime),
        addBody: (body) => addBody(world, body),
        removeBody: (body) => removeBody(world, body),
        raycast: (from, to) => raycast(world, from, to),
        getWorld: () => Effect.succeed(world),
      }
    })
  )

/**
 * ✅ Pool-based CANNON.World管理
 * 複数の物理シミュレーションを独立実行する場合に使用
 * 例: マルチワールド、オフライン物理計算、分散シミュレーション
 */
export const makePhysicsWorldPool = (
  poolSize: number = 2,
  params?: WorldParams
): Effect.Effect<Pool.Pool<CANNON.World, PhysicsWorldError>, never, Scope.Scope> => {
  const worldParams = params || {
    gravity: { x: 0, y: -9.82, z: 0 },
    broadphase: 'sap',
    solver: {
      iterations: 10,
      tolerance: 0.1,
    },
  }

  return Pool.make({
    acquire: Effect.acquireRelease(createWorld(worldParams), (world) =>
      Effect.sync(() => {
        world.bodies.forEach((body) => world.removeBody(body))
      })
    ),
    size: poolSize,
  })
}

/**
 * PoolからCANNON.Worldを取得して処理実行
 */
export const withPooledPhysicsWorld = <A, E>(
  pool: Pool.Pool<CANNON.World, PhysicsWorldError>,
  f: (world: CANNON.World) => Effect.Effect<A, E>
): Effect.Effect<A, E | PhysicsWorldError> => Pool.use(pool, f)
