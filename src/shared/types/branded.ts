import { Schema } from 'effect'

/**
 * ブランド型定義
 * 型レベルでの安全性を確保し、値の混同を防ぐ
 */

/**
 * プレイヤーID用のブランド型
 * 文字列だが他の文字列と区別される
 */
export const PlayerIdSchema = Schema.String.pipe(Schema.brand('PlayerId'))
export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>

/**
 * ワールド座標用のブランド型
 * 数値だが座標値として明確に区別される
 */
export const WorldCoordinateSchema = Schema.Number.pipe(Schema.brand('WorldCoordinate'))
export type WorldCoordinate = Schema.Schema.Type<typeof WorldCoordinateSchema>

/**
 * チャンクID用のブランド型
 * 文字列だがチャンク識別子として区別される
 */
export const ChunkIdSchema = Schema.String.pipe(Schema.brand('ChunkId'))
export type ChunkId = Schema.Schema.Type<typeof ChunkIdSchema>

/**
 * ブロックタイプID用のブランド型
 * 数値だがブロック種別として区別される
 */
export const BlockTypeIdSchema = Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.brand('BlockTypeId'))
export type BlockTypeId = Schema.Schema.Type<typeof BlockTypeIdSchema>

/**
 * ブランド型を作成するためのヘルパー関数
 */
export const BrandedTypes = {
  /**
   * 安全なPlayerId作成
   */
  createPlayerId: (id: string): PlayerId => Schema.decodeSync(PlayerIdSchema)(id),

  /**
   * 安全なWorldCoordinate作成
   */
  createWorldCoordinate: (value: number): WorldCoordinate => Schema.decodeSync(WorldCoordinateSchema)(value),

  /**
   * 安全なChunkId作成
   */
  createChunkId: (id: string): ChunkId => Schema.decodeSync(ChunkIdSchema)(id),

  /**
   * 安全なBlockTypeId作成
   */
  createBlockTypeId: (id: number): BlockTypeId => Schema.decodeSync(BlockTypeIdSchema)(id),
} as const
