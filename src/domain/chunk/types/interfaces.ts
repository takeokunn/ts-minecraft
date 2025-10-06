import { Context, Effect } from 'effect'
import type { BlockData, ChunkAggregate, ChunkData, ChunkId, ChunkPosition, WorldCoordinate } from '../aggregate'
import type { ChunkBoundsError, ChunkDataValidationError, ChunkIdError, ChunkPositionError } from './index'

/**
 * Chunk Domain Provider Interface - データ提供層
 *
 * Pure chunk機能のみを提供するドメイン境界インターフェース。
 * 他のドメインに対してチャンクデータとブロックデータへの
 * 型安全なアクセスを提供する。
 *
 * 責任範囲:
 * - チャンクデータの読み取り・書き込み
 * - ブロックデータの操作
 * - チャンク検証
 * - 座標変換
 */
export interface ChunkDataProvider {
  /**
   * 指定されたIDのチャンクを取得
   *
   * @param id - 取得対象のチャンクID
   * @returns チャンク集約またはChunkNotFoundError
   */
  readonly getChunk: (id: ChunkId) => Effect.Effect<ChunkAggregate, ChunkIdError>

  /**
   * 指定されたIDのチャンクデータを取得
   *
   * @param id - 取得対象のチャンクID
   * @returns チャンクデータまたはChunkDataValidationError
   */
  readonly getChunkData: (id: ChunkId) => Effect.Effect<ChunkData, ChunkDataValidationError>

  /**
   * チャンクの整合性を検証
   *
   * @param chunk - 検証対象のチャンク
   * @returns 検証成功またはChunkDataValidationError
   */
  readonly validateChunk: (chunk: ChunkAggregate) => Effect.Effect<void, ChunkDataValidationError>

  /**
   * 指定された座標のブロックを取得
   *
   * @param position - ワールド座標
   * @returns ブロックデータまたはChunkBoundsError
   */
  readonly getBlock: (position: {
    readonly x: WorldCoordinate
    readonly y: WorldCoordinate
    readonly z: WorldCoordinate
  }) => Effect.Effect<BlockData, ChunkBoundsError>

  /**
   * 指定された座標にブロックを設定
   *
   * @param position - ワールド座標
   * @param blockData - 設定するブロックデータ
   * @returns 設定成功またはChunkBoundsError
   */
  readonly setBlock: (
    position: {
      readonly x: WorldCoordinate
      readonly y: WorldCoordinate
      readonly z: WorldCoordinate
    },
    blockData: BlockData
  ) => Effect.Effect<void, ChunkBoundsError>

  /**
   * チャンク座標をワールド座標に変換
   *
   * @param chunkPos - チャンク座標
   * @returns ワールド座標またはChunkPositionError
   */
  readonly chunkToWorldCoordinates: (chunkPos: ChunkPosition) => Effect.Effect<
    {
      readonly x: WorldCoordinate
      readonly y: WorldCoordinate
      readonly z: WorldCoordinate
    },
    ChunkPositionError
  >

  /**
   * ワールド座標をチャンク座標に変換
   *
   * @param worldPos - ワールド座標
   * @returns チャンク座標またはChunkPositionError
   */
  readonly worldToChunkCoordinates: (worldPos: {
    readonly x: WorldCoordinate
    readonly y: WorldCoordinate
    readonly z: WorldCoordinate
  }) => Effect.Effect<ChunkPosition, ChunkPositionError>
}

/**
 * Chunk Data Provider のContext.GenericTag
 *
 * Effect-TSの依存性注入システムで使用される。
 * アプリケーション層で具象実装を注入する際に使用。
 */
export const ChunkDataProvider = Context.GenericTag<ChunkDataProvider>('ChunkDataProvider')

/**
 * Chunk Domain Input - 外部依存なし
 *
 * Pure chunk機能は外部ドメインに依存しないため、
 * 入力型は存在しない（never型）。
 */
export type ChunkInput = never
