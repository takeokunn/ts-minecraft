import * as CANNON from 'cannon-es'
import { Effect, Schema } from 'effect'
import { PhysicsShapeError } from '../errors'

/**
 * Plane Shape - Cannon.js Plane形状のEffect-TSラッパー
 *
 * Phase 1.4: 無限平面形状の生成（主に地面として使用）
 */

// Plane形状はパラメータ不要（無限平面）
export const PlaneShapeParamsSchema = Schema.Struct({}).pipe(
  Schema.annotations({
    title: 'Plane Shape Parameters',
    description: 'Plane shape has no parameters (infinite plane, typically used for ground)',
  })
)

export type PlaneShapeParams = Schema.Schema.Type<typeof PlaneShapeParamsSchema>

/**
 * Plane Shape生成
 *
 * Planeは無限平面なのでパラメータ不要
 *
 * @returns Effect型でラップされたCANNON.Plane
 */
export const createPlaneShape = (): Effect.Effect<CANNON.Plane, PhysicsShapeError> =>
  Effect.try({
    try: () => new CANNON.Plane(),
    catch: (error) =>
      PhysicsShapeError.make({
        type: 'plane',
        cause: error,
        message: 'Failed to create plane shape',
      }),
  })
