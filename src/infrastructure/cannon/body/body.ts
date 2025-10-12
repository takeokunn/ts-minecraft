import * as CANNON from 'cannon-es'
import { Effect, Match, Option, Schema } from 'effect'
import { PhysicsBodyError } from '../errors'

/**
 * Body - Cannon.js剛体のEffect-TSラッパー
 *
 * Phase 1.4: 物理ボディの生成・操作API
 */

// BodyパラメータSchema
export const BodyParamsSchema = Schema.Struct({
  mass: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.annotations({
      description: 'Body mass in kg (0 = static body)',
    })
  ),
  position: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    })
  ).pipe(Schema.withDefault(() => ({ x: 0, y: 0, z: 0 }))),
  velocity: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    })
  ).pipe(Schema.withDefault(() => ({ x: 0, y: 0, z: 0 }))),
  quaternion: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
      w: Schema.Number,
    })
  ).pipe(Schema.withDefault(() => ({ x: 0, y: 0, z: 0, w: 1 }))),
  angularVelocity: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    })
  ).pipe(Schema.withDefault(() => ({ x: 0, y: 0, z: 0 }))),
  linearDamping: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))).pipe(Schema.withDefault(() => 0.01)),
  angularDamping: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))).pipe(Schema.withDefault(() => 0.01)),
  fixedRotation: Schema.optional(Schema.Boolean).pipe(Schema.withDefault(() => false)),
  allowSleep: Schema.optional(Schema.Boolean).pipe(Schema.withDefault(() => true)),
}).pipe(
  Schema.annotations({
    title: 'Body Parameters',
    description: 'Configuration for creating a physics body',
  })
)

export type BodyParams = Schema.Schema.Type<typeof BodyParamsSchema>

/**
 * Body生成
 *
 * @param params - Bodyパラメータ
 * @returns Effect型でラップされたCANNON.Body
 */
export const createBody = (params: BodyParams): Effect.Effect<CANNON.Body, PhysicsBodyError> =>
  Effect.try({
    try: () => {
      const body = new CANNON.Body({
        mass: params.mass,
        position: new CANNON.Vec3(params.position.x, params.position.y, params.position.z),
        velocity: new CANNON.Vec3(params.velocity.x, params.velocity.y, params.velocity.z),
        quaternion: new CANNON.Quaternion(
          params.quaternion.x,
          params.quaternion.y,
          params.quaternion.z,
          params.quaternion.w
        ),
        angularVelocity: new CANNON.Vec3(params.angularVelocity.x, params.angularVelocity.y, params.angularVelocity.z),
        linearDamping: params.linearDamping,
        angularDamping: params.angularDamping,
        fixedRotation: params.fixedRotation,
        allowSleep: params.allowSleep,
      })

      return body
    },
    catch: (error) =>
      PhysicsBodyError.make({
        operation: 'createBody',
        cause: error,
        message: `Failed to create body with mass: ${params.mass}`,
      }),
  })

/**
 * BodyにShapeを追加
 *
 * @param body - 対象Body
 * @param shape - 追加するShape
 * @returns Effect型でラップされたvoid
 */
export const addShape = (body: CANNON.Body, shape: CANNON.Shape): Effect.Effect<void, PhysicsBodyError> =>
  Effect.try({
    try: () => {
      body.addShape(shape)
    },
    catch: (error) =>
      PhysicsBodyError.make({
        operation: 'addShape',
        cause: error,
        message: 'Failed to add shape to body',
      }),
  })

/**
 * Bodyに力を適用
 *
 * @param body - 対象Body
 * @param force - 力ベクトル
 * @param worldPoint - 力を適用するワールド座標（オプション）
 * @returns Effect型でラップされたvoid
 */
export const applyForce = (
  body: CANNON.Body,
  force: { x: number; y: number; z: number },
  worldPoint?: { x: number; y: number; z: number }
): Effect.Effect<void, PhysicsBodyError> =>
  Effect.try({
    try: () => {
      const forceVec = new CANNON.Vec3(force.x, force.y, force.z)
      Option.match(Option.fromNullable(worldPoint), {
        onSome: (point) => body.applyForce(forceVec, new CANNON.Vec3(point.x, point.y, point.z)),
        onNone: () => body.applyForce(forceVec),
      })
    },
    catch: (error) =>
      PhysicsBodyError.make({
        operation: 'applyForce',
        cause: error,
        message: 'Failed to apply force to body',
      }),
  })

/**
 * Bodyに衝撃を適用
 *
 * @param body - 対象Body
 * @param impulse - 衝撃ベクトル
 * @param worldPoint - 衝撃を適用するワールド座標（オプション）
 * @returns Effect型でラップされたvoid
 */
export const applyImpulse = (
  body: CANNON.Body,
  impulse: { x: number; y: number; z: number },
  worldPoint?: { x: number; y: number; z: number }
): Effect.Effect<void, PhysicsBodyError> =>
  Effect.try({
    try: () => {
      const impulseVec = new CANNON.Vec3(impulse.x, impulse.y, impulse.z)
      Option.match(Option.fromNullable(worldPoint), {
        onSome: (point) => body.applyImpulse(impulseVec, new CANNON.Vec3(point.x, point.y, point.z)),
        onNone: () => body.applyImpulse(impulseVec),
      })
    },
    catch: (error) =>
      PhysicsBodyError.make({
        operation: 'applyImpulse',
        cause: error,
        message: 'Failed to apply impulse to body',
      }),
  })

/**
 * Bodyの位置を更新
 *
 * @param body - 対象Body
 * @param position - 新しい位置
 * @returns Effect型でラップされたvoid
 */
export const updatePosition = (
  body: CANNON.Body,
  position: { x: number; y: number; z: number }
): Effect.Effect<void, PhysicsBodyError> =>
  Effect.try({
    try: () => {
      body.position.set(position.x, position.y, position.z)
    },
    catch: (error) =>
      PhysicsBodyError.make({
        operation: 'updatePosition',
        cause: error,
        message: 'Failed to update body position',
      }),
  })

/**
 * Bodyの速度を更新
 *
 * @param body - 対象Body
 * @param velocity - 新しい速度
 * @returns Effect型でラップされたvoid
 */
export const updateVelocity = (
  body: CANNON.Body,
  velocity: { x: number; y: number; z: number }
): Effect.Effect<void, PhysicsBodyError> =>
  Effect.try({
    try: () => {
      body.velocity.set(velocity.x, velocity.y, velocity.z)
    },
    catch: (error) =>
      PhysicsBodyError.make({
        operation: 'updateVelocity',
        cause: error,
        message: 'Failed to update body velocity',
      }),
  })
