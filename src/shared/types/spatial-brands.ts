import { Schema } from '@effect/schema'

/**
 * 空間関連Brand型定義
 * 3D空間での位置、回転、距離を型安全に表現
 */

/**
 * Vector3D用のブランド型
 * 3次元ベクトルを表現
 */
export const Vector3DSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
}).pipe(
  Schema.brand('Vector3D'),
  Schema.annotations({
    title: 'Vector3D',
    description: '3D vector with x, y, z components',
  })
)
export type Vector3D = Schema.Schema.Type<typeof Vector3DSchema>

/**
 * Rotation3D用のブランド型
 * 3次元回転をオイラー角で表現（ラジアン）
 */
export const Rotation3DSchema = Schema.Struct({
  pitch: Schema.Number.pipe(Schema.between(-Math.PI, Math.PI)), // X軸回転
  yaw: Schema.Number.pipe(Schema.between(-Math.PI, Math.PI)),   // Y軸回転
  roll: Schema.Number.pipe(Schema.between(-Math.PI, Math.PI)),  // Z軸回転
}).pipe(
  Schema.brand('Rotation3D'),
  Schema.annotations({
    title: 'Rotation3D',
    description: '3D rotation using Euler angles in radians',
  })
)
export type Rotation3D = Schema.Schema.Type<typeof Rotation3DSchema>

/**
 * Distance用のブランド型
 * 3D空間での距離を表現
 */
export const DistanceSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.finite(),
  Schema.brand('Distance'),
  Schema.annotations({
    title: 'Distance',
    description: 'Distance in 3D space (positive value)',
  })
)
export type Distance = Schema.Schema.Type<typeof DistanceSchema>

/**
 * Angle用のブランド型
 * 角度をラジアンで表現
 */
export const AngleSchema = Schema.Number.pipe(
  Schema.between(-Math.PI * 2, Math.PI * 2), // -2π から 2π
  Schema.brand('Angle'),
  Schema.annotations({
    title: 'Angle',
    description: 'Angle in radians',
  })
)
export type Angle = Schema.Schema.Type<typeof AngleSchema>

/**
 * ChunkCoordinate用のブランド型
 * チャンク座標系での位置を表現
 */
export const ChunkCoordinateSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.brand('ChunkCoordinate'),
  Schema.annotations({
    title: 'ChunkCoordinate',
    description: 'Chunk coordinate (integer)',
  })
)
export type ChunkCoordinate = Schema.Schema.Type<typeof ChunkCoordinateSchema>

/**
 * BlockCoordinate用のブランド型
 * ブロック座標系での位置を表現
 */
export const BlockCoordinateSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.brand('BlockCoordinate'),
  Schema.annotations({
    title: 'BlockCoordinate',
    description: 'Block coordinate (integer)',
  })
)
export type BlockCoordinate = Schema.Schema.Type<typeof BlockCoordinateSchema>

/**
 * 空間関連Brand型の安全な作成ヘルパー
 */
export const SpatialBrands = {
  /**
   * 安全なVector3D作成
   */
  createVector3D: (x: number, y: number, z: number): Vector3D =>
    Schema.decodeSync(Vector3DSchema)({ x, y, z }),

  /**
   * Zero vector
   */
  zeroVector: (): Vector3D =>
    Schema.decodeSync(Vector3DSchema)({ x: 0, y: 0, z: 0 }),

  /**
   * Unit vectors
   */
  unitX: (): Vector3D =>
    Schema.decodeSync(Vector3DSchema)({ x: 1, y: 0, z: 0 }),

  unitY: (): Vector3D =>
    Schema.decodeSync(Vector3DSchema)({ x: 0, y: 1, z: 0 }),

  unitZ: (): Vector3D =>
    Schema.decodeSync(Vector3DSchema)({ x: 0, y: 0, z: 1 }),

  /**
   * 安全なRotation3D作成
   */
  createRotation3D: (pitch: number, yaw: number, roll: number): Rotation3D =>
    Schema.decodeSync(Rotation3DSchema)({ pitch, yaw, roll }),

  /**
   * Identity rotation
   */
  identityRotation: (): Rotation3D =>
    Schema.decodeSync(Rotation3DSchema)({ pitch: 0, yaw: 0, roll: 0 }),

  /**
   * 安全なDistance作成
   */
  createDistance: (value: number): Distance =>
    Schema.decodeSync(DistanceSchema)(value),

  /**
   * 安全なAngle作成
   */
  createAngle: (value: number): Angle =>
    Schema.decodeSync(AngleSchema)(value),

  /**
   * Angle from degrees
   */
  angleFromDegrees: (degrees: number): Angle =>
    Schema.decodeSync(AngleSchema)((degrees * Math.PI) / 180),

  /**
   * 安全なChunkCoordinate作成
   */
  createChunkCoordinate: (value: number): ChunkCoordinate =>
    Schema.decodeSync(ChunkCoordinateSchema)(value),

  /**
   * 安全なBlockCoordinate作成
   */
  createBlockCoordinate: (value: number): BlockCoordinate =>
    Schema.decodeSync(BlockCoordinateSchema)(value),

  /**
   * Convert world coordinate to chunk coordinate
   */
  worldToChunk: (worldCoord: number): ChunkCoordinate =>
    Schema.decodeSync(ChunkCoordinateSchema)(Math.floor(worldCoord / 16)),

  /**
   * Convert chunk coordinate to world coordinate
   */
  chunkToWorld: (chunkCoord: ChunkCoordinate): BlockCoordinate =>
    Schema.decodeSync(BlockCoordinateSchema)(chunkCoord * 16),
} as const