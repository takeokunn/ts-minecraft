/**
 * Coordinate Transforms - 座標系間の変換操作
 *
 * World/Chunk/Block座標系間の数学的に正確な変換
 * オーバーフロー防止と境界値の厳密な管理
 */

import { Effect, Schema } from 'effect'
import { taggedUnion } from '@domain/world/utils'
import { BLOCK_COORDINATE_LIMITS, BlockCoordinate, BlockRange } from './index'
import {
  CHUNK_CONSTANTS,
  CHUNK_COORDINATE_LIMITS,
  ChunkBounds,
  ChunkCoordinate,
  LocalCoordinate,
  type ChunkSectionY,
} from './index'
import { WORLD_COORDINATE_LIMITS, WorldCoordinate, type WorldY } from './index'

/**
 * 変換エラー型
 */
export const CoordinateTransformErrorSchema = taggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('ConversionOverflow'),
    operation: Schema.String,
    input: Schema.Unknown,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('InvalidTransform'),
    from: Schema.String,
    to: Schema.String,
    reason: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('BoundaryViolation'),
    coordinate: Schema.Unknown,
    boundary: Schema.String,
    message: Schema.String,
  }),
])

export type CoordinateTransformError = typeof CoordinateTransformErrorSchema.Type

/**
 * 座標変換操作群
 */
export const CoordinateTransforms = {
  /**
   * ワールド座標からチャンク座標への変換
   */
  worldToChunk: (world: WorldCoordinate): Effect.Effect<ChunkCoordinate, CoordinateTransformError> =>
    Effect.gen(function* () {
      // 整数除算でチャンク座標を計算（負数対応）
      const chunkX = Math.floor(world.x / CHUNK_CONSTANTS.SIZE)
      const chunkZ = Math.floor(world.z / CHUNK_CONSTANTS.SIZE)

      // 範囲チェック
      if (chunkX < CHUNK_COORDINATE_LIMITS.MIN_X || chunkX > CHUNK_COORDINATE_LIMITS.MAX_X) {
        return yield* Effect.fail({
          _tag: 'BoundaryViolation' as const,
          coordinate: { x: chunkX, z: chunkZ },
          boundary: 'chunk_x',
          message: `Chunk X coordinate ${chunkX} is out of bounds`,
        })
      }

      if (chunkZ < CHUNK_COORDINATE_LIMITS.MIN_Z || chunkZ > CHUNK_COORDINATE_LIMITS.MAX_Z) {
        return yield* Effect.fail({
          _tag: 'BoundaryViolation' as const,
          coordinate: { x: chunkX, z: chunkZ },
          boundary: 'chunk_z',
          message: `Chunk Z coordinate ${chunkZ} is out of bounds`,
        })
      }

      return {
        x: Schema.decodeSync(Schema.Number.pipe(Schema.brand('ChunkX')))(chunkX),
        z: Schema.decodeSync(Schema.Number.pipe(Schema.brand('ChunkZ')))(chunkZ),
      }
    }),

  /**
   * ワールド座標からブロック座標への変換
   */
  worldToBlock: (world: WorldCoordinate): Effect.Effect<BlockCoordinate, CoordinateTransformError> =>
    Effect.gen(function* () {
      // 直接変換（床関数適用）
      const blockX = Math.floor(world.x)
      const blockY = Math.floor(world.y)
      const blockZ = Math.floor(world.z)

      return yield* Effect.try({
        try: () => ({
          x: Schema.decodeSync(Schema.Number.pipe(Schema.brand('BlockX')))(blockX),
          y: Schema.decodeSync(Schema.Number.pipe(Schema.brand('BlockY')))(blockY),
          z: Schema.decodeSync(Schema.Number.pipe(Schema.brand('BlockZ')))(blockZ),
        }),
        catch: (error) => ({
          _tag: 'ConversionOverflow' as const,
          operation: 'worldToBlock',
          input: world,
          message: `Failed to convert world to block coordinate: ${error}`,
        }),
      })
    }),

  /**
   * ブロック座標からワールド座標への変換
   */
  blockToWorld: (block: BlockCoordinate): Effect.Effect<WorldCoordinate, CoordinateTransformError> =>
    Effect.gen(function* () {
      return yield* Effect.try({
        try: () => ({
          x: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldX')))(block.x),
          y: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldY')))(block.y),
          z: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldZ')))(block.z),
        }),
        catch: (error) => ({
          _tag: 'ConversionOverflow' as const,
          operation: 'blockToWorld',
          input: block,
          message: `Failed to convert block to world coordinate: ${error}`,
        }),
      })
    }),

  /**
   * チャンク座標からワールド座標への変換（チャンク原点）
   */
  chunkToWorld: (chunk: ChunkCoordinate): Effect.Effect<WorldCoordinate, CoordinateTransformError> =>
    Effect.gen(function* () {
      const worldX = chunk.x * CHUNK_CONSTANTS.SIZE
      const worldZ = chunk.z * CHUNK_CONSTANTS.SIZE

      return yield* Effect.try({
        try: () => ({
          x: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldX')))(worldX),
          y: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldY')))(CHUNK_CONSTANTS.MIN_Y),
          z: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldZ')))(worldZ),
        }),
        catch: (error) => ({
          _tag: 'ConversionOverflow' as const,
          operation: 'chunkToWorld',
          input: chunk,
          message: `Failed to convert chunk to world coordinate: ${error}`,
        }),
      })
    }),

  /**
   * ワールド座標からチャンク内ローカル座標への変換
   */
  worldToLocal: (world: WorldCoordinate): Effect.Effect<LocalCoordinate, CoordinateTransformError> =>
    Effect.gen(function* () {
      // 正確な剰余計算（負数対応）
      const localX = ((world.x % CHUNK_CONSTANTS.SIZE) + CHUNK_CONSTANTS.SIZE) % CHUNK_CONSTANTS.SIZE
      const localZ = ((world.z % CHUNK_CONSTANTS.SIZE) + CHUNK_CONSTANTS.SIZE) % CHUNK_CONSTANTS.SIZE

      return yield* Effect.try({
        try: () => ({
          x: Schema.decodeSync(Schema.Number.pipe(Schema.brand('LocalX')))(localX),
          z: Schema.decodeSync(Schema.Number.pipe(Schema.brand('LocalZ')))(localZ),
        }),
        catch: (error) => ({
          _tag: 'ConversionOverflow' as const,
          operation: 'worldToLocal',
          input: world,
          message: `Failed to convert world to local coordinate: ${error}`,
        }),
      })
    }),

  /**
   * チャンク座標とローカル座標からワールド座標への変換
   */
  localToWorld: (
    chunk: ChunkCoordinate,
    local: LocalCoordinate,
    y: WorldY
  ): Effect.Effect<WorldCoordinate, CoordinateTransformError> =>
    Effect.gen(function* () {
      const worldX = chunk.x * CHUNK_CONSTANTS.SIZE + local.x
      const worldZ = chunk.z * CHUNK_CONSTANTS.SIZE + local.z

      return yield* Effect.try({
        try: () => ({
          x: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldX')))(worldX),
          y,
          z: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldZ')))(worldZ),
        }),
        catch: (error) => ({
          _tag: 'ConversionOverflow' as const,
          operation: 'localToWorld',
          input: { chunk, local, y },
          message: `Failed to convert local to world coordinate: ${error}`,
        }),
      })
    }),

  /**
   * Y座標からチャンクセクション座標への変換
   */
  yToChunkSection: (y: WorldY): Effect.Effect<ChunkSectionY, CoordinateTransformError> =>
    Effect.gen(function* () {
      const sectionY = Math.floor((y - CHUNK_CONSTANTS.MIN_Y) / CHUNK_CONSTANTS.SECTION_HEIGHT) - 4

      return yield* Effect.try({
        try: () => Schema.decodeSync(Schema.Number.pipe(Schema.brand('ChunkSectionY')))(sectionY),
        catch: (error) => ({
          _tag: 'ConversionOverflow' as const,
          operation: 'yToChunkSection',
          input: y,
          message: `Failed to convert Y to chunk section: ${error}`,
        }),
      })
    }),

  /**
   * チャンクセクション座標からY座標範囲への変換
   */
  chunkSectionToYRange: (
    sectionY: ChunkSectionY
  ): Effect.Effect<{ min: WorldY; max: WorldY }, CoordinateTransformError> =>
    Effect.gen(function* () {
      const minY = (sectionY + 4) * CHUNK_CONSTANTS.SECTION_HEIGHT + CHUNK_CONSTANTS.MIN_Y
      const maxY = minY + CHUNK_CONSTANTS.SECTION_HEIGHT - 1

      return yield* Effect.try({
        try: () => ({
          min: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldY')))(minY),
          max: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldY')))(maxY),
        }),
        catch: (error) => ({
          _tag: 'ConversionOverflow' as const,
          operation: 'chunkSectionToYRange',
          input: sectionY,
          message: `Failed to convert chunk section to Y range: ${error}`,
        }),
      })
    }),

  /**
   * チャンク境界の計算
   */
  getChunkBounds: (chunk: ChunkCoordinate): Effect.Effect<ChunkBounds, CoordinateTransformError> =>
    Effect.gen(function* () {
      const worldMin = {
        x: chunk.x * CHUNK_CONSTANTS.SIZE,
        z: chunk.z * CHUNK_CONSTANTS.SIZE,
      }

      const worldMax = {
        x: worldMin.x + CHUNK_CONSTANTS.SIZE - 1,
        z: worldMin.z + CHUNK_CONSTANTS.SIZE - 1,
      }

      return {
        chunk,
        worldMin,
        worldMax,
      }
    }),

  /**
   * ブロック範囲からチャンク範囲への変換
   */
  blockRangeToChunkRange: (
    range: BlockRange
  ): Effect.Effect<{ min: ChunkCoordinate; max: ChunkCoordinate }, CoordinateTransformError> =>
    Effect.gen(function* () {
      const minChunk = yield* CoordinateTransforms.worldToChunk({
        x: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldX')))(range.min.x),
        y: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldY')))(range.min.y),
        z: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldZ')))(range.min.z),
      })

      const maxChunk = yield* CoordinateTransforms.worldToChunk({
        x: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldX')))(range.max.x),
        y: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldY')))(range.max.y),
        z: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldZ')))(range.max.z),
      })

      return {
        min: minChunk,
        max: maxChunk,
      }
    }),

  /**
   * 座標の正規化（範囲内への調整）
   */
  normalizeWorldCoordinate: (
    x: number,
    y: number,
    z: number
  ): Effect.Effect<WorldCoordinate, CoordinateTransformError> =>
    Effect.gen(function* () {
      const clampedX = Math.max(WORLD_COORDINATE_LIMITS.MIN_X, Math.min(WORLD_COORDINATE_LIMITS.MAX_X, Math.floor(x)))
      const clampedY = Math.max(WORLD_COORDINATE_LIMITS.MIN_Y, Math.min(WORLD_COORDINATE_LIMITS.MAX_Y, Math.floor(y)))
      const clampedZ = Math.max(WORLD_COORDINATE_LIMITS.MIN_Z, Math.min(WORLD_COORDINATE_LIMITS.MAX_Z, Math.floor(z)))

      return yield* Effect.try({
        try: () => ({
          x: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldX')))(clampedX),
          y: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldY')))(clampedY),
          z: Schema.decodeSync(Schema.Number.pipe(Schema.brand('WorldZ')))(clampedZ),
        }),
        catch: (error) => ({
          _tag: 'ConversionOverflow' as const,
          operation: 'normalizeWorldCoordinate',
          input: { x, y, z },
          message: `Failed to normalize world coordinate: ${error}`,
        }),
      })
    }),

  /**
   * 座標の有効性チェック
   */
  validateWorldCoordinate: (coord: WorldCoordinate): Effect.Effect<boolean, never> =>
    Effect.succeed(
      coord.x >= WORLD_COORDINATE_LIMITS.MIN_X &&
        coord.x <= WORLD_COORDINATE_LIMITS.MAX_X &&
        coord.y >= WORLD_COORDINATE_LIMITS.MIN_Y &&
        coord.y <= WORLD_COORDINATE_LIMITS.MAX_Y &&
        coord.z >= WORLD_COORDINATE_LIMITS.MIN_Z &&
        coord.z <= WORLD_COORDINATE_LIMITS.MAX_Z
    ),

  /**
   * チャンク座標の有効性チェック
   */
  validateChunkCoordinate: (coord: ChunkCoordinate): Effect.Effect<boolean, never> =>
    Effect.succeed(
      coord.x >= CHUNK_COORDINATE_LIMITS.MIN_X &&
        coord.x <= CHUNK_COORDINATE_LIMITS.MAX_X &&
        coord.z >= CHUNK_COORDINATE_LIMITS.MIN_Z &&
        coord.z <= CHUNK_COORDINATE_LIMITS.MAX_Z
    ),

  /**
   * ブロック座標の有効性チェック
   */
  validateBlockCoordinate: (coord: BlockCoordinate): Effect.Effect<boolean, never> =>
    Effect.succeed(
      coord.x >= BLOCK_COORDINATE_LIMITS.MIN_X &&
        coord.x <= BLOCK_COORDINATE_LIMITS.MAX_X &&
        coord.y >= BLOCK_COORDINATE_LIMITS.MIN_Y &&
        coord.y <= BLOCK_COORDINATE_LIMITS.MAX_Y &&
        coord.z >= BLOCK_COORDINATE_LIMITS.MIN_Z &&
        coord.z <= BLOCK_COORDINATE_LIMITS.MAX_Z
    ),
}
