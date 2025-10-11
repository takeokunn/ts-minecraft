import * as CANNON from 'cannon-es'
import { Effect, Schema } from 'effect'
import { PhysicsConstraintError } from '../errors'
import { CannonBodySchema, toCannonBody } from '../schemas/body_schema'

/**
 * DistanceConstraint - 距離拘束のEffect-TSラッパー
 *
 * Phase 1.4: 2つのBodyを一定距離に保つ拘束
 */

// DistanceConstraintパラメータ Schema
export const DistanceConstraintParamsSchema = Schema.Struct({
  bodyA: CannonBodySchema.pipe(
    Schema.annotations({
      description: 'First body (CANNON.Body)',
    })
  ),
  bodyB: CannonBodySchema.pipe(
    Schema.annotations({
      description: 'Second body (CANNON.Body)',
    })
  ),
  distance: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.annotations({
      description: 'Target distance between bodies',
    })
  ),
  maxForce: Schema.optional(Schema.Number.pipe(Schema.positive())).pipe(
    Schema.withDefault(() => 1e6),
    Schema.annotations({
      description: 'Maximum force to apply (default: 1e6)',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'DistanceConstraint Parameters',
    description: 'Configuration for creating a distance constraint',
  })
)

export type DistanceConstraintParams = Schema.Schema.Type<typeof DistanceConstraintParamsSchema>

/**
 * DistanceConstraint生成
 *
 * @param params - Constraintパラメータ
 * @returns Effect型でラップされたCANNON.DistanceConstraint
 */
export const createDistanceConstraint = (
  params: DistanceConstraintParams
): Effect.Effect<CANNON.DistanceConstraint, PhysicsConstraintError> =>
  Effect.try({
    try: () => {
      const bodyA = toCannonBody(params.bodyA)
      const bodyB = toCannonBody(params.bodyB)

      const constraint = new CANNON.DistanceConstraint(bodyA, bodyB, params.distance, params.maxForce)

      return constraint
    },
    catch: (error) =>
      PhysicsConstraintError.make({
        type: 'distance',
        cause: error,
        message: `Failed to create distance constraint with distance: ${params.distance}`,
      }),
  })

/**
 * DistanceConstraintをWorldに追加
 *
 * @param world - 対象World
 * @param constraint - 追加する拘束
 * @returns Effect型でラップされたvoid
 */
export const addDistanceConstraintToWorld = (
  world: CANNON.World,
  constraint: CANNON.DistanceConstraint
): Effect.Effect<void, PhysicsConstraintError> =>
  Effect.try({
    try: () => {
      world.addConstraint(constraint)
    },
    catch: (error) =>
      PhysicsConstraintError.make({
        type: 'distance',
        cause: error,
        message: 'Failed to add distance constraint to world',
      }),
  })
