/**
 * Coordinates Value Object - バレルエクスポート
 *
 * 3D座標系の完全な型安全実装
 * World/Chunk/Block座標系間の数学的に正確な変換保証
 */

// World座標系
export {
  BoundingBoxSchema,
  BoundingSphereSchema,
  CreateWorldCoordinateParamsSchema,
  DirectionSchema,
  DistanceSchema,
  WORLD_COORDINATE_LIMITS,
  WorldCoordinate2DSchema,
  WorldCoordinateErrorSchema,
  WorldCoordinateSchema,
  WorldXSchema,
  WorldYSchema,
  WorldZSchema,
  type BoundingBox,
  type BoundingSphere,
  type CreateWorldCoordinateParams,
  type Direction,
  type Distance,
  type WorldCoordinate,
  type WorldCoordinate2D,
  type WorldCoordinateError,
  type WorldX,
  type WorldY,
  type WorldZ,
} from './world_coordinate.js'

// Chunk座標系
export {
  CHUNK_CONSTANTS,
  CHUNK_COORDINATE_LIMITS,
  ChunkBoundsSchema,
  ChunkCoordinateErrorSchema,
  ChunkCoordinateSchema,
  ChunkRelativePositionSchema,
  ChunkSectionCoordinateSchema,
  ChunkSectionYSchema,
  ChunkXSchema,
  ChunkZSchema,
  CreateChunkCoordinateParamsSchema,
  LocalCoordinateSchema,
  LocalXSchema,
  LocalZSchema,
  type ChunkBounds,
  type ChunkCoordinate,
  type ChunkCoordinateError,
  type ChunkRelativePosition,
  type ChunkSectionCoordinate,
  type ChunkSectionY,
  type ChunkX,
  type ChunkZ,
  type CreateChunkCoordinateParams,
  type LocalCoordinate,
  type LocalX,
  type LocalZ,
} from './chunk_coordinate.js'

// Block座標系
export {
  BLOCK_COORDINATE_LIMITS,
  BlockCoordinate2DSchema,
  BlockCoordinateErrorSchema,
  BlockCoordinateSchema,
  BlockFaceSchema,
  BlockNeighborhoodSchema,
  BlockRangeSchema,
  BlockRelativePositionSchema,
  BlockXSchema,
  BlockYSchema,
  BlockZSchema,
  CreateBlockCoordinateParamsSchema,
  DetailedBlockPositionSchema,
  NeighborPatternSchema,
  type BlockCoordinate,
  type BlockCoordinate2D,
  type BlockCoordinateError,
  type BlockFace,
  type BlockNeighborhood,
  type BlockRange,
  type BlockRelativePosition,
  type BlockX,
  type BlockY,
  type BlockZ,
  type CreateBlockCoordinateParams,
  type DetailedBlockPosition,
  type NeighborPattern,
} from './block_coordinate.js'

// 座標変換
export {
  CoordinateTransformErrorSchema,
  CoordinateTransforms,
  type CoordinateTransformError,
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
  localToWorld: CoordinateTransforms.localToWorld,
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
    LOCAL: { x: 0, z: 0 },
  },
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
  validateBlock: CoordinateTransforms.validateBlockCoordinate,
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
  },
} as const
