import { Schema } from '@effect/schema'
import { Effect, Match, Option } from 'effect'
import { ChunkPositionSchema, type ChunkPosition } from './ChunkPosition.js'
import { WorldCoordinate, BrandedTypes } from '../../shared/types/branded.js'

// チャンクサイズ定数
export const CHUNK_SIZE = 16 // X, Z軸のサイズ
export const CHUNK_HEIGHT = 384 // Y軸のサイズ（-64 ~ 320）
export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT // 98,304ブロック
export const CHUNK_MIN_Y = -64
export const CHUNK_MAX_Y = 319
// チャンクタイムスタンプ生成ユーティリティ
const getCurrentTimestamp = (): number => Date.now()

/**
 * チャンクメタデータのスキーマ定義
 */
export const ChunkMetadataSchema = Schema.Struct({
  biome: Schema.String,
  lightLevel: Schema.Number.pipe(Schema.between(0, 15)),
  isModified: Schema.Boolean,
  lastUpdate: Schema.Number,
  heightMap: Schema.Array(Schema.Number), // 16x16の高さマップ
})

export type ChunkMetadata = Schema.Schema.Type<typeof ChunkMetadataSchema>

/**
 * チャンクデータのコア構造
 * Uint16Arrayで効率的なブロックデータ管理
 */
export interface ChunkData {
  readonly position: ChunkPosition
  readonly blocks: Uint16Array // 16x16x384 = 98,304要素
  readonly metadata: ChunkMetadata
  readonly isDirty: boolean
}

/**
 * 座標検証のための境界チェック
 */
const validateCoordinates = (
  x: WorldCoordinate,
  y: WorldCoordinate,
  z: WorldCoordinate
): Effect.Effect<{ x: WorldCoordinate; y: WorldCoordinate; z: WorldCoordinate; normalizedY: number }, Error> => {
  const normalizedY = y + 64

  return Match.value([x, z, normalizedY]).pipe(
    Match.when(
      ([x, z, normalizedY]) =>
        x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE && normalizedY >= 0 && normalizedY < CHUNK_HEIGHT,
      ([x, z, normalizedY]) => Effect.succeed({ x, y, z, normalizedY })
    ),
    Match.orElse(() => Effect.fail(new Error(`Invalid coordinates: (${x}, ${y}, ${z})`)))
  )
}

/**
 * 3D座標から1Dインデックスへの変換（Effect-TSパターン）
 * normalizedY + (z * CHUNK_HEIGHT) + (x * CHUNK_HEIGHT * CHUNK_SIZE)
 * CHUNK_HEIGHT=384, CHUNK_SIZE=16, so x * 384 * 16 = x * 6144
 */
export const getBlockIndex = (x: WorldCoordinate, y: WorldCoordinate, z: WorldCoordinate): number => {
  return Effect.runSync(
    validateCoordinates(x, y, z).pipe(
      Effect.map(({ normalizedY }) => normalizedY + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE)
    )
  )
}

/**
 * 1Dインデックスから3D座標への変換
 */
export const getBlockCoords = (index: number): [WorldCoordinate, WorldCoordinate, WorldCoordinate] => {
  return Effect.runSync(
    Match.value(index).pipe(
      Match.when(
        (index) => index >= 0 && index < CHUNK_VOLUME,
        (index) => {
          const x = Math.floor(index / (CHUNK_HEIGHT * CHUNK_SIZE))
          const z = Math.floor((index % (CHUNK_HEIGHT * CHUNK_SIZE)) / CHUNK_HEIGHT)
          const normalizedY = index % CHUNK_HEIGHT
          const y = normalizedY - 64 // 0-383範囲を-64～319に戻す
          return Effect.succeed([
            BrandedTypes.createWorldCoordinate(x),
            BrandedTypes.createWorldCoordinate(y),
            BrandedTypes.createWorldCoordinate(z)
          ] as [WorldCoordinate, WorldCoordinate, WorldCoordinate])
        }
      ),
      Match.orElse(() => Effect.fail(new Error(`Invalid index: ${index}`)))
    )
  )
}

/**
 * チャンクデータの作成ファクトリ関数
 */
export const createChunkData = (position: ChunkPosition, metadata?: Partial<ChunkMetadata>): ChunkData => {
  const defaultMetadata: ChunkMetadata = {
    biome: 'plains',
    lightLevel: 15,
    isModified: false,
    lastUpdate: getCurrentTimestamp(),
    heightMap: new Array(CHUNK_SIZE * CHUNK_SIZE).fill(0),
    ...metadata,
  }

  return {
    position,
    blocks: new Uint16Array(CHUNK_VOLUME), // 初期化時は全てAir(0)
    metadata: defaultMetadata,
    isDirty: false,
  }
}

/**
 * チャンクデータのブロック取得
 */
export const getBlock = (chunk: ChunkData, x: WorldCoordinate, y: WorldCoordinate, z: WorldCoordinate): number => {
  const index = getBlockIndex(x, y, z)
  return chunk.blocks[index] ?? 0
}

/**
 * チャンクデータのブロック設定（immutable）
 */
export const setBlock = (chunk: ChunkData, x: WorldCoordinate, y: WorldCoordinate, z: WorldCoordinate, blockId: number): ChunkData => {
  const index = getBlockIndex(x, y, z)
  const newBlocks = new Uint16Array(chunk.blocks)
  newBlocks[index] = blockId

  return {
    ...chunk,
    blocks: newBlocks,
    isDirty: true,
    metadata: {
      ...chunk.metadata,
      isModified: true,
      lastUpdate: getCurrentTimestamp(),
    },
  }
}

/**
 * チャンクの高さマップ更新
 */
export const updateHeightMap = (chunk: ChunkData, x: WorldCoordinate, z: WorldCoordinate, height: number): ChunkData => {
  const heightMapIndex = x + z * CHUNK_SIZE
  const newHeightMap = [...chunk.metadata.heightMap]
  newHeightMap[heightMapIndex] = height

  return {
    ...chunk,
    metadata: {
      ...chunk.metadata,
      heightMap: newHeightMap,
      lastUpdate: getCurrentTimestamp(),
    },
    isDirty: true,
  }
}

/**
 * チャンクの高さ取得
 */
export const getHeight = (chunk: ChunkData, x: WorldCoordinate, z: WorldCoordinate): number => {
  return Effect.runSync(
    Match.value([x, z]).pipe(
      Match.when(
        ([x, z]) => x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE,
        ([x, z]) => {
          const heightMapIndex = x + z * CHUNK_SIZE
          return Effect.succeed(chunk.metadata.heightMap[heightMapIndex] ?? 0)
        }
      ),
      Match.orElse(() => Effect.fail(new Error(`Invalid coordinates: (${x}, ${z})`)))
    )
  )
}

/**
 * チャンクが空かどうかをチェック
 */
export const isEmpty = (chunk: ChunkData): boolean => {
  // forループをArray.every()に変換（ショートサーキット評価でパフォーマンス維持）
  return Array.from(chunk.blocks).every((blockValue) => blockValue === 0)
}

/**
 * チャンクのメモリ使用量を計算（バイト単位）
 */
export const getMemoryUsage = (chunk: ChunkData): number => {
  return (
    chunk.blocks.byteLength + // Uint16Array: 98,304 * 2 = 196,608 bytes
    chunk.metadata.heightMap.length * 8 + // heightMap: 256 * 8 = 2,048 bytes
    1024 // その他メタデータの概算
  )
}

/**
 * チャンクデータのリセット（再利用用）
 */
export const resetChunkData = (chunk: ChunkData, newPosition: ChunkPosition): ChunkData => {
  // ブロックデータをゼロクリア
  chunk.blocks.fill(0)

  return {
    position: newPosition,
    blocks: chunk.blocks, // 既存の配列を再利用
    metadata: {
      biome: 'plains',
      lightLevel: 15,
      isModified: false,
      lastUpdate: getCurrentTimestamp(),
      heightMap: new Array(CHUNK_SIZE * CHUNK_SIZE).fill(0),
    },
    isDirty: false,
  }
}
