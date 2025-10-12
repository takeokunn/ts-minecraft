import * as CANNON from 'cannon-es'
import { Effect, Match, Schema } from 'effect'
import { PhysicsRaycastError } from '../errors'
import { CannonBodySchema, makeCannonBodyUnsafe } from '../schemas/body_schema'

/**
 * RaycastResult - Cannon.jsレイキャストのEffect-TSラッパー
 *
 * Phase 1.4: レイキャスト結果の型安全化
 */

// RaycastResultSchema（レイキャスト結果）
export const RaycastResultSchema = Schema.Struct({
  hasHit: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether the ray hit anything',
    })
  ),
  distance: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.annotations({
      description: 'Distance from ray origin to hit point',
    })
  ),
  hitPoint: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }).pipe(
    Schema.annotations({
      description: 'World coordinates of the hit point',
    })
  ),
  hitNormal: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }).pipe(
    Schema.annotations({
      description: 'Normal vector at the hit point',
    })
  ),
  body: Schema.Union(Schema.Null, CannonBodySchema).pipe(
    Schema.annotations({
      description: 'The body that was hit (CANNON.Body or null)',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'Raycast Result',
    description: 'Result of a raycast operation',
  })
)

export type RaycastResult = Schema.Schema.Type<typeof RaycastResultSchema>

/**
 * Raycast実行（全てのヒット点を返す）
 *
 * @param world - 対象World
 * @param from - レイ開始点
 * @param to - レイ終了点
 * @returns Effect型でラップされたRaycastResult配列
 */
export const raycastAll = (
  world: CANNON.World,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number }
): Effect.Effect<RaycastResult[], PhysicsRaycastError> =>
  Effect.try({
    try: () => {
      const rayStart = new CANNON.Vec3(from.x, from.y, from.z)
      const rayEnd = new CANNON.Vec3(to.x, to.y, to.z)

      const results: RaycastResult[] = []

      const callback = (result: CANNON.RaycastResult) => {
        results.push({
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
          body: result.body ? makeCannonBodyUnsafe(result.body) : null,
        })
      }

      world.raycastAll(rayStart, rayEnd, {}, callback)

      return results
    },
    catch: (error) =>
      PhysicsRaycastError.make({
        cause: error,
        message: 'Failed to perform raycastAll',
      }),
  })

/**
 * Raycast実行（最も近いヒット点のみ返す）
 *
 * @param world - 対象World
 * @param from - レイ開始点
 * @param to - レイ終了点
 * @returns Effect型でラップされたRaycastResult（ヒットしなければnull）
 */
export const raycastClosest = (
  world: CANNON.World,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number }
): Effect.Effect<RaycastResult | null, PhysicsRaycastError> =>
  Effect.try({
    try: () => {
      const rayStart = new CANNON.Vec3(from.x, from.y, from.z)
      const rayEnd = new CANNON.Vec3(to.x, to.y, to.z)

      const result = new CANNON.RaycastResult()
      world.raycastClosest(rayStart, rayEnd, {}, result)

      return Match.value(result.hasHit).pipe(
        Match.when(false, () => null),
        Match.orElse(() => ({
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
          body: result.body ? makeCannonBodyUnsafe(result.body) : null,
        })),
        Match.exhaustive
      )
    },
    catch: (error) =>
      PhysicsRaycastError.make({
        cause: error,
        message: 'Failed to perform raycastClosest',
      }),
  })
