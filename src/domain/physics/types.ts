import { BlockTypeIdSchema } from '@domain/entities'
import { Brand, Schema } from 'effect'
import { Vector3Schema } from './types/core'

/**
 * 流体タイプ
 */
const FluidTypeSchema = Schema.Literal('water', 'lava', 'none')
export type FluidType = Schema.Schema.Type<typeof FluidTypeSchema>

/**
 * AABB (Axis-Aligned Bounding Box) 型
 * 衝突判定用の境界ボックス
 */
export const AABBSchema = Schema.Struct({
  _tag: Schema.Literal('AABB'),
  min: Vector3Schema,
  max: Vector3Schema,
}).pipe(Schema.brand('AABB'))

export type AABB = Schema.Schema.Type<typeof AABBSchema> & Brand.Brand<'AABB'>

/**
 * 衝突結果
 */
export const CollisionResultSchema = Schema.Struct({
  position: Vector3Schema,
  velocity: Vector3Schema,
  isGrounded: Schema.Boolean,
  collidedAxes: Schema.Struct({
    x: Schema.Boolean,
    y: Schema.Boolean,
    z: Schema.Boolean,
  }),
  nearbyBlocks: Schema.Array(
    Schema.Struct({
      position: Vector3Schema,
      blockType: BlockTypeIdSchema,
    })
  ),
})

export type CollisionResult = Schema.Schema.Type<typeof CollisionResultSchema>

/**
 * 流体物理演算結果
 */
export const FluidPhysicsResultSchema = Schema.Struct({
  velocity: Vector3Schema,
  buoyancy: Schema.Number,
  isSubmerged: Schema.Boolean,
  submersionDepth: Schema.Number,
})

export type FluidPhysicsResult = Schema.Schema.Type<typeof FluidPhysicsResultSchema>

/**
 * 物理エラー型
 */
export const PhysicsErrorSchema = Schema.TaggedStruct('PhysicsError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
})

export type PhysicsError = Schema.Schema.Type<typeof PhysicsErrorSchema>
