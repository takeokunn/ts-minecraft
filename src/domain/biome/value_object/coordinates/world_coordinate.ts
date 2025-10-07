/**
 * WorldCoordinate Value Object - ワールド空間における3D座標
 *
 * 無限ワールドにおける絶対座標を表現する不変オブジェクト
 * 型安全性とオーバーフロー防止を完全実装
 */

import { taggedUnion } from '@domain/world/utils'
import type { Brand as BrandType } from 'effect'
import { Schema } from 'effect'

/**
 * World座標系の各軸のBrand型
 */
export type WorldX = number & BrandType.Brand<'WorldX'>
export type WorldY = number & BrandType.Brand<'WorldY'>
export type WorldZ = number & BrandType.Brand<'WorldZ'>

/**
 * World座標制限値（Minecraft準拠）
 */
export const WORLD_COORDINATE_LIMITS = {
  MIN_X: -30000000,
  MAX_X: 30000000,
  MIN_Y: -2048,
  MAX_Y: 2047,
  MIN_Z: -30000000,
  MAX_Z: 30000000,
} as const

/**
 * WorldX座標Schema
 */
export const WorldXSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.between(WORLD_COORDINATE_LIMITS.MIN_X, WORLD_COORDINATE_LIMITS.MAX_X),
  Schema.brand('WorldX'),
  Schema.annotations({
    identifier: 'WorldX',
    title: 'World X Coordinate',
    description: 'X coordinate in world space (-30M to +30M)',
    examples: [0, 1000, -5000, 12345678],
  })
)

/**
 * WorldY座標Schema（高度制限あり）
 */
export const WorldYSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.between(WORLD_COORDINATE_LIMITS.MIN_Y, WORLD_COORDINATE_LIMITS.MAX_Y),
  Schema.brand('WorldY'),
  Schema.annotations({
    identifier: 'WorldY',
    title: 'World Y Coordinate (Height)',
    description: 'Y coordinate (height) in world space (-2048 to +2047)',
    examples: [0, 64, 128, 256, -64],
  })
)

/**
 * WorldZ座標Schema
 */
export const WorldZSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.between(WORLD_COORDINATE_LIMITS.MIN_Z, WORLD_COORDINATE_LIMITS.MAX_Z),
  Schema.brand('WorldZ'),
  Schema.annotations({
    identifier: 'WorldZ',
    title: 'World Z Coordinate',
    description: 'Z coordinate in world space (-30M to +30M)',
    examples: [0, 1000, -5000, 12345678],
  })
)

/**
 * WorldCoordinate Value Object
 */
export const WorldCoordinateSchema = Schema.Struct({
  x: WorldXSchema,
  y: WorldYSchema,
  z: WorldZSchema,
}).pipe(
  Schema.brand('WorldCoordinate'),
  Schema.annotations({
    identifier: 'WorldCoordinate',
    title: 'World 3D Coordinate',
    description: 'Immutable 3D coordinate in world space with overflow protection',
  })
)

export type WorldCoordinate = typeof WorldCoordinateSchema.Type

/**
 * 2D座標（平面投影用）
 */
export const WorldCoordinate2DSchema = Schema.Struct({
  x: WorldXSchema,
  z: WorldZSchema,
}).pipe(
  Schema.brand('WorldCoordinate2D'),
  Schema.annotations({
    identifier: 'WorldCoordinate2D',
    title: 'World 2D Coordinate',
    description: '2D coordinate in world space (X-Z plane)',
  })
)

export type WorldCoordinate2D = typeof WorldCoordinate2DSchema.Type

/**
 * 高速座標生成関数（バリデーションなし）
 *
 * 信頼できるソース（計算結果等）からの座標生成用
 * バリデーションコストを回避するため、unsafeCoerceを使用
 */
export const makeUnsafeWorldX = (value: number): WorldX => value as WorldX

export const makeUnsafeWorldY = (value: number): WorldY => value as WorldY

export const makeUnsafeWorldZ = (value: number): WorldZ => value as WorldZ

export const makeUnsafeWorldCoordinate = (x: number, y: number, z: number): WorldCoordinate =>
  ({
    x: makeUnsafeWorldX(x),
    y: makeUnsafeWorldY(y),
    z: makeUnsafeWorldZ(z),
  }) as WorldCoordinate

export const makeUnsafeWorldCoordinate2D = (x: number, z: number): WorldCoordinate2D =>
  ({
    x: makeUnsafeWorldX(x),
    z: makeUnsafeWorldZ(z),
  }) as WorldCoordinate2D

/**
 * 座標作成パラメータ
 */
export const CreateWorldCoordinateParamsSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})

export type CreateWorldCoordinateParams = typeof CreateWorldCoordinateParamsSchema.Type

/**
 * 座標エラー型
 */
export const WorldCoordinateErrorSchema = taggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('OutOfBounds'),
    axis: Schema.Literal('x', 'y', 'z'),
    value: Schema.Number,
    min: Schema.Number,
    max: Schema.Number,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('InvalidCoordinate'),
    coordinate: Schema.Unknown,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('OverflowError'),
    operation: Schema.String,
    values: Schema.Array(Schema.Number),
    message: Schema.String,
  }),
])

export type WorldCoordinateError = typeof WorldCoordinateErrorSchema.Type

/**
 * 方向列挙型
 */
export const DirectionSchema = Schema.Literal(
  'north',
  'south',
  'east',
  'west',
  'up',
  'down',
  'northeast',
  'northwest',
  'southeast',
  'southwest'
).pipe(
  Schema.annotations({
    title: 'Cardinal Direction',
    description: 'Primary and intermediate directions in 3D space',
  })
)

export type Direction = typeof DirectionSchema.Type

/**
 * 距離型
 */
export const DistanceSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.finite(),
  Schema.brand('Distance'),
  Schema.annotations({
    title: 'Euclidean Distance',
    description: 'Non-negative distance between two points',
  })
)

export type Distance = typeof DistanceSchema.Type

/**
 * 境界ボックス
 */
export const BoundingBoxSchema = Schema.Struct({
  min: WorldCoordinateSchema,
  max: WorldCoordinateSchema,
}).pipe(
  Schema.brand('BoundingBox'),
  Schema.annotations({
    identifier: 'BoundingBox',
    title: 'World Bounding Box',
    description: 'Axis-aligned bounding box in world coordinates',
  })
)

export type BoundingBox = typeof BoundingBoxSchema.Type

/**
 * 球体境界
 */
export const BoundingSphereSchema = Schema.Struct({
  center: WorldCoordinateSchema,
  radius: DistanceSchema,
}).pipe(
  Schema.brand('BoundingSphere'),
  Schema.annotations({
    identifier: 'BoundingSphere',
    title: 'World Bounding Sphere',
    description: 'Spherical bounding volume in world coordinates',
  })
)

export type BoundingSphere = typeof BoundingSphereSchema.Type
