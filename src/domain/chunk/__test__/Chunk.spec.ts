import { it } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Either from 'effect/Either'
import * as fc from 'fast-check'
import { ChunkBoundsError, ChunkSerializationError, type Chunk, createChunk, createEmptyChunk } from '../Chunk.js'
import { createChunkData, CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_MIN_Y, CHUNK_MAX_Y, getBlockIndex } from '../ChunkData.js'
import type { ChunkPosition } from '../ChunkPosition.js'

describe('Chunk - Effect-TS Pattern 100% Coverage', () => {
  const testPosition: ChunkPosition = { x: 10, z: -5 }

  describe('createChunk factory', () => {
    it.effect('should create chunk with valid data', () =>
      Effect.gen(function* () {
        const chunkData = createChunkData(testPosition)
        const chunk = createChunk(chunkData)

        expect(chunk.position).toEqual(testPosition)
        expect(chunk.blocks).toBeInstanceOf(Uint16Array)
        expect(chunk.metadata).toBeDefined()
        expect(chunk.isDirty).toBe(false)
      })
    )

    it.effect('should preserve data integrity', () =>
      Effect.gen(function* () {
        const chunkData = createChunkData(testPosition)
        chunkData.blocks[100] = 42
        chunkData.isDirty = true

        const chunk = createChunk(chunkData)
        // インデックス100の座標を正しく計算
        // index = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE なので逆算
        const x = 100 % CHUNK_SIZE  // 4
        const z = Math.floor((100 % (CHUNK_SIZE * CHUNK_SIZE)) / CHUNK_SIZE)  // 6
        const y = Math.floor(100 / (CHUNK_SIZE * CHUNK_SIZE)) + CHUNK_MIN_Y  // -64

        const blockId = yield* chunk.getBlock(x, y, z)

        expect(blockId).toBe(42)
        expect(chunk.isDirty).toBe(true)
      })
    )
  })

  describe('createEmptyChunk factory', () => {
    it.effect('should create empty chunk with position', () =>
      Effect.gen(function* () {
        const chunk = createEmptyChunk(testPosition)

        expect(chunk.position).toEqual(testPosition)
        expect(chunk.isEmpty()).toBe(true)
        expect(chunk.isDirty).toBe(false)

        // 全ブロックが空気(0)であることを確認
        for (let i = 0; i < 10; i++) {
          const x = Math.floor(Math.random() * CHUNK_SIZE)
          const y = CHUNK_MIN_Y + Math.floor(Math.random() * CHUNK_HEIGHT)
          const z = Math.floor(Math.random() * CHUNK_SIZE)
          const blockId = yield* chunk.getBlock(x, y, z)
          expect(blockId).toBe(0)
        }
      })
    )
  })

  describe('getBlock method', () => {
    it.effect('should get block at valid coordinates', () =>
      Effect.gen(function* () {
        const chunk = createEmptyChunk(testPosition)

        // 有効な座標でのアクセス
        const testCases = [
          { x: 0, y: CHUNK_MIN_Y, z: 0 },
          { x: CHUNK_SIZE - 1, y: CHUNK_MAX_Y - 1, z: CHUNK_SIZE - 1 },
          { x: 8, y: 64, z: 8 },
        ]

        for (const { x, y, z } of testCases) {
          const blockId = yield* chunk.getBlock(x, y, z)
          expect(blockId).toBe(0)
        }
      })
    )

    it.effect('should fail with ChunkBoundsError for invalid coordinates', () =>
      Effect.gen(function* () {
        const chunk = createEmptyChunk(testPosition)

        const invalidCases = [
          { x: -1, y: 0, z: 0, desc: 'negative x' },
          { x: CHUNK_SIZE, y: 0, z: 0, desc: 'x >= CHUNK_SIZE' },
          { x: 0, y: CHUNK_MIN_Y - 1, z: 0, desc: 'y < CHUNK_MIN_Y' },
          { x: 0, y: CHUNK_MAX_Y, z: 0, desc: 'y >= CHUNK_MAX_Y' },
          { x: 0, y: 0, z: -1, desc: 'negative z' },
          { x: 0, y: 0, z: CHUNK_SIZE, desc: 'z >= CHUNK_SIZE' },
        ]

        for (const { x, y, z, desc } of invalidCases) {
          const result = yield* Effect.exit(chunk.getBlock(x, y, z))
          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result)) {
            const error = result.cause._tag === 'Fail' ? result.cause.error : null
            expect(error).toBeInstanceOf(ChunkBoundsError)
            expect(error?.message).toContain(`Invalid coordinates: (${x}, ${y}, ${z})`)
          }
        }
      })
    )

    it('should handle any valid coordinate with property testing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: CHUNK_SIZE - 1 }),
          fc.integer({ min: CHUNK_MIN_Y, max: CHUNK_MAX_Y - 1 }),
          fc.integer({ min: 0, max: CHUNK_SIZE - 1 }),
          async (x, y, z) => {
            const chunk = createEmptyChunk(testPosition)
            const result = await Effect.runPromise(Effect.exit(chunk.getBlock(x, y, z)))
            expect(Exit.isSuccess(result)).toBe(true)
          }
        )
      )
    })
  })

  describe('setBlock method', () => {
    it.effect('should set block and maintain immutability', () =>
      Effect.gen(function* () {
        const originalChunk = createEmptyChunk(testPosition)
        const newChunk = yield* originalChunk.setBlock(5, 10, 8, 42)

        // 新しいチャンクにブロックが設定されている
        const newBlockId = yield* newChunk.getBlock(5, 10, 8)
        expect(newBlockId).toBe(42)

        // 元のチャンクは変更されない
        const originalBlockId = yield* originalChunk.getBlock(5, 10, 8)
        expect(originalBlockId).toBe(0)

        // メタデータの更新を確認
        expect(newChunk.isDirty).toBe(true)
        expect(newChunk.metadata.isModified).toBe(true)
        expect(originalChunk.isDirty).toBe(false)
      })
    )

    it.effect('should fail with ChunkBoundsError for invalid coordinates', () =>
      Effect.gen(function* () {
        const chunk = createEmptyChunk(testPosition)

        const invalidCases = [
          { x: -1, y: 0, z: 0 },
          { x: CHUNK_SIZE, y: 0, z: 0 },
          { x: 0, y: CHUNK_MIN_Y - 1, z: 0 },
          { x: 0, y: CHUNK_MAX_Y, z: 0 },
          { x: 0, y: 0, z: -1 },
          { x: 0, y: 0, z: CHUNK_SIZE },
        ]

        for (const { x, y, z } of invalidCases) {
          const result = yield* Effect.exit(chunk.setBlock(x, y, z, 1))
          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result)) {
            const error = result.cause._tag === 'Fail' ? result.cause.error : null
            expect(error).toBeInstanceOf(ChunkBoundsError)
            expect(error?.message).toContain(`Failed to set block at (${x}, ${y}, ${z})`)
          }
        }
      })
    )

    it('should set any valid block with property testing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: CHUNK_SIZE - 1 }),
          fc.integer({ min: CHUNK_MIN_Y, max: CHUNK_MAX_Y - 1 }),
          fc.integer({ min: 0, max: CHUNK_SIZE - 1 }),
          fc.integer({ min: 1, max: 100 }),
          async (x, y, z, blockId) => {
            const chunk = createEmptyChunk(testPosition)
            const newChunk = await Effect.runPromise(chunk.setBlock(x, y, z, blockId))
            const retrievedId = await Effect.runPromise(newChunk.getBlock(x, y, z))
            expect(retrievedId).toBe(blockId)
            expect(newChunk.isDirty).toBe(true)
          }
        )
      )
    })
  })

  describe('fillRegion method', () => {
    it.effect('should fill region with specified block', () =>
      Effect.gen(function* () {
        const chunk = createEmptyChunk(testPosition)
        const filledChunk = yield* chunk.fillRegion(0, 0, 0, 2, 2, 2, 5)

        // 領域内のブロックを確認
        for (let x = 0; x <= 2; x++) {
          for (let y = 0; y <= 2; y++) {
            for (let z = 0; z <= 2; z++) {
              const blockId = yield* filledChunk.getBlock(x, y, z)
              expect(blockId).toBe(5)
            }
          }
        }

        // 領域外のブロックは変更されない
        const outsideBlock = yield* filledChunk.getBlock(3, 3, 3)
        expect(outsideBlock).toBe(0)
        expect(filledChunk.isDirty).toBe(true)
      })
    )

    it.effect('should handle inverted coordinates', () =>
      Effect.gen(function* () {
        const chunk = createEmptyChunk(testPosition)
        // 座標が逆転している場合でも正しく処理される
        const filledChunk = yield* chunk.fillRegion(2, 2, 2, 0, 0, 0, 7)

        for (let x = 0; x <= 2; x++) {
          for (let y = 0; y <= 2; y++) {
            for (let z = 0; z <= 2; z++) {
              const blockId = yield* filledChunk.getBlock(x, y, z)
              expect(blockId).toBe(7)
            }
          }
        }
      })
    )

    it.effect('should fail for completely out-of-bounds regions', () =>
      Effect.gen(function* () {
        const chunk = createEmptyChunk(testPosition)

        const invalidRegions = [
          { startX: -1, startY: 0, startZ: 0, endX: 1, endY: 1, endZ: 1 },
          { startX: 0, startY: CHUNK_MIN_Y - 1, startZ: 0, endX: 1, endY: 1, endZ: 1 },
          { startX: 0, startY: 0, startZ: -1, endX: 1, endY: 1, endZ: 1 },
          { startX: CHUNK_SIZE, startY: 0, startZ: 0, endX: CHUNK_SIZE + 1, endY: 1, endZ: 1 },
          { startX: 0, startY: CHUNK_MAX_Y, startZ: 0, endX: 1, endY: CHUNK_MAX_Y + 1, endZ: 1 },
          { startX: 0, startY: 0, startZ: CHUNK_SIZE, endX: 1, endY: 1, endZ: CHUNK_SIZE + 1 },
        ]

        for (const { startX, startY, startZ, endX, endY, endZ } of invalidRegions) {
          const result = yield* Effect.exit(chunk.fillRegion(startX, startY, startZ, endX, endY, endZ, 1))
          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result)) {
            const error = result.cause._tag === 'Fail' ? result.cause.error : null
            expect(error).toBeInstanceOf(ChunkBoundsError)
            expect(error?.message).toContain(`Failed to fill region`)
          }
        }
      })
    )
  })

  describe('serialize/deserialize methods', () => {
    it.effect('should serialize and deserialize chunk correctly', () =>
      Effect.gen(function* () {
        const originalChunk = createEmptyChunk(testPosition)

        // いくつかのブロックを設定
        let chunk = yield* originalChunk.setBlock(1, 2, 3, 42)
        chunk = yield* chunk.setBlock(5, 6, 7, 100)

        // シリアライズ
        const serialized = yield* chunk.serialize()
        expect(serialized).toBeInstanceOf(ArrayBuffer)
        expect(serialized.byteLength).toBeGreaterThan(64) // ヘッダーサイズ以上

        // デシリアライズ
        const deserialized = yield* chunk.deserialize(serialized)

        // データの整合性確認
        const block1 = yield* deserialized.getBlock(1, 2, 3)
        const block2 = yield* deserialized.getBlock(5, 6, 7)
        expect(block1).toBe(42)
        expect(block2).toBe(100)
        expect(deserialized.metadata.heightMap).toEqual(chunk.metadata.heightMap)
      })
    )

    it.effect('should fail deserializing invalid buffer', () =>
      Effect.gen(function* () {
        const chunk = createEmptyChunk(testPosition)

        // バッファが小さすぎる
        const smallBuffer = new ArrayBuffer(10)
        const result1 = yield* Effect.exit(chunk.deserialize(smallBuffer))
        expect(Exit.isFailure(result1)).toBe(true)
        if (Exit.isFailure(result1)) {
          const error = result1.cause._tag === 'Fail' ? result1.cause.error : null
          expect(error).toBeInstanceOf(ChunkSerializationError)
          expect(error?.message).toContain('Buffer too small')
        }

        // 無効なバージョン
        const invalidVersionBuffer = new ArrayBuffer(100)
        const view = new DataView(invalidVersionBuffer)
        view.setUint32(0, 999, true) // 無効なバージョン

        const result2 = yield* Effect.exit(chunk.deserialize(invalidVersionBuffer))
        expect(Exit.isFailure(result2)).toBe(true)
        if (Exit.isFailure(result2)) {
          const error = result2.cause._tag === 'Fail' ? result2.cause.error : null
          expect(error).toBeInstanceOf(ChunkSerializationError)
          expect(error?.message).toContain('Unsupported version: 999')
        }
      })
    )
  })

  describe('compress/decompress methods', () => {
    it.effect('should compress and decompress chunk data', () =>
      Effect.gen(function* () {
        // 均一なデータを持つチャンク（圧縮効率が高い）
        const chunk = createEmptyChunk(testPosition)
        const filledChunk = yield* chunk.fillRegion(0, 0, 0, CHUNK_SIZE - 1, 10, CHUNK_SIZE - 1, 7)

        // 圧縮
        const compressed = yield* filledChunk.compress()
        const serialized = yield* filledChunk.serialize()

        // 圧縮効果の確認（均一データなら圧縮後の方が小さいはず）
        expect(compressed.byteLength).toBeLessThan(serialized.byteLength)

        // 解凍
        const decompressed = yield* filledChunk.decompress(compressed)

        // データの整合性確認
        for (let x = 0; x <= 2; x++) {
          for (let y = 0; y <= 2; y++) {
            for (let z = 0; z <= 2; z++) {
              const blockId = yield* decompressed.getBlock(x, y, z)
              expect(blockId).toBe(7)
            }
          }
        }
      })
    )

    it.effect('should handle edge cases in compression', () =>
      Effect.gen(function* () {
        const chunk = createEmptyChunk(testPosition)

        // 空のチャンク
        const emptyCompressed = yield* chunk.compress()
        const emptyDecompressed = yield* chunk.decompress(emptyCompressed)
        expect(emptyDecompressed.isEmpty()).toBe(true)

        // ランダムデータ（圧縮効率が低い）
        let randomChunk = chunk
        for (let i = 0; i < 100; i++) {
          const x = Math.floor(Math.random() * CHUNK_SIZE)
          const y = CHUNK_MIN_Y + Math.floor(Math.random() * CHUNK_HEIGHT)
          const z = Math.floor(Math.random() * CHUNK_SIZE)
          const blockId = Math.floor(Math.random() * 100) + 1
          randomChunk = yield* randomChunk.setBlock(x, y, z, blockId)
        }

        const randomCompressed = yield* randomChunk.compress()
        const randomDecompressed = yield* randomChunk.decompress(randomCompressed)

        // ランダムに選んだ位置でデータを確認
        for (let i = 0; i < 10; i++) {
          const x = Math.floor(Math.random() * CHUNK_SIZE)
          const y = CHUNK_MIN_Y + Math.floor(Math.random() * CHUNK_HEIGHT)
          const z = Math.floor(Math.random() * CHUNK_SIZE)

          const originalBlock = yield* randomChunk.getBlock(x, y, z)
          const decompressedBlock = yield* randomDecompressed.getBlock(x, y, z)
          expect(decompressedBlock).toBe(originalBlock)
        }
      })
    )

    it.effect('should fail decompressing invalid data', () =>
      Effect.gen(function* () {
        const chunk = createEmptyChunk(testPosition)

        // 無効な圧縮データ
        const invalidCases = [
          { data: new ArrayBuffer(0), desc: 'empty buffer' },
          { data: new ArrayBuffer(1), desc: 'odd-sized buffer' },
          { data: new ArrayBuffer(3), desc: 'incomplete pair' },
        ]

        for (const { data, desc } of invalidCases) {
          const result = yield* Effect.exit(chunk.decompress(data))
          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result)) {
            const error = result.cause._tag === 'Fail' ? result.cause.error : null
            expect(error).toBeInstanceOf(ChunkSerializationError)
          }
        }
      })
    )
  })

  describe('utility methods', () => {
    it.effect('should check if chunk is empty', () =>
      Effect.gen(function* () {
        const emptyChunk = createEmptyChunk(testPosition)
        expect(emptyChunk.isEmpty()).toBe(true)

        const nonEmptyChunk = yield* emptyChunk.setBlock(0, 0, 0, 1)
        expect(nonEmptyChunk.isEmpty()).toBe(false)

        // 0でfillしても空と判定される
        const zeroFilledChunk = yield* emptyChunk.fillRegion(0, 0, 0, 1, 1, 1, 0)
        expect(zeroFilledChunk.isEmpty()).toBe(true)
      })
    )

    it.effect('should calculate memory usage', () =>
      Effect.gen(function* () {
        const chunk = createEmptyChunk(testPosition)
        const memoryUsage = chunk.getMemoryUsage()

        // メモリ使用量は正の数
        expect(memoryUsage).toBeGreaterThan(0)

        // blocks配列のサイズ + heightMapのサイズ + メタデータ
        const expectedMin = chunk.blocks.byteLength + chunk.metadata.heightMap.length * 8
        expect(memoryUsage).toBeGreaterThanOrEqual(expectedMin)
      })
    )

    it.effect('should clone chunk with full independence', () =>
      Effect.gen(function* () {
        const original = createEmptyChunk(testPosition)
        const modified = yield* original.setBlock(5, 5, 5, 42)
        const cloned = modified.clone()

        // クローンは同じデータを持つ
        const clonedBlock = yield* cloned.getBlock(5, 5, 5)
        expect(clonedBlock).toBe(42)
        expect(cloned.position).toEqual(modified.position)
        expect(cloned.isDirty).toBe(modified.isDirty)

        // クローンを変更しても元は変わらない
        const clonedModified = yield* cloned.setBlock(6, 6, 6, 100)
        const originalBlock = yield* modified.getBlock(6, 6, 6)
        const clonedModifiedBlock = yield* clonedModified.getBlock(6, 6, 6)

        expect(originalBlock).toBe(0)
        expect(clonedModifiedBlock).toBe(100)

        // 配列の独立性確認
        expect(cloned.blocks).not.toBe(modified.blocks)
        expect(cloned.metadata.heightMap).not.toBe(modified.metadata.heightMap)
      })
    )
  })

  describe('integration tests', () => {
    it.effect('should handle complex operations sequence', () =>
      Effect.gen(function* () {
        let chunk = createEmptyChunk(testPosition)

        // 複数の操作を順次実行
        chunk = yield* chunk.setBlock(0, 0, 0, 1)
        chunk = yield* chunk.setBlock(1, 1, 1, 2)
        chunk = yield* chunk.fillRegion(5, 5, 5, 7, 7, 7, 9)

        // シリアライズ・デシリアライズ
        const serialized = yield* chunk.serialize()
        const deserialized = yield* chunk.deserialize(serialized)

        // 圧縮・解凍
        const compressed = yield* deserialized.compress()
        const decompressed = yield* deserialized.decompress(compressed)

        // クローン
        const cloned = decompressed.clone()

        // 全ての操作後もデータが保持されている
        const block1 = yield* cloned.getBlock(0, 0, 0)
        const block2 = yield* cloned.getBlock(1, 1, 1)
        const block3 = yield* cloned.getBlock(6, 6, 6)

        expect(block1).toBe(1)
        expect(block2).toBe(2)
        expect(block3).toBe(9)
      })
    )

    it('should maintain data integrity through all operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              x: fc.integer({ min: 0, max: CHUNK_SIZE - 1 }),
              y: fc.integer({ min: CHUNK_MIN_Y, max: CHUNK_MAX_Y - 1 }),
              z: fc.integer({ min: 0, max: CHUNK_SIZE - 1 }),
              blockId: fc.integer({ min: 1, max: 100 })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (operations) => {
            const effect = Effect.gen(function* () {
          let chunk = createEmptyChunk(testPosition)

          // ランダムな操作を適用
          for (const { x, y, z, blockId } of operations) {
            chunk = yield* chunk.setBlock(x, y, z, blockId)
          }

          // シリアライズ・デシリアライズサイクル
          const serialized = yield* chunk.serialize()
          const deserialized = yield* chunk.deserialize(serialized)

          // 圧縮・解凍サイクル
          const compressed = yield* chunk.compress()
          const decompressed = yield* chunk.decompress(compressed)

          // クローン
          const cloned = chunk.clone()

          // すべての操作後、データが保持されていることを確認
          for (const { x, y, z, blockId: expectedBlockId } of operations) {
            const deserializedBlock = yield* deserialized.getBlock(x, y, z)
            const decompressedBlock = yield* decompressed.getBlock(x, y, z)
            const clonedBlock = yield* cloned.getBlock(x, y, z)

            // 最後に設定された値が保持されている（同じ座標への複数の操作がある場合）
            const lastValue = operations
              .filter((op) => op.x === x && op.y === y && op.z === z)
              .pop()?.blockId ?? 0

            expect(deserializedBlock).toBe(lastValue)
            expect(decompressedBlock).toBe(lastValue)
            expect(clonedBlock).toBe(lastValue)
          }
        })

        await Effect.runPromise(effect)
          }
        )
      )
    })
  })
})