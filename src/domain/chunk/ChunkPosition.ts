import { Schema } from '@effect/schema'
import { Match, Option } from 'effect'
import { type WorldCoordinate, BrandedTypes } from '../../shared/types/branded'

/**
 * チャンク座標のスキーマ定義
 * チャンクはX,Z軸で16x16ブロックを管理
 */
export const ChunkPositionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.transform(Schema.Number.pipe(Schema.int()), { decode: Math.floor, encode: (n) => n })),
  z: Schema.Number.pipe(Schema.transform(Schema.Number.pipe(Schema.int()), { decode: Math.floor, encode: (n) => n })),
})

export type ChunkPosition = Schema.Schema.Type<typeof ChunkPositionSchema>

/**
 * チャンク座標からブロック座標への変換
 */
export const chunkToBlockCoords = (chunkPos: ChunkPosition): { startX: WorldCoordinate; startZ: WorldCoordinate } => ({
  startX: BrandedTypes.createWorldCoordinate(chunkPos.x * 16),
  startZ: BrandedTypes.createWorldCoordinate(chunkPos.z * 16),
})

/**
 * ブロック座標からチャンク座標への変換
 */
export const blockToChunkCoords = (blockX: WorldCoordinate, blockZ: WorldCoordinate): ChunkPosition => ({
  x: Math.floor(blockX / 16),
  z: Math.floor(blockZ / 16),
})

/**
 * チャンク座標からユニークなIDを生成
 */
export const chunkPositionToId = (pos: ChunkPosition): string => `chunk_${pos.x}_${pos.z}`

/**
 * チャンクIDから座標を復元（Effect-TSパターン）
 */
export const chunkIdToPosition = (id: string): Option.Option<ChunkPosition> =>
  Option.fromNullable(id.match(/^chunk_(-?\d+)_(-?\d+)$/)).pipe(
    Option.flatMap((match) =>
      Option.all([Option.fromNullable(match[1]), Option.fromNullable(match[2])]).pipe(
        Option.map(([xStr, zStr]) => ({
          x: parseInt(xStr, 10),
          z: parseInt(zStr, 10),
        }))
      )
    )
  )

/**
 * 2つのチャンク座標が等しいかチェック
 */
export const chunkPositionEquals = (a: ChunkPosition, b: ChunkPosition): boolean => a.x === b.x && a.z === b.z

/**
 * チャンク座標間の距離を計算（マンハッタン距離）
 */
export const chunkPositionDistance = (a: ChunkPosition, b: ChunkPosition): number =>
  Math.abs(a.x - b.x) + Math.abs(a.z - b.z)
