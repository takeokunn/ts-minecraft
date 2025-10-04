/**
 * Coordinates Value Object - バレルエクスポート
 *
 * 3D座標系の完全な型安全実装
 * World/Chunk/Block座標系間の数学的に正確な変換保証
 */

// World座標系
export {
  type WorldCoordinate,
  type WorldCoordinate2D,
  type WorldX,
  type WorldY,
  type WorldZ,
  type Direction,
  type Distance,
  type BoundingBox,
  type BoundingSphere,
  type WorldCoordinateError,
  WorldCoordinateSchema,
  WorldCoordinate2DSchema,
  WorldXSchema,
  WorldYSchema,
  WorldZSchema,
  DirectionSchema,
  DistanceSchema,
  BoundingBoxSchema,
  BoundingSphereSchema,
  WorldCoordinateErrorSchema,
  CreateWorldCoordinateParamsSchema,
  type CreateWorldCoordinateParams,
  WORLD_COORDINATE_LIMITS
} from './world_coordinate.js'

// Chunk座標系
export {
  type ChunkCoordinate,
  type ChunkX,
  type ChunkZ,
  type LocalCoordinate,
  type LocalX,
  type LocalZ,
  type ChunkSectionCoordinate,
  type ChunkSectionY,
  type ChunkBounds,
  type ChunkRelativePosition,
  type ChunkCoordinateError,
  ChunkCoordinateSchema,
  ChunkXSchema,
  ChunkZSchema,
  LocalCoordinateSchema,
  LocalXSchema,
  LocalZSchema,
  ChunkSectionCoordinateSchema,
  ChunkSectionYSchema,
  ChunkBoundsSchema,
  ChunkRelativePositionSchema,
  ChunkCoordinateErrorSchema,
  CreateChunkCoordinateParamsSchema,
  type CreateChunkCoordinateParams,
  CHUNK_CONSTANTS,
  CHUNK_COORDINATE_LIMITS
} from './chunk_coordinate.js'

// Block座標系
export {
  type BlockCoordinate,
  type BlockCoordinate2D,
  type BlockX,
  type BlockY,
  type BlockZ,
  type BlockFace,
  type BlockRelativePosition,
  type DetailedBlockPosition,
  type BlockRange,
  type NeighborPattern,
  type BlockNeighborhood,
  type BlockCoordinateError,
  BlockCoordinateSchema,
  BlockCoordinate2DSchema,
  BlockXSchema,
  BlockYSchema,
  BlockZSchema,
  BlockFaceSchema,
  BlockRelativePositionSchema,
  DetailedBlockPositionSchema,
  BlockRangeSchema,
  NeighborPatternSchema,
  BlockNeighborhoodSchema,
  BlockCoordinateErrorSchema,
  CreateBlockCoordinateParamsSchema,
  type CreateBlockCoordinateParams,
  BLOCK_COORDINATE_LIMITS
} from './block_coordinate.js'

// 座標変換
export {
  CoordinateTransforms,
  type CoordinateTransformError,
  CoordinateTransformErrorSchema
} from './coordinate_transforms.js'

/**
 * 便利なファクトリ関数群
 */
export const CoordinateFactory = {
  /**
   * World座標作成
   */
  createWorld: CoordinateTransforms.normalizeWorldCoordinate,

  /**
   * Chunk座標からWorld座標
   */
  chunkToWorld: CoordinateTransforms.chunkToWorld,

  /**
   * Block座標からWorld座標
   */
  blockToWorld: CoordinateTransforms.blockToWorld,

  /**
   * World座標からChunk座標
   */
  worldToChunk: CoordinateTransforms.worldToChunk,

  /**
   * World座標からBlock座標
   */
  worldToBlock: CoordinateTransforms.worldToBlock,

  /**
   * ローカル座標変換
   */
  worldToLocal: CoordinateTransforms.worldToLocal,
  localToWorld: CoordinateTransforms.localToWorld
} as const

/**
 * 座標定数
 */
export const CoordinateConstants = {
  /**
   * World座標制限
   */
  WORLD: WORLD_COORDINATE_LIMITS,

  /**
   * Chunk定数
   */
  CHUNK: CHUNK_CONSTANTS,

  /**
   * Chunk座標制限
   */
  CHUNK_LIMITS: CHUNK_COORDINATE_LIMITS,

  /**
   * Block座標制限
   */
  BLOCK: BLOCK_COORDINATE_LIMITS,

  /**
   * 原点座標
   */
  ORIGIN: {
    WORLD: { x: 0, y: 0, z: 0 },
    CHUNK: { x: 0, z: 0 },
    BLOCK: { x: 0, y: 0, z: 0 },
    LOCAL: { x: 0, z: 0 }
  }
} as const

/**
 * 座標検証関数群
 */
export const CoordinateValidation = {
  /**
   * World座標検証
   */
  validateWorld: CoordinateTransforms.validateWorldCoordinate,

  /**
   * Chunk座標検証
   */
  validateChunk: CoordinateTransforms.validateChunkCoordinate,

  /**
   * Block座標検証
   */
  validateBlock: CoordinateTransforms.validateBlockCoordinate
} as const

/**
 * 型ガード
 */
export const CoordinateTypeGuards = {
  /**
   * World座標の型ガード
   */
  isWorldCoordinate: (value: unknown): value is WorldCoordinate => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'x' in value &&
      'y' in value &&
      'z' in value &&
      typeof (value as any).x === 'number' &&
      typeof (value as any).y === 'number' &&
      typeof (value as any).z === 'number'
    )
  },

  /**
   * Chunk座標の型ガード
   */
  isChunkCoordinate: (value: unknown): value is ChunkCoordinate => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'x' in value &&
      'z' in value &&
      typeof (value as any).x === 'number' &&
      typeof (value as any).z === 'number' &&
      !('y' in value)
    )
  },

  /**
   * Block座標の型ガード
   */
  isBlockCoordinate: (value: unknown): value is BlockCoordinate => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'x' in value &&
      'y' in value &&
      'z' in value &&
      typeof (value as any).x === 'number' &&
      typeof (value as any).y === 'number' &&
      typeof (value as any).z === 'number'
    )
  }
} as const