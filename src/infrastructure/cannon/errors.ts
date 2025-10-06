import { Schema } from 'effect'

/**
 * Cannon.js物理エンジンエラー定義
 *
 * Phase 1.4: Effect-TSパターンによる型安全なエラーハンドリング
 */

// 物理世界エラー
export class PhysicsWorldError extends Schema.TaggedError<PhysicsWorldError>()('PhysicsWorldError', {
  operation: Schema.String.pipe(
    Schema.annotations({
      description: 'Failed operation name (e.g., "createWorld", "step", "addBody")',
    })
  ),
  cause: Schema.Unknown,
  message: Schema.optional(Schema.String).pipe(Schema.withDefault(() => 'Physics world operation failed')),
}) {}

// 物理ボディエラー
export class PhysicsBodyError extends Schema.TaggedError<PhysicsBodyError>()('PhysicsBodyError', {
  operation: Schema.String.pipe(
    Schema.annotations({
      description: 'Failed body operation (e.g., "createBody", "applyForce", "updatePosition")',
    })
  ),
  cause: Schema.Unknown,
  bodyId: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String).pipe(Schema.withDefault(() => 'Physics body operation failed')),
}) {}

// 物理シェイプエラー
export class PhysicsShapeError extends Schema.TaggedError<PhysicsShapeError>()('PhysicsShapeError', {
  type: Schema.Literal('box', 'sphere', 'plane').pipe(
    Schema.annotations({
      description: 'Shape type that failed to create',
    })
  ),
  cause: Schema.Unknown,
  message: Schema.optional(Schema.String).pipe(Schema.withDefault(() => 'Physics shape creation failed')),
}) {}

// 物理拘束エラー
export class PhysicsConstraintError extends Schema.TaggedError<PhysicsConstraintError>()('PhysicsConstraintError', {
  type: Schema.Literal('point-to-point', 'distance').pipe(
    Schema.annotations({
      description: 'Constraint type that failed',
    })
  ),
  cause: Schema.Unknown,
  message: Schema.optional(Schema.String).pipe(Schema.withDefault(() => 'Physics constraint operation failed')),
}) {}

// レイキャストエラー
export class PhysicsRaycastError extends Schema.TaggedError<PhysicsRaycastError>()('PhysicsRaycastError', {
  cause: Schema.Unknown,
  message: Schema.optional(Schema.String).pipe(Schema.withDefault(() => 'Raycast operation failed')),
}) {}

// マテリアルエラー
export class PhysicsMaterialError extends Schema.TaggedError<PhysicsMaterialError>()('PhysicsMaterialError', {
  operation: Schema.String.pipe(
    Schema.annotations({
      description: 'Material operation that failed (e.g., "createContactMaterial")',
    })
  ),
  cause: Schema.Unknown,
  message: Schema.optional(Schema.String).pipe(Schema.withDefault(() => 'Physics material operation failed')),
}) {}
