import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { Schema } from 'effect'

import { ErrorCauseSchema } from '@shared/schema/error'

/**
 * Cannon.js物理エンジンエラー定義
 *
 * Phase 1.4: Effect-TSパターンによる型安全なエラーハンドリング
 */

// 物理世界エラー
export const PhysicsWorldErrorSchema = Schema.TaggedError('PhysicsWorldError', {
  operation: Schema.String.pipe(
    Schema.annotations({
      description: 'Failed operation name (e.g., "createWorld", "step", "addBody")',
    })
  ),
  cause: ErrorCauseSchema,
  message: Schema.optional(Schema.String).pipe(Schema.withDefault(() => 'Physics world operation failed')),
})
export type PhysicsWorldError = Schema.Schema.Type<typeof PhysicsWorldErrorSchema>
export const PhysicsWorldError = makeErrorFactory(PhysicsWorldErrorSchema)

// 物理ボディエラー
export const PhysicsBodyErrorSchema = Schema.TaggedError('PhysicsBodyError', {
  operation: Schema.String.pipe(
    Schema.annotations({
      description: 'Failed body operation (e.g., "createBody", "applyForce", "updatePosition")',
    })
  ),
  cause: ErrorCauseSchema,
  bodyId: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String).pipe(Schema.withDefault(() => 'Physics body operation failed')),
})
export type PhysicsBodyError = Schema.Schema.Type<typeof PhysicsBodyErrorSchema>
export const PhysicsBodyError = makeErrorFactory(PhysicsBodyErrorSchema)

// 物理シェイプエラー
export const PhysicsShapeErrorSchema = Schema.TaggedError('PhysicsShapeError', {
  type: Schema.Literal('box', 'sphere', 'plane').pipe(
    Schema.annotations({
      description: 'Shape type that failed to create',
    })
  ),
  cause: ErrorCauseSchema,
  message: Schema.optional(Schema.String).pipe(Schema.withDefault(() => 'Physics shape creation failed')),
})
export type PhysicsShapeError = Schema.Schema.Type<typeof PhysicsShapeErrorSchema>
export const PhysicsShapeError = makeErrorFactory(PhysicsShapeErrorSchema)

// 物理拘束エラー
export const PhysicsConstraintErrorSchema = Schema.TaggedError('PhysicsConstraintError', {
  type: Schema.Literal('point-to-point', 'distance').pipe(
    Schema.annotations({
      description: 'Constraint type that failed',
    })
  ),
  cause: ErrorCauseSchema,
  message: Schema.optional(Schema.String).pipe(Schema.withDefault(() => 'Physics constraint operation failed')),
})
export type PhysicsConstraintError = Schema.Schema.Type<typeof PhysicsConstraintErrorSchema>
export const PhysicsConstraintError = makeErrorFactory(PhysicsConstraintErrorSchema)

// レイキャストエラー
export const PhysicsRaycastErrorSchema = Schema.TaggedError('PhysicsRaycastError', {
  cause: ErrorCauseSchema,
  message: Schema.optional(Schema.String).pipe(Schema.withDefault(() => 'Raycast operation failed')),
})
export type PhysicsRaycastError = Schema.Schema.Type<typeof PhysicsRaycastErrorSchema>
export const PhysicsRaycastError = makeErrorFactory(PhysicsRaycastErrorSchema)

// マテリアルエラー
export const PhysicsMaterialErrorSchema = Schema.TaggedError('PhysicsMaterialError', {
  operation: Schema.String.pipe(
    Schema.annotations({
      description: 'Material operation that failed (e.g., "createContactMaterial")',
    })
  ),
  cause: ErrorCauseSchema,
  message: Schema.optional(Schema.String).pipe(Schema.withDefault(() => 'Physics material operation failed')),
})
export type PhysicsMaterialError = Schema.Schema.Type<typeof PhysicsMaterialErrorSchema>
export const PhysicsMaterialError = makeErrorFactory(PhysicsMaterialErrorSchema)
