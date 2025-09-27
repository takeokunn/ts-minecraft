import { BlockTypeIdSchema } from '@domain/core/types/brands'
import { Schema } from '@effect/schema'
import { Brand } from 'effect'
import { Vector3Schema } from '../world/types'

/**
 * 物理エンジンの定数定義
 */
export const PHYSICS_CONSTANTS = {
  GRAVITY: 32.0, // blocks/s²
  TERMINAL_VELOCITY: 78.4, // blocks/s
  WATER_RESISTANCE: 0.8,
  LAVA_RESISTANCE: 0.5,
  AIR_RESISTANCE: 0.98,
  DEFAULT_FRICTION: 0.6,
} as const

/**
 * 流体タイプ
 */
export const FluidTypeSchema = Schema.Literal('water', 'lava', 'none')
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
 * ブロック摩擦係数マップ
 */
export const BLOCK_FRICTION: Record<number, number> = {
  0: 0.6, // Air (default)
  1: 0.6, // Stone
  2: 0.6, // Grass
  3: 0.6, // Dirt
  4: 0.6, // Cobblestone
  5: 0.6, // Wood
  6: 0.6, // Sapling
  7: 0.6, // Bedrock
  8: 0.8, // Water (higher = less friction)
  9: 0.8, // Stationary water
  10: 0.5, // Lava
  11: 0.5, // Stationary lava
  12: 0.6, // Sand
  13: 0.6, // Gravel
  79: 0.98, // Ice (very slippery)
  174: 0.98, // Packed ice
} as const

/**
 * 物理エラー型
 */
export const PhysicsErrorSchema = Schema.TaggedStruct('PhysicsError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
})

export type PhysicsError = Schema.Schema.Type<typeof PhysicsErrorSchema>
