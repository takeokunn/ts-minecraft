import { Effect } from 'effect'
import type { ChunkPosition } from './ChunkPosition.js'
import type { ChunkData, ChunkMetadata } from './ChunkData.js'
import { getBlockIndex, getBlockCoords } from './ChunkData.js'

/**
 * チャンク操作のエラー型
 */
export class ChunkBoundsError extends Error {
  readonly _tag = 'ChunkBoundsError'
  constructor(message: string) {
    super(message)
  }
}

export class ChunkSerializationError extends Error {
  readonly _tag = 'ChunkSerializationError'
  constructor(message: string) {
    super(message)
  }
}

/**
 * チャンクインターフェース
 * 高性能なブロックアクセスと圧縮機能を提供
 */
export interface Chunk {
  readonly position: ChunkPosition
  readonly blocks: Uint16Array
  readonly metadata: ChunkMetadata
  readonly isDirty: boolean

  // ブロックアクセスメソッド
  getBlock(x: number, y: number, z: number): Effect.Effect<number, ChunkBoundsError>
  setBlock(x: number, y: number, z: number, blockId: number): Effect.Effect<Chunk, ChunkBoundsError>

  // 一括操作
  fillRegion(
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
    blockId: number
  ): Effect.Effect<Chunk, ChunkBoundsError>

  // シリアライゼーション
  serialize(): Effect.Effect<ArrayBuffer, ChunkSerializationError>
  deserialize(data: ArrayBuffer): Effect.Effect<Chunk, ChunkSerializationError>

  // 圧縮
  compress(): Effect.Effect<ArrayBuffer, ChunkSerializationError>
  decompress(compressedData: ArrayBuffer): Effect.Effect<Chunk, ChunkSerializationError>

  // ユーティリティ
  isEmpty(): boolean
  getMemoryUsage(): number
  clone(): Chunk
}

/**
 * チャンクの実装ファクトリ関数
 */
export const createChunk = (data: ChunkData): Chunk => {
  const chunk: Chunk = {
    position: data.position,
    blocks: data.blocks,
    metadata: data.metadata,
    isDirty: data.isDirty,

    getBlock(x: number, y: number, z: number): Effect.Effect<number, ChunkBoundsError> {
      return Effect.try({
        try: () => {
          const index = getBlockIndex(x, y, z)
          const block = chunk.blocks[index]
          return block ?? 0 // デフォルトでAir(0)を返す
        },
        catch: (error) => new ChunkBoundsError(`Invalid coordinates: (${x}, ${y}, ${z}): ${error}`),
      })
    },

    setBlock(x: number, y: number, z: number, blockId: number): Effect.Effect<Chunk, ChunkBoundsError> {
      return Effect.try({
        try: () => {
          const index = getBlockIndex(x, y, z)
          const newBlocks = new Uint16Array(chunk.blocks)
          newBlocks[index] = blockId

          const newData: ChunkData = {
            position: chunk.position,
            blocks: newBlocks,
            metadata: {
              ...chunk.metadata,
              isModified: true,
              lastUpdate: Date.now(),
            },
            isDirty: true,
          }

          return createChunk(newData)
        },
        catch: (error) => new ChunkBoundsError(`Failed to set block at (${x}, ${y}, ${z}): ${error}`),
      })
    },

    fillRegion(
      startX: number,
      startY: number,
      startZ: number,
      endX: number,
      endY: number,
      endZ: number,
      blockId: number
    ): Effect.Effect<Chunk, ChunkBoundsError> {
      return Effect.try({
        try: () => {
          const newBlocks = new Uint16Array(chunk.blocks)

          for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
              for (let z = startZ; z <= endZ; z++) {
                const index = getBlockIndex(x, y, z)
                newBlocks[index] = blockId
              }
            }
          }

          const newData: ChunkData = {
            position: chunk.position,
            blocks: newBlocks,
            metadata: {
              ...chunk.metadata,
              isModified: true,
              lastUpdate: Date.now(),
            },
            isDirty: true,
          }

          return createChunk(newData)
        },
        catch: (error) =>
          new ChunkBoundsError(
            `Failed to fill region (${startX},${startY},${startZ}) to (${endX},${endY},${endZ}): ${error}`
          ),
      })
    },

    serialize(): Effect.Effect<ArrayBuffer, ChunkSerializationError> {
      return Effect.try({
        try: () => {
          const headerSize = 64 // メタデータ用
          const blocksSize = chunk.blocks.byteLength
          const heightMapSize = chunk.metadata.heightMap.length * 4 // number[] -> 4 bytes each

          const buffer = new ArrayBuffer(headerSize + blocksSize + heightMapSize)
          const view = new DataView(buffer)
          let offset = 0

          // ヘッダー: バージョン、サイズ情報
          view.setUint32(offset, 1, true) // version
          offset += 4
          view.setUint32(offset, blocksSize, true)
          offset += 4
          view.setUint32(offset, heightMapSize, true)
          offset += 4
          view.setFloat64(offset, chunk.metadata.lastUpdate, true)
          offset += 8

          // ブロックデータ
          const blocksView = new Uint16Array(buffer, offset, chunk.blocks.length)
          blocksView.set(chunk.blocks)
          offset += blocksSize

          // 高さマップ
          const heightMapView = new Float32Array(buffer, offset, chunk.metadata.heightMap.length)
          heightMapView.set(chunk.metadata.heightMap)

          return buffer
        },
        catch: (error) => new ChunkSerializationError(`Failed to serialize chunk: ${error}`),
      })
    },

    deserialize(data: ArrayBuffer): Effect.Effect<Chunk, ChunkSerializationError> {
      return Effect.try({
        try: () => {
          const view = new DataView(data)
          let offset = 0

          // ヘッダー読み込み
          const version = view.getUint32(offset, true)
          offset += 4
          if (version !== 1) {
            throw new Error(`Unsupported version: ${version}`)
          }

          const blocksSize = view.getUint32(offset, true)
          offset += 4
          const heightMapSize = view.getUint32(offset, true)
          offset += 4
          const lastUpdate = view.getFloat64(offset, true)
          offset += 8

          // ブロックデータ読み込み
          const blocksView = new Uint16Array(data, offset, blocksSize / 2)
          const blocks = new Uint16Array(blocksView)
          offset += blocksSize

          // 高さマップ読み込み
          const heightMapView = new Float32Array(data, offset, heightMapSize / 4)
          const heightMap = Array.from(heightMapView)

          const newData: ChunkData = {
            position: chunk.position,
            blocks,
            metadata: {
              ...chunk.metadata,
              heightMap,
              lastUpdate,
            },
            isDirty: false,
          }

          return createChunk(newData)
        },
        catch: (error) => new ChunkSerializationError(`Failed to deserialize chunk: ${error}`),
      })
    },

    compress(): Effect.Effect<ArrayBuffer, ChunkSerializationError> {
      return Effect.gen(function* () {
        const serialized = yield* chunk.serialize()

        // Run-Length Encoding の簡単な実装
        return yield* Effect.try({
          try: () => {
            const input = new Uint16Array(serialized)
            const compressed: number[] = []

            let i = 0
            while (i < input.length) {
              const value = input[i] ?? 0
              let count = 1

              // 連続する同じ値をカウント
              while (i + count < input.length && (input[i + count] ?? 0) === value && count < 255) {
                count++
              }

              // 値と回数を記録
              compressed.push(value, count)
              i += count
            }

            // ArrayBufferに変換
            const result = new ArrayBuffer(compressed.length * 2)
            const resultView = new Uint16Array(result)
            resultView.set(compressed)

            return result
          },
          catch: (error) => new ChunkSerializationError(`Failed to compress chunk: ${error}`),
        })
      })
    },

    decompress(compressedData: ArrayBuffer): Effect.Effect<Chunk, ChunkSerializationError> {
      return Effect.try({
        try: () => {
          const input = new Uint16Array(compressedData)
          const decompressed: number[] = []

          // Run-Length Decoding
          for (let i = 0; i < input.length; i += 2) {
            const value = input[i] ?? 0
            const count = input[i + 1] ?? 0

            for (let j = 0; j < count; j++) {
              decompressed.push(value)
            }
          }

          // ArrayBufferに変換
          const result = new ArrayBuffer(decompressed.length * 2)
          const resultView = new Uint16Array(result)
          resultView.set(decompressed)

          return chunk.deserialize(result)
        },
        catch: (error) => new ChunkSerializationError(`Failed to decompress chunk: ${error}`),
      }).pipe(Effect.flatten)
    },

    isEmpty(): boolean {
      for (let i = 0; i < chunk.blocks.length; i++) {
        if (chunk.blocks[i] !== 0) {
          return false
        }
      }
      return true
    },

    getMemoryUsage(): number {
      return (
        chunk.blocks.byteLength + chunk.metadata.heightMap.length * 8 + 256 // その他メタデータ
      )
    },

    clone(): Chunk {
      const newData: ChunkData = {
        position: { ...chunk.position },
        blocks: new Uint16Array(chunk.blocks),
        metadata: {
          ...chunk.metadata,
          heightMap: [...chunk.metadata.heightMap],
        },
        isDirty: chunk.isDirty,
      }
      return createChunk(newData)
    },
  }

  return chunk
}

/**
 * 空のチャンクを作成
 */
export const createEmptyChunk = (position: ChunkPosition): Chunk => {
  const data: ChunkData = {
    position,
    blocks: new Uint16Array(98304), // 16*16*384
    metadata: {
      biome: 'plains',
      lightLevel: 15,
      isModified: false,
      lastUpdate: Date.now(),
      heightMap: new Array(256).fill(0), // 16*16
    },
    isDirty: false,
  }

  return createChunk(data)
}
