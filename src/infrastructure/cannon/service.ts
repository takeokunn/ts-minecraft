import * as CANNON from 'cannon-es'
import { Context, Effect, Layer, Pool, Resource, Scope } from 'effect'
import { PhysicsWorldError } from './errors'
import { addBody, createWorld, raycast, removeBody, step, type WorldParams } from './world/world'

/**
 * PhysicsWorldService - Cannon.js物理エンジンサービス
 *
 * Phase 1.4: Effect-TS DIパターンによる物理エンジン提供
 */

export interface PhysicsWorldService {
  /**
   * Worldリソース（Resource.manualベース）
   */
  readonly worldResource: Resource.Resource<CANNON.World, PhysicsWorldError>

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

  /**
   * Worldリソースを再作成
   */
  readonly refresh: Effect.Effect<void, PhysicsWorldError>
}

export const PhysicsWorldService = Context.GenericTag<PhysicsWorldService>(
  '@minecraft/infrastructure/cannon/PhysicsWorldService'
)

const defaultWorldParams = (): WorldParams => ({
  gravity: { x: 0, y: -9.82, z: 0 },
  broadphase: 'sap',
  solver: {
    iterations: 10,
    tolerance: 0.1,
  },
})

const cleanupWorld = (world: CANNON.World): Effect.Effect<void> =>
  Effect.sync(() => {
    world.bodies.forEach((body) => world.removeBody(body))
  })

const makePhysicsWorldLayer = (params: WorldParams): Layer.Layer<PhysicsWorldService> =>
  Layer.scoped(
    PhysicsWorldService,
    Effect.gen(function* () {
      const worldResource = yield* Resource.manual(
        Effect.acquireRelease(createWorld(params), cleanupWorld)
      )

      const useWorld = <A, E>(
        f: (world: CANNON.World) => Effect.Effect<A, E>
      ): Effect.Effect<A, PhysicsWorldError | E> => Effect.flatMap(Resource.get(worldResource), f)

      return PhysicsWorldService.of({
        worldResource,
        refresh: Resource.refresh(worldResource),
        getWorld: Resource.get(worldResource),
        step: (deltaTime) => useWorld((world) => step(world, deltaTime)),
        addBody: (body) => useWorld((world) => addBody(world, body)),
        removeBody: (body) => useWorld((world) => removeBody(world, body)),
        raycast: (from, to) => useWorld((world) => raycast(world, from, to)),
      })
    })
  )

/**
 * PhysicsWorldService Live Implementation
 *
 * Effect.Scopeによるリソース管理を実装
 */
export const PhysicsWorldServiceLive = makePhysicsWorldLayer(defaultWorldParams())

/**
 * カスタムパラメータでPhysicsWorldServiceを生成
 */
export const makePhysicsWorldServiceLive = (params: WorldParams): Layer.Layer<PhysicsWorldService> =>
  makePhysicsWorldLayer(params)

export const makePhysicsWorldPool = (
  poolSize: number = 2,
  params: WorldParams = defaultWorldParams()
): Effect.Effect<Pool.Pool<CANNON.World, PhysicsWorldError>, never, Scope.Scope> =>
  Pool.make({
    acquire: Effect.acquireRelease(createWorld(params), cleanupWorld),
    size: poolSize,
  }).pipe(
    Effect.annotateLogs('physics.pool.operation', 'make'),
    Effect.annotateLogs('physics.pool.size', poolSize)
  )

export const withPhysicsWorldFromPool = <A, E>(
  pool: Pool.Pool<CANNON.World, PhysicsWorldError>,
  f: (world: CANNON.World) => Effect.Effect<A, E>
): Effect.Effect<A, E | PhysicsWorldError> =>
  Pool.use(pool, f)

export const makePhysicsWorldPoolResource = (
  poolSize: number = 2,
  params: WorldParams = defaultWorldParams()
): Effect.Effect<
  Resource.Resource<Pool.Pool<CANNON.World, PhysicsWorldError>, PhysicsWorldError>,
  never,
  Scope.Scope
> =>
  Resource.manual(makePhysicsWorldPool(poolSize, params)).pipe(
    Effect.annotateLogs('physics.pool.operation', 'resource'),
    Effect.annotateLogs('physics.pool.size', poolSize)
  )

export const usePhysicsWorldFromResource = <A, E>(
  resource: Resource.Resource<Pool.Pool<CANNON.World, PhysicsWorldError>, PhysicsWorldError>,
  f: (world: CANNON.World) => Effect.Effect<A, E>
): Effect.Effect<A, E | PhysicsWorldError> =>
  Effect.flatMap(Resource.get(resource), (pool) => Pool.use(pool, f))
