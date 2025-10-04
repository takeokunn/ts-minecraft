/**
 * ChunkCoordinate Value Object - チャンク座標系
 *
 * ワールドをチャンク単位で分割管理するための座標系
 * チャンク境界の正確な計算と変換を保証
 */

import type { Brand as BrandType } from 'effect'
import { Schema } from 'effect'
import { taggedUnion } from '../../utils/schema'

/**
 * チャンク座標系のBrand型
 */
export type ChunkX = number & BrandType.Brand<'ChunkX'>
export type ChunkZ = number & BrandType.Brand<'ChunkZ'>

/**
 * チャンク定数（Minecraft準拠）
 */
export const CHUNK_CONSTANTS = {
  SIZE: 16, // チャンクサイズ（16x16ブロック）
  HEIGHT: 384, // チャンク高さ（-64 to 319）
  MIN_Y: -64,
  MAX_Y: 319,
  SECTION_HEIGHT: 16, // セクション高さ
  SECTIONS_PER_CHUNK: 24, // 総セクション数
} as const

/**
 * チャンク座標制限値
 */
export const CHUNK_COORDINATE_LIMITS = {
  MIN_X: -1875000, // -30M / 16
  MAX_X: 1875000, // +30M / 16
  MIN_Z: -1875000,
  MAX_Z: 1875000,
} as const

/**
 * ChunkX座標Schema
 */
export const ChunkXSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.between(CHUNK_COORDINATE_LIMITS.MIN_X, CHUNK_COORDINATE_LIMITS.MAX_X),
  Schema.brand('ChunkX'),
  Schema.annotations({
    identifier: 'ChunkX',
    title: 'Chunk X Coordinate',
    description: 'X coordinate in chunk space',
    examples: [0, 10, -5, 1000],
  })
)

/**
 * ChunkZ座標Schema
 */
export const ChunkZSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.between(CHUNK_COORDINATE_LIMITS.MIN_Z, CHUNK_COORDINATE_LIMITS.MAX_Z),
  Schema.brand('ChunkZ'),
  Schema.annotations({
    identifier: 'ChunkZ',
    title: 'Chunk Z Coordinate',
    description: 'Z coordinate in chunk space',
    examples: [0, 10, -5, 1000],
  })
)

/**
 * ChunkCoordinate Value Object
 */
export const ChunkCoordinateSchema = Schema.Struct({
  x: ChunkXSchema,
  z: ChunkZSchema,
}).pipe(
  Schema.annotations({
    identifier: 'ChunkCoordinate',
    title: 'Chunk 2D Coordinate',
    description: 'Immutable 2D coordinate identifying a chunk',
  })
)

export type ChunkCoordinate = typeof ChunkCoordinateSchema.Type

/**
 * チャンク内ローカル座標（0-15の範囲）
 */
export const LocalXSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 15),
  Schema.brand('LocalX'),
  Schema.annotations({
    title: 'Local X Coordinate',
    description: 'X coordinate within a chunk (0-15)',
  })
)

export const LocalZSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 15),
  Schema.brand('LocalZ'),
  Schema.annotations({
    title: 'Local Z Coordinate',
    description: 'Z coordinate within a chunk (0-15)',
  })
)

export type LocalX = typeof LocalXSchema.Type
export type LocalZ = typeof LocalZSchema.Type

/**
 * チャンク内ローカル座標
 */
export const LocalCoordinateSchema = Schema.Struct({
  x: LocalXSchema,
  z: LocalZSchema,
}).pipe(
  Schema.annotations({
    identifier: 'LocalCoordinate',
    title: 'Chunk Local Coordinate',
    description: 'Local coordinate within a chunk (0-15, 0-15)',
  })
)

export type LocalCoordinate = typeof LocalCoordinateSchema.Type

/**
 * チャンクセクション座標（Y軸分割）
 */
export const ChunkSectionYSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(-4, 19), // -64 to 319 を16で割った範囲
  Schema.brand('ChunkSectionY'),
  Schema.annotations({
    title: 'Chunk Section Y',
    description: 'Y coordinate of chunk section (-4 to 19)',
  })
)

export type ChunkSectionY = typeof ChunkSectionYSchema.Type

/**
 * チャンクセクション座標
 */
export const ChunkSectionCoordinateSchema = Schema.Struct({
  x: ChunkXSchema,
  y: ChunkSectionYSchema,
  z: ChunkZSchema,
}).pipe(
  Schema.annotations({
    identifier: 'ChunkSectionCoordinate',
    title: 'Chunk Section 3D Coordinate',
    description: '3D coordinate identifying a chunk section',
  })
)

export type ChunkSectionCoordinate = typeof ChunkSectionCoordinateSchema.Type

/**
 * チャンク作成パラメータ
 */
export const CreateChunkCoordinateParamsSchema = Schema.Struct({
  x: Schema.Number,
  z: Schema.Number,
})

export type CreateChunkCoordinateParams = typeof CreateChunkCoordinateParamsSchema.Type

/**
 * チャンク座標エラー型
 */
export const ChunkCoordinateErrorSchema = taggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('ChunkOutOfBounds'),
    axis: Schema.Literal('x', 'z'),
    value: Schema.Number,
    min: Schema.Number,
    max: Schema.Number,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('InvalidChunkCoordinate'),
    coordinate: Schema.Unknown,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('SectionOutOfBounds'),
    sectionY: Schema.Number,
    message: Schema.String,
  }),
])

export type ChunkCoordinateError = typeof ChunkCoordinateErrorSchema.Type

/**
 * チャンク境界情報
 */
export const ChunkBoundsSchema = Schema.Struct({
  chunk: ChunkCoordinateSchema,
  worldMin: Schema.Struct({
    x: Schema.Number,
    z: Schema.Number,
  }),
  worldMax: Schema.Struct({
    x: Schema.Number,
    z: Schema.Number,
  }),
}).pipe(
  Schema.annotations({
    identifier: 'ChunkBounds',
    title: 'Chunk Boundary Information',
    description: 'Defines the world coordinate boundaries of a chunk',
  })
)

export type ChunkBounds = typeof ChunkBoundsSchema.Type

/**
 * チャンク相対位置
 */
export const ChunkRelativePositionSchema = Schema.Literal(
  'center',
  'north',
  'south',
  'east',
  'west',
  'northeast',
  'northwest',
  'southeast',
  'southwest',
  'corner_nw',
  'corner_ne',
  'corner_sw',
  'corner_se'
).pipe(
  Schema.annotations({
    title: 'Chunk Relative Position',
    description: 'Relative position within or around a chunk',
  })
)

export type ChunkRelativePosition = typeof ChunkRelativePositionSchema.Type
