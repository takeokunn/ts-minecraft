import { Clock, Effect, Layer, Schema } from 'effect'
import type {
  BlockData,
  ChunkAggregate,
  ChunkBoundsError,
  ChunkData,
  ChunkDataProvider,
  ChunkDataValidationError,
  ChunkId,
  ChunkIdError,
  ChunkPosition,
  ChunkPositionError,
  WorldCoordinate,
} from '../types'
import { BiomeTypeSchema, LightLevelSchema, TimestampSchema } from '../value_object/chunk_metadata/types'

/**
 * Chunk Data Provider Live Implementation
 *
 * ChunkDataProviderインターフェースの実装。
 * Pure chunk機能のみを提供するApplication Serviceレイヤー。
 */
export class ChunkDataProviderLive implements ChunkDataProvider {
  /**
   * 指定されたIDのチャンクを取得
   */
  readonly getChunk = (id: ChunkId): Effect.Effect<ChunkAggregate, ChunkIdError> =>
    Effect.gen(function* () {
      // TODO: 実際のチャンクストレージからの取得ロジック
      // 現在はモックとして実装
      yield* Effect.logInfo(`Getting chunk with ID: ${id}`)

      // チャンクIDの検証
      yield* Effect.when(!id || typeof id !== 'string', () =>
        Effect.fail({
          _tag: 'ChunkIdError' as const,
          chunkId: id,
          reason: 'Invalid chunk ID format',
          operation: 'getChunk',
        })
      )

      // 現在時刻を取得
      const clock = yield* Clock.Clock
      const now = yield* clock.currentTimeMillis

      // モックチャンクデータの作成
      const mockChunk: ChunkAggregate = {
        id,
        position: { x: 0, z: 0 },
        data: new Uint16Array(16 * 16 * 384), // CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
        metadata: {
          biome: Schema.decodeSync(BiomeTypeSchema)('plains'),
          lightLevel: Schema.decodeSync(LightLevelSchema)(15),
          timestamp: Schema.decodeSync(TimestampSchema)(now),
        },
        blocks: new Map(),
      }

      return mockChunk
    })

  /**
   * 指定されたIDのチャンクデータを取得
   */
  readonly getChunkData = (id: ChunkId): Effect.Effect<ChunkData, ChunkDataValidationError> =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`Getting chunk data for ID: ${id}`)

      // チャンクの取得
      const chunk = yield* this.getChunk(id).pipe(
        Effect.mapError((error) => ({
          _tag: 'ChunkDataValidationError' as const,
          chunkId: id,
          reason: `Failed to get chunk: ${error.reason}`,
          data: undefined,
        }))
      )

      return chunk.data
    })

  /**
   * チャンクの整合性を検証
   */
  readonly validateChunk = (chunk: ChunkAggregate): Effect.Effect<void, ChunkDataValidationError> =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`Validating chunk: ${chunk.id}`)

      // データサイズの検証
      const expectedSize = 16 * 16 * 384 // CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
      yield* Effect.when(chunk.data.length !== expectedSize, () =>
        Effect.fail({
          _tag: 'ChunkDataValidationError' as const,
          chunkId: chunk.id,
          reason: `Invalid chunk data size: expected ${expectedSize}, got ${chunk.data.length}`,
          data: chunk.data,
        })
      )

      // ポジションの検証
      yield* Effect.when(
        !chunk.position || typeof chunk.position.x !== 'number' || typeof chunk.position.z !== 'number',
        () =>
          Effect.fail({
            _tag: 'ChunkDataValidationError' as const,
            chunkId: chunk.id,
            reason: 'Invalid chunk position',
            data: chunk.position,
          })
      )

      yield* Effect.logInfo(`Chunk validation successful: ${chunk.id}`)
    })

  /**
   * 指定された座標のブロックを取得
   */
  readonly getBlock = (position: {
    readonly x: WorldCoordinate
    readonly y: WorldCoordinate
    readonly z: WorldCoordinate
  }): Effect.Effect<BlockData, ChunkBoundsError> =>
    Effect.gen(function* () {
      // 座標の境界チェック
      const { x, y, z } = position

      yield* Effect.when(y < -64 || y > 319, () =>
        Effect.fail({
          _tag: 'ChunkBoundsError' as const,
          position,
          reason: `Y coordinate out of bounds: ${y}`,
          bounds: { min: -64, max: 319 },
        })
      )

      // チャンク座標に変換
      const chunkX = Math.floor(x / 16)
      const chunkZ = Math.floor(z / 16)
      const localX = Math.abs(x % 16)
      const localZ = Math.abs(z % 16)
      const localY = y + 64 // オフセット調整

      // ブロックインデックス計算
      const blockIndex = localY * (16 * 16) + localZ * 16 + localX

      // モックブロックデータを返す
      return {
        blockId: 1 as any, // Stone block
        metadata: 0 as any,
        lightLevel: 15 as any,
      }
    })

  /**
   * 指定された座標にブロックを設定
   */
  readonly setBlock = (
    position: {
      readonly x: WorldCoordinate
      readonly y: WorldCoordinate
      readonly z: WorldCoordinate
    },
    blockData: BlockData
  ): Effect.Effect<void, ChunkBoundsError> =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`Setting block at position: (${position.x}, ${position.y}, ${position.z})`)

      // 座標の境界チェック（getBlockと同じロジック）
      const { y } = position

      yield* Effect.when(y < -64 || y > 319, () =>
        Effect.fail({
          _tag: 'ChunkBoundsError' as const,
          position,
          reason: `Y coordinate out of bounds: ${y}`,
          bounds: { min: -64, max: 319 },
        })
      )

      // TODO: 実際のブロック設定ロジック
      yield* Effect.logInfo(`Block set successfully at: (${position.x}, ${position.y}, ${position.z})`)
    })

  /**
   * チャンク座標をワールド座標に変換
   */
  readonly chunkToWorldCoordinates = (
    chunkPos: ChunkPosition
  ): Effect.Effect<
    {
      readonly x: WorldCoordinate
      readonly y: WorldCoordinate
      readonly z: WorldCoordinate
    },
    ChunkPositionError
  > =>
    Effect.gen(function* () {
      const worldX = (chunkPos.x * 16) as WorldCoordinate
      const worldZ = (chunkPos.z * 16) as WorldCoordinate
      const worldY = 64 as WorldCoordinate // デフォルトY座標

      return { x: worldX, y: worldY, z: worldZ }
    })

  /**
   * ワールド座標をチャンク座標に変換
   */
  readonly worldToChunkCoordinates = (worldPos: {
    readonly x: WorldCoordinate
    readonly y: WorldCoordinate
    readonly z: WorldCoordinate
  }): Effect.Effect<ChunkPosition, ChunkPositionError> =>
    Effect.gen(function* () {
      const chunkX = Math.floor(worldPos.x / 16)
      const chunkZ = Math.floor(worldPos.z / 16)

      return { x: chunkX, z: chunkZ }
    })
}

/**
 * ChunkDataProvider Live Layer
 *
 * Effect-TSのLayerパターンでChunkDataProviderを提供。
 */
export const ChunkDataProviderLive = Layer.succeed(ChunkDataProvider, new ChunkDataProviderLive())
