import * as CANNON from 'cannon-es'
import { Effect, Schema } from 'effect'
import { PhysicsWorldError } from '../errors'

/**
 * World - Cannon.js物理世界のEffect-TSラッパー
 *
 * Phase 1.4: 物理世界の生成・step・Body追加削除・レイキャスト
 */

// Worldパラメータ Schema
export const WorldParamsSchema = Schema.Struct({
  gravity: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    }).pipe(
      Schema.annotations({
        description: 'Gravity vector (default: { x: 0, y: -9.82, z: 0 })',
      })
    )
  ).pipe(Schema.withDefault(() => ({ x: 0, y: -9.82, z: 0 }))),
  broadphase: Schema.optional(Schema.Literal('naive', 'sap')).pipe(
    Schema.withDefault(() => 'sap' as const),
    Schema.annotations({
      description: 'Broadphase algorithm (sap = Sweep and Prune, recommended for performance)',
    })
  ),
  solver: Schema.optional(
    Schema.Struct({
      iterations: Schema.Number.pipe(Schema.int(), Schema.positive()),
      tolerance: Schema.Number.pipe(Schema.positive()),
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'World Parameters',
    description: 'Configuration for creating a physics world',
  })
)

export type WorldParams = Schema.Schema.Type<typeof WorldParamsSchema>

/**
 * World生成
 *
 * @param params - Worldパラメータ
 * @returns Effect型でラップされたCANNON.World
 */
export const createWorld = (params: WorldParams): Effect.Effect<CANNON.World, PhysicsWorldError> =>
  Effect.try({
    try: () => {
      const world = new CANNON.World()

      // 重力設定
      world.gravity.set(params.gravity.x, params.gravity.y, params.gravity.z)

      // Broadphase設定
      if (params.broadphase === 'sap') {
        world.broadphase = new CANNON.SAPBroadphase(world)
      }
      // naive はデフォルトなので設定不要

      // Solver設定
      if (params.solver) {
        if ('iterations' in world.solver) {
          ;(world.solver as CANNON.GSSolver).iterations = params.solver.iterations
        }
        if ('tolerance' in world.solver) {
          ;(world.solver as CANNON.GSSolver).tolerance = params.solver.tolerance
        }
      }

      return world
    },
    catch: (error) =>
      new PhysicsWorldError({
        operation: 'createWorld',
        cause: error,
        message: 'Failed to create physics world',
      }),
  })

/**
 * 物理シミュレーションのステップ実行
 *
 * @param world - 対象World
 * @param deltaTime - 経過時間（秒）
 * @returns Effect型でラップされたvoid
 */
export const step = (world: CANNON.World, deltaTime: number): Effect.Effect<void, PhysicsWorldError> =>
  Effect.try({
    try: () => {
      // 固定タイムステップで物理演算実行
      world.fixedStep(1 / 60, deltaTime, 3)
    },
    catch: (error) =>
      new PhysicsWorldError({
        operation: 'step',
        cause: error,
        message: `Failed to step physics world with deltaTime: ${deltaTime}`,
      }),
  })

/**
 * WorldにBodyを追加
 *
 * @param world - 対象World
 * @param body - 追加するBody
 * @returns Effect型でラップされたvoid
 */
export const addBody = (world: CANNON.World, body: CANNON.Body): Effect.Effect<void, PhysicsWorldError> =>
  Effect.try({
    try: () => {
      world.addBody(body)
    },
    catch: (error) =>
      new PhysicsWorldError({
        operation: 'addBody',
        cause: error,
        message: 'Failed to add body to world',
      }),
  })

/**
 * WorldからBodyを削除
 *
 * @param world - 対象World
 * @param body - 削除するBody
 * @returns Effect型でラップされたvoid
 */
export const removeBody = (world: CANNON.World, body: CANNON.Body): Effect.Effect<void, PhysicsWorldError> =>
  Effect.try({
    try: () => {
      world.removeBody(body)
    },
    catch: (error) =>
      new PhysicsWorldError({
        operation: 'removeBody',
        cause: error,
        message: 'Failed to remove body from world',
      }),
  })

/**
 * レイキャスト実行（最も近い衝突点を返す）
 *
 * @param world - 対象World
 * @param from - レイ開始点
 * @param to - レイ終了点
 * @returns Effect型でラップされたRaycastResult（ヒットしなければnull）
 */
export const raycast = (
  world: CANNON.World,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number }
): Effect.Effect<
  {
    hasHit: boolean
    distance: number
    hitPoint: { x: number; y: number; z: number }
    hitNormal: { x: number; y: number; z: number }
    body: CANNON.Body | null
  } | null,
  PhysicsWorldError
> =>
  Effect.try({
    try: () => {
      const rayStart = new CANNON.Vec3(from.x, from.y, from.z)
      const rayEnd = new CANNON.Vec3(to.x, to.y, to.z)

      const result = new CANNON.RaycastResult()
      world.raycastClosest(rayStart, rayEnd, {}, result)

      if (!result.hasHit) {
        return null
      }

      return {
        hasHit: result.hasHit,
        distance: result.distance,
        hitPoint: {
          x: result.hitPointWorld.x,
          y: result.hitPointWorld.y,
          z: result.hitPointWorld.z,
        },
        hitNormal: {
          x: result.hitNormalWorld.x,
          y: result.hitNormalWorld.y,
          z: result.hitNormalWorld.z,
        },
        body: result.body,
      }
    },
    catch: (error) =>
      new PhysicsWorldError({
        operation: 'raycast',
        cause: error,
        message: 'Failed to perform raycast',
      }),
  })
