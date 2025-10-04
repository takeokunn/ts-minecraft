import { Brand, Schema } from 'effect'
import { BoundingBox, CameraDistance, Direction3D, LerpFactor, Position3D, Velocity3D, ViewOffset } from './types'

/**
 * Position3D Brand型用Schema
 */
export const Position3DSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
}).pipe(Schema.fromBrand(Brand.nominal<Position3D>()))

/**
 * CameraDistance Brand型用Schema
 */
export const CameraDistanceSchema = Schema.Number.pipe(
  Schema.between(1, 50),
  Schema.fromBrand(Brand.nominal<CameraDistance>())
)

/**
 * ViewOffset Brand型用Schema
 */
export const ViewOffsetSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.between(-10, 10)),
  y: Schema.Number.pipe(Schema.between(-10, 10)),
  z: Schema.Number.pipe(Schema.between(-10, 10)),
}).pipe(Schema.fromBrand(Brand.nominal<ViewOffset>()))

/**
 * LerpFactor Brand型用Schema
 */
export const LerpFactorSchema = Schema.Number.pipe(Schema.between(0, 1), Schema.fromBrand(Brand.nominal<LerpFactor>()))

/**
 * Velocity3D Brand型用Schema
 */
export const Velocity3DSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
}).pipe(Schema.fromBrand(Brand.nominal<Velocity3D>()))

/**
 * Direction3D Brand型用Schema（正規化チェック付き）
 */
export const Direction3DSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.between(-1, 1)),
  y: Schema.Number.pipe(Schema.between(-1, 1)),
  z: Schema.Number.pipe(Schema.between(-1, 1)),
}).pipe(
  Schema.filter(
    (vec) => {
      const magnitude = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z)
      return Math.abs(magnitude - 1) < 0.0001 // 浮動小数点誤差を考慮
    },
    {
      message: () => 'Direction vector must be normalized (magnitude = 1)',
    }
  ),
  Schema.fromBrand(Brand.nominal<Direction3D>())
)

/**
 * BoundingBox Brand型用Schema
 */
export const BoundingBoxSchema = Schema.Struct({
  min: Position3DSchema,
  max: Position3DSchema,
}).pipe(
  Schema.filter(
    (bbox) => {
      return bbox.min.x <= bbox.max.x && bbox.min.y <= bbox.max.y && bbox.min.z <= bbox.max.z
    },
    {
      message: () => 'BoundingBox min values must be less than or equal to max values',
    }
  ),
  Schema.fromBrand(Brand.nominal<BoundingBox>())
)

/**
 * 座標制約用のSchema
 */
export const CoordinateSchemas = {
  finite: Schema.Number.pipe(Schema.finite()),
  worldBounds: Schema.Number.pipe(Schema.between(-30000000, 30000000)), // Minecraftの世界境界
  heightBounds: Schema.Number.pipe(Schema.between(-64, 320)), // Minecraftの高度制限
  chunkCoordinate: Schema.Number.pipe(Schema.int()),
  blockCoordinate: Schema.Number.pipe(Schema.int()),
} as const
