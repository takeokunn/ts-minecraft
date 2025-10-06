/**
 * @fileoverview Coordinate System Types
 * 座標系に関する詳細な型定義とユーティリティ
 */

import { Brand, Schema } from 'effect'
import { WORLD_CONSTANTS } from '../constants'

// === 基本座標型の詳細定義 ===

/** ブロック座標 - 個別ブロック単位での座標 */
export type BlockCoordinate = number & Brand.Brand<'BlockCoordinate'>

export const BlockCoordinateSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(-30_000_000, 30_000_000),
  Schema.brand('BlockCoordinate'),
  Schema.annotations({
    title: 'Block Coordinate',
    description: 'Coordinate at block-level precision',
  })
)

/** ピクセル座標 - サブブロック精度での座標 */
export type PixelCoordinate = number & Brand.Brand<'PixelCoordinate'>

export const PixelCoordinateSchema = Schema.Number.pipe(
  Schema.between(-30_000_000.0, 30_000_000.0),
  Schema.brand('PixelCoordinate'),
  Schema.annotations({
    title: 'Pixel Coordinate',
    description: 'High-precision coordinate with decimal places',
  })
)

/** リージョン座標 - リージョンファイル単位での座標 */
export type RegionCoordinate = number & Brand.Brand<'RegionCoordinate'>

export const RegionCoordinateSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(-1_875_000, 1_875_000),
  Schema.brand('RegionCoordinate'),
  Schema.annotations({
    title: 'Region Coordinate',
    description: 'Coordinate in region file units (32x32 chunks)',
  })
)

// === 複合座標型 ===

/** ブロック位置 - 整数精度の3D位置 */
export interface BlockPosition {
  readonly x: BlockCoordinate
  readonly y: BlockCoordinate
  readonly z: BlockCoordinate
}

export const BlockPositionSchema = Schema.Struct({
  x: BlockCoordinateSchema,
  y: BlockCoordinateSchema,
  z: BlockCoordinateSchema,
}).pipe(
  Schema.annotations({
    title: 'Block Position',
    description: 'Integer-precision 3D position in block coordinates',
  })
)

/** ピクセル位置 - 高精度の3D位置 */
export interface PixelPosition {
  readonly x: PixelCoordinate
  readonly y: PixelCoordinate
  readonly z: PixelCoordinate
}

export const PixelPositionSchema = Schema.Struct({
  x: PixelCoordinateSchema,
  y: PixelCoordinateSchema,
  z: PixelCoordinateSchema,
}).pipe(
  Schema.annotations({
    title: 'Pixel Position',
    description: 'High-precision 3D position with decimal coordinates',
  })
)

/** リージョン位置 */
export interface RegionPosition {
  readonly x: RegionCoordinate
  readonly z: RegionCoordinate
}

export const RegionPositionSchema = Schema.Struct({
  x: RegionCoordinateSchema,
  z: RegionCoordinateSchema,
}).pipe(
  Schema.annotations({
    title: 'Region Position',
    description: 'Position of a region file (32x32 chunks)',
  })
)

// === 相対座標型 ===

/** 相対座標 - 基準点からの相対位置 */
export interface RelativePosition {
  readonly dx: number
  readonly dy: number
  readonly dz: number
  readonly reference: BlockPosition
}

export const RelativePositionSchema = Schema.Struct({
  dx: Schema.Number,
  dy: Schema.Number,
  dz: Schema.Number,
  reference: BlockPositionSchema,
}).pipe(
  Schema.annotations({
    title: 'Relative Position',
    description: 'Position relative to a reference point',
  })
)

/** チャンク内座標 - チャンク内でのローカル座標 (0-15) */
export type ChunkLocalCoordinate = number & Brand.Brand<'ChunkLocalCoordinate'>

export const ChunkLocalCoordinateSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 15),
  Schema.brand('ChunkLocalCoordinate'),
  Schema.annotations({
    title: 'Chunk Local Coordinate',
    description: 'Local coordinate within a chunk (0-15)',
  })
)

/** チャンク内位置 */
export interface ChunkLocalPosition {
  readonly x: ChunkLocalCoordinate
  readonly y: BlockCoordinate
  readonly z: ChunkLocalCoordinate
}

export const ChunkLocalPositionSchema = Schema.Struct({
  x: ChunkLocalCoordinateSchema,
  y: BlockCoordinateSchema,
  z: ChunkLocalCoordinateSchema,
}).pipe(
  Schema.annotations({
    title: 'Chunk Local Position',
    description: 'Local position within a chunk',
  })
)

// === 境界ボックス型 ===

/** 整数境界ボックス */
export interface IntBoundingBox {
  readonly minX: BlockCoordinate
  readonly minY: BlockCoordinate
  readonly minZ: BlockCoordinate
  readonly maxX: BlockCoordinate
  readonly maxY: BlockCoordinate
  readonly maxZ: BlockCoordinate
}

export const IntBoundingBoxSchema = Schema.Struct({
  minX: BlockCoordinateSchema,
  minY: BlockCoordinateSchema,
  minZ: BlockCoordinateSchema,
  maxX: BlockCoordinateSchema,
  maxY: BlockCoordinateSchema,
  maxZ: BlockCoordinateSchema,
}).pipe(
  Schema.annotations({
    title: 'Integer Bounding Box',
    description: 'Axis-aligned bounding box with integer coordinates',
  })
)

/** 浮動小数点境界ボックス */
export interface FloatBoundingBox {
  readonly minX: PixelCoordinate
  readonly minY: PixelCoordinate
  readonly minZ: PixelCoordinate
  readonly maxX: PixelCoordinate
  readonly maxY: PixelCoordinate
  readonly maxZ: PixelCoordinate
}

export const FloatBoundingBoxSchema = Schema.Struct({
  minX: PixelCoordinateSchema,
  minY: PixelCoordinateSchema,
  minZ: PixelCoordinateSchema,
  maxX: PixelCoordinateSchema,
  maxY: PixelCoordinateSchema,
  maxZ: PixelCoordinateSchema,
}).pipe(
  Schema.annotations({
    title: 'Float Bounding Box',
    description: 'Axis-aligned bounding box with floating-point coordinates',
  })
)

// === エリア型 ===

/** 2D矩形エリア */
export interface RectangularArea {
  readonly minX: BlockCoordinate
  readonly minZ: BlockCoordinate
  readonly maxX: BlockCoordinate
  readonly maxZ: BlockCoordinate
}

export const RectangularAreaSchema = Schema.Struct({
  minX: BlockCoordinateSchema,
  minZ: BlockCoordinateSchema,
  maxX: BlockCoordinateSchema,
  maxZ: BlockCoordinateSchema,
}).pipe(
  Schema.annotations({
    title: 'Rectangular Area',
    description: '2D rectangular area defined by corner coordinates',
  })
)

/** 円形エリア */
export interface CircularArea {
  readonly centerX: PixelCoordinate
  readonly centerZ: PixelCoordinate
  readonly radius: number
}

export const CircularAreaSchema = Schema.Struct({
  centerX: PixelCoordinateSchema,
  centerZ: PixelCoordinateSchema,
  radius: Schema.Number.pipe(Schema.positive()),
}).pipe(
  Schema.annotations({
    title: 'Circular Area',
    description: 'Circular area defined by center point and radius',
  })
)

// === 方向と回転型 ===

/** 基本方向 */
export type Direction = 'north' | 'south' | 'east' | 'west' | 'up' | 'down'

export const DirectionSchema = Schema.Literal('north', 'south', 'east', 'west', 'up', 'down').pipe(
  Schema.annotations({
    title: 'Direction',
    description: 'Cardinal direction or vertical direction',
  })
)

/** 水平方向 */
export type HorizontalDirection = 'north' | 'south' | 'east' | 'west'

export const HorizontalDirectionSchema = Schema.Literal('north', 'south', 'east', 'west').pipe(
  Schema.annotations({
    title: 'Horizontal Direction',
    description: 'Cardinal horizontal direction',
  })
)

/** 回転角度 - 度数法 */
export type RotationDegrees = number & Brand.Brand<'RotationDegrees'>

export const RotationDegreesSchema = Schema.Number.pipe(
  Schema.between(0, 360),
  Schema.brand('RotationDegrees'),
  Schema.annotations({
    title: 'Rotation Degrees',
    description: 'Rotation angle in degrees (0-360)',
  })
)

/** 回転角度 - ラジアン */
export type RotationRadians = number & Brand.Brand<'RotationRadians'>

export const RotationRadiansSchema = Schema.Number.pipe(
  Schema.between(0, 2 * Math.PI),
  Schema.brand('RotationRadians'),
  Schema.annotations({
    title: 'Rotation Radians',
    description: 'Rotation angle in radians (0-2π)',
  })
)

/** 3D回転 */
export interface Rotation3D {
  readonly yaw: RotationDegrees // Y軸回転（水平）
  readonly pitch: RotationDegrees // X軸回転（上下）
  readonly roll: RotationDegrees // Z軸回転（傾き）
}

export const Rotation3DSchema = Schema.Struct({
  yaw: RotationDegreesSchema,
  pitch: RotationDegreesSchema,
  roll: RotationDegreesSchema,
}).pipe(
  Schema.annotations({
    title: '3D Rotation',
    description: 'Three-dimensional rotation with yaw, pitch, and roll',
  })
)

// === 変換関数型 ===

/** 座標変換関数の型定義 */
export interface CoordinateTransforms {
  // ブロック ⟷ チャンク変換
  readonly blockToChunk: (coord: BlockCoordinate) => import('./index').ChunkCoordinate
  readonly chunkToBlock: (coord: import('./index').ChunkCoordinate) => BlockCoordinate

  // ブロック ⟷ ピクセル変換
  readonly blockToPixel: (coord: BlockCoordinate) => PixelCoordinate
  readonly pixelToBlock: (coord: PixelCoordinate) => BlockCoordinate

  // チャンク ⟷ リージョン変換
  readonly chunkToRegion: (coord: import('./index').ChunkCoordinate) => RegionCoordinate
  readonly regionToChunk: (coord: RegionCoordinate) => import('./index').ChunkCoordinate

  // ローカル ⟷ ワールド変換
  readonly localToWorld: (local: ChunkLocalPosition, chunkPos: import('./index').ChunkPosition) => BlockPosition
  readonly worldToLocal: (world: BlockPosition) => {
    local: ChunkLocalPosition
    chunkPos: import('./index').ChunkPosition
  }

  // 角度変換
  readonly degreesToRadians: (degrees: RotationDegrees) => RotationRadians
  readonly radiansToDegrees: (radians: RotationRadians) => RotationDegrees
}

// === 距離と測定型 ===

/** 距離値 */
export type Distance = number & Brand.Brand<'Distance'>

export const DistanceSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('Distance'),
  Schema.annotations({
    title: 'Distance',
    description: 'Non-negative distance value',
  })
)

/** 距離測定結果 */
export interface DistanceMeasurement {
  readonly distance: Distance
  readonly from: PixelPosition
  readonly to: PixelPosition
  readonly measurementType: 'euclidean' | 'manhattan' | 'chebyshev'
}

export const DistanceMeasurementSchema = Schema.Struct({
  distance: DistanceSchema,
  from: PixelPositionSchema,
  to: PixelPositionSchema,
  measurementType: Schema.Literal('euclidean', 'manhattan', 'chebyshev'),
}).pipe(
  Schema.annotations({
    title: 'Distance Measurement',
    description: 'Result of distance calculation between two points',
  })
)

// === 作成ヘルパー関数 ===

/** BlockPosition作成ヘルパー */
export const createBlockPosition = (x: number, y: number, z: number): BlockPosition =>
  Schema.decodeSync(BlockPositionSchema)({
    x: x as BlockCoordinate,
    y: y as BlockCoordinate,
    z: z as BlockCoordinate,
  })

/** PixelPosition作成ヘルパー */
export const createPixelPosition = (x: number, y: number, z: number): PixelPosition =>
  Schema.decodeSync(PixelPositionSchema)({
    x: x as PixelCoordinate,
    y: y as PixelCoordinate,
    z: z as PixelCoordinate,
  })

/** ChunkLocalPosition作成ヘルパー */
export const createChunkLocalPosition = (x: number, y: number, z: number): ChunkLocalPosition =>
  Schema.decodeSync(ChunkLocalPositionSchema)({
    x: x as ChunkLocalCoordinate,
    y: y as BlockCoordinate,
    z: z as ChunkLocalCoordinate,
  })

/** IntBoundingBox作成ヘルパー */
export const createIntBoundingBox = (
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number
): IntBoundingBox =>
  Schema.decodeSync(IntBoundingBoxSchema)({
    minX: minX as BlockCoordinate,
    minY: minY as BlockCoordinate,
    minZ: minZ as BlockCoordinate,
    maxX: maxX as BlockCoordinate,
    maxY: maxY as BlockCoordinate,
    maxZ: maxZ as BlockCoordinate,
  })

/** Rotation3D作成ヘルパー */
export const createRotation3D = (yaw: number, pitch: number, roll: number): Rotation3D =>
  Schema.decodeSync(Rotation3DSchema)({
    yaw: yaw as RotationDegrees,
    pitch: pitch as RotationDegrees,
    roll: roll as RotationDegrees,
  })

// === 座標変換ユーティリティ定数 ===

/** 座標変換定数 */
export const COORDINATE_CONSTANTS = {
  /** チャンクサイズ */
  CHUNK_SIZE: WORLD_CONSTANTS.CHUNK.X,
  /** リージョンサイズ（チャンク単位） */
  REGION_SIZE: 32,
  /** ブロック単位からピクセル単位への変換係数 */
  BLOCK_TO_PIXEL_SCALE: 1.0,
  /** 角度変換係数 */
  DEGREES_TO_RADIANS: Math.PI / 180,
  RADIANS_TO_DEGREES: 180 / Math.PI,
} as const
