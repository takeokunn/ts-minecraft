import * as CANNON from 'cannon-es'
import { Effect, Schema } from 'effect'
import { PhysicsConstraintError } from '../errors'
import { CannonBodySchema, toCannonBody } from '../schemas/body_schema'

/**
 * PointToPointConstraint - 点対点拘束のEffect-TSラッパー
 *
 * Phase 1.4: 2つのBodyを点で接続する拘束
 */

// PointToPointConstraintパラメータ Schema
export const PointToPointConstraintParamsSchema = Schema.Struct({
  bodyA: CannonBodySchema.pipe(
    Schema.annotations({
      description: 'First body (CANNON.Body)',
    })
  ),
  pivotA: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }).pipe(
    Schema.annotations({
      description: 'Pivot point in bodyA local coordinates',
    })
  ),
  bodyB: CannonBodySchema.pipe(
    Schema.annotations({
      description: 'Second body (CANNON.Body)',
    })
  ),
  pivotB: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }).pipe(
    Schema.annotations({
      description: 'Pivot point in bodyB local coordinates',
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
    title: 'PointToPointConstraint Parameters',
    description: 'Configuration for creating a point-to-point constraint',
  })
)

export type PointToPointConstraintParams = Schema.Schema.Type<typeof PointToPointConstraintParamsSchema>

/**
 * PointToPointConstraint生成
 *
 * @param params - Constraintパラメータ
 * @returns Effect型でラップされたCANNON.PointToPointConstraint
 */
export const createPointToPointConstraint = (
  params: PointToPointConstraintParams
): Effect.Effect<CANNON.PointToPointConstraint, PhysicsConstraintError> =>
  Effect.try({
    try: () => {
      const bodyA = toCannonBody(params.bodyA)
      const bodyB = toCannonBody(params.bodyB)

      const constraint = new CANNON.PointToPointConstraint(
        bodyA,
        new CANNON.Vec3(params.pivotA.x, params.pivotA.y, params.pivotA.z),
        bodyB,
        new CANNON.Vec3(params.pivotB.x, params.pivotB.y, params.pivotB.z),
        params.maxForce
      )

      return constraint
    },
    catch: (error) =>
      PhysicsConstraintError.make({
        type: 'point-to-point',
        cause: error,
        message: 'Failed to create point-to-point constraint',
      }),
  })

/**
 * ConstraintをWorldに追加
 *
 * @param world - 対象World
 * @param constraint - 追加する拘束
 * @returns Effect型でラップされたvoid
 */
export const addConstraintToWorld = (
  world: CANNON.World,
  constraint: CANNON.PointToPointConstraint
): Effect.Effect<void, PhysicsConstraintError> =>
  Effect.try({
    try: () => {
      world.addConstraint(constraint)
    },
    catch: (error) =>
      PhysicsConstraintError.make({
        type: 'point-to-point',
        cause: error,
        message: 'Failed to add point-to-point constraint to world',
      }),
  })
