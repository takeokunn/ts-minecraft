/**
 * BlockCoordinate Value Object - ブロック座標系
 *
 * 個別ブロックの正確な位置を表現する最小単位の座標系
 * ワールド座標との完全な変換保証とブロック境界の厳密な管理
 */

import { taggedUnion } from '@domain/world/utils'
import type { Brand as BrandType } from 'effect'
import { Schema } from 'effect'

/**
 * ブロック座標系のBrand型
 */
export type BlockX = number & BrandType.Brand<'BlockX'>
export type BlockY = number & BrandType.Brand<'BlockY'>
export type BlockZ = number & BrandType.Brand<'BlockZ'>

/**
 * ブロック座標制限値（Minecraft準拠）
 */
export const BLOCK_COORDINATE_LIMITS = {
  MIN_X: -30000000,
  MAX_X: 29999999, // 包括的上限
  MIN_Y: -2048,
  MAX_Y: 2047,
  MIN_Z: -30000000,
  MAX_Z: 29999999,
} as const

/**
 * BlockX座標Schema
 */
export const BlockXSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.between(BLOCK_COORDINATE_LIMITS.MIN_X, BLOCK_COORDINATE_LIMITS.MAX_X),
  Schema.brand('BlockX'),
  Schema.annotations({
    identifier: 'BlockX',
    title: 'Block X Coordinate',
    description: 'X coordinate of individual block in world',
    examples: [0, 100, -50, 12345],
  })
)

/**
 * BlockY座標Schema
 */
export const BlockYSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.between(BLOCK_COORDINATE_LIMITS.MIN_Y, BLOCK_COORDINATE_LIMITS.MAX_Y),
  Schema.brand('BlockY'),
  Schema.annotations({
    identifier: 'BlockY',
    title: 'Block Y Coordinate',
    description: 'Y coordinate (height) of individual block',
    examples: [0, 64, 128, 256, -64],
  })
)

/**
 * BlockZ座標Schema
 */
export const BlockZSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.between(BLOCK_COORDINATE_LIMITS.MIN_Z, BLOCK_COORDINATE_LIMITS.MAX_Z),
  Schema.brand('BlockZ'),
  Schema.annotations({
    identifier: 'BlockZ',
    title: 'Block Z Coordinate',
    description: 'Z coordinate of individual block in world',
    examples: [0, 100, -50, 12345],
  })
)

/**
 * BlockCoordinate Value Object
 */
export const BlockCoordinateSchema = Schema.Struct({
  x: BlockXSchema,
  y: BlockYSchema,
  z: BlockZSchema,
}).pipe(
  Schema.brand('BlockCoordinate'),
  Schema.annotations({
    identifier: 'BlockCoordinate',
    title: 'Block 3D Coordinate',
    description: 'Precise coordinate of individual block in world space',
  })
)

export type BlockCoordinate = typeof BlockCoordinateSchema.Type

/**
 * ブロック2D座標（平面用）
 */
export const BlockCoordinate2DSchema = Schema.Struct({
  x: BlockXSchema,
  z: BlockZSchema,
}).pipe(
  Schema.brand('BlockCoordinate2D'),
  Schema.annotations({
    identifier: 'BlockCoordinate2D',
    title: 'Block 2D Coordinate',
    description: '2D coordinate of block in X-Z plane',
  })
)

export type BlockCoordinate2D = typeof BlockCoordinate2DSchema.Type

/**
 * 高速座標生成関数（バリデーションなし）
 *
 * 信頼できるソース（計算結果等）からの座標生成用
 */
export const makeUnsafeBlockX = (value: number): BlockX => value as BlockX

export const makeUnsafeBlockY = (value: number): BlockY => value as BlockY

export const makeUnsafeBlockZ = (value: number): BlockZ => value as BlockZ

export const makeUnsafeBlockCoordinate = (x: number, y: number, z: number): BlockCoordinate =>
  ({
    x: makeUnsafeBlockX(x),
    y: makeUnsafeBlockY(y),
    z: makeUnsafeBlockZ(z),
  }) as BlockCoordinate

export const makeUnsafeBlockCoordinate2D = (x: number, z: number): BlockCoordinate2D =>
  ({
    x: makeUnsafeBlockX(x),
    z: makeUnsafeBlockZ(z),
  }) as BlockCoordinate2D

/**
 * ブロック面方向
 */
export const BlockFaceSchema = Schema.Literal('north', 'south', 'east', 'west', 'up', 'down').pipe(
  Schema.annotations({
    title: 'Block Face',
    description: 'The six faces of a cubic block',
  })
)

export type BlockFace = typeof BlockFaceSchema.Type

/**
 * ブロック内相対位置（0.0-1.0の範囲）
 */
export const BlockRelativePositionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.between(0, 1)),
  y: Schema.Number.pipe(Schema.between(0, 1)),
  z: Schema.Number.pipe(Schema.between(0, 1)),
}).pipe(
  Schema.brand('BlockRelativePosition'),
  Schema.annotations({
    identifier: 'BlockRelativePosition',
    title: 'Block Relative Position',
    description: 'Relative position within a block (0.0 to 1.0 for each axis)',
  })
)

export type BlockRelativePosition = typeof BlockRelativePositionSchema.Type

/**
 * 詳細ブロック位置（ブロック座標 + 相対位置）
 */
export const DetailedBlockPositionSchema = Schema.Struct({
  block: BlockCoordinateSchema,
  relative: BlockRelativePositionSchema,
}).pipe(
  Schema.brand('DetailedBlockPosition'),
  Schema.annotations({
    identifier: 'DetailedBlockPosition',
    title: 'Detailed Block Position',
    description: 'Precise position combining block coordinate and relative offset',
  })
)

export type DetailedBlockPosition = typeof DetailedBlockPositionSchema.Type

/**
 * ブロック範囲（矩形領域）
 */
export const BlockRangeSchema = Schema.Struct({
  min: BlockCoordinateSchema,
  max: BlockCoordinateSchema,
}).pipe(
  Schema.brand('BlockRange'),
  Schema.annotations({
    identifier: 'BlockRange',
    title: 'Block Range',
    description: 'Rectangular region defined by minimum and maximum block coordinates',
  })
)

export type BlockRange = typeof BlockRangeSchema.Type

/**
 * ブロック作成パラメータ
 */
export const CreateBlockCoordinateParamsSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})

export type CreateBlockCoordinateParams = typeof CreateBlockCoordinateParamsSchema.Type

/**
 * ブロック座標エラー型
 */
export const BlockCoordinateErrorSchema = taggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('BlockOutOfBounds'),
    axis: Schema.Literal('x', 'y', 'z'),
    value: Schema.Number,
    min: Schema.Number,
    max: Schema.Number,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('InvalidBlockCoordinate'),
    coordinate: Schema.Unknown,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('InvalidBlockRange'),
    range: Schema.Unknown,
    reason: Schema.String,
    message: Schema.String,
  }),
])

export type BlockCoordinateError = typeof BlockCoordinateErrorSchema.Type

/**
 * ブロック近傍パターン
 */
export const NeighborPatternSchema = Schema.Literal(
  'adjacent_6', // 6隣接（面を共有）
  'adjacent_18', // 18隣接（面・辺を共有）
  'adjacent_26', // 26隣接（面・辺・頂点を共有）
  'manhattan_1', // マンハッタン距離1
  'manhattan_2', // マンハッタン距離2
  'euclidean_1', // ユークリッド距離1
  'euclidean_2' // ユークリッド距離2
).pipe(
  Schema.annotations({
    title: 'Neighbor Pattern',
    description: 'Pattern for selecting neighboring blocks',
  })
)

export type NeighborPattern = typeof NeighborPatternSchema.Type

/**
 * ブロック近傍情報
 */
export const BlockNeighborhoodSchema = Schema.Struct({
  center: BlockCoordinateSchema,
  pattern: NeighborPatternSchema,
  neighbors: Schema.Array(BlockCoordinateSchema),
}).pipe(
  Schema.brand('BlockNeighborhood'),
  Schema.annotations({
    identifier: 'BlockNeighborhood',
    title: 'Block Neighborhood',
    description: 'Collection of neighboring blocks around a center block',
  })
)

export type BlockNeighborhood = typeof BlockNeighborhoodSchema.Type
