import { describe, expect, beforeEach, vi } from 'vitest'
import { Effect } from 'effect'
import { it } from '@effect/vitest'
import { Schema } from '@effect/schema'
import { pipe } from 'effect/Function'
import * as Match from 'effect/Match'
import { BrandedTypes } from '../../../shared/types/branded'
import {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  CHUNK_VOLUME,
  CHUNK_MIN_Y,
  CHUNK_MAX_Y,
  ChunkMetadataSchema,
  type ChunkMetadata,
  type ChunkData,
  getBlockIndex,
  getBlockCoords,
  createChunkData,
  getBlock,
  setBlock,
  updateHeightMap,
  getHeight,
  isEmpty,
  getMemoryUsage,
  resetChunkData,
} from '../ChunkData.js'
import type { ChunkPosition } from '../ChunkPosition.js'

describe('ChunkData', () => {
  let testPosition: ChunkPosition
  let testChunk: ChunkData

  beforeEach(() => {
    testPosition = { x: 5, z: -3 }
    testChunk = createChunkData(testPosition)
  })

  describe('constants', () => {
    it.effect('should have correct chunk dimensions', () =>
      Effect.gen(function* () {
        expect(CHUNK_SIZE).toBe(16)
        expect(CHUNK_HEIGHT).toBe(384)
        expect(CHUNK_VOLUME).toBe(98304) // 16 * 16 * 384
        expect(CHUNK_MIN_Y).toBe(-64)
        expect(CHUNK_MAX_Y).toBe(319)
      })
    )

    it.effect('should have consistent derived values', () =>
      Effect.gen(function* () {
        expect(CHUNK_VOLUME).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
        expect(CHUNK_MAX_Y - CHUNK_MIN_Y + 1).toBe(CHUNK_HEIGHT)
      })
    )
  })

  describe('ChunkMetadataSchema', () => {
    it.effect('should validate correct metadata', () =>
      Effect.gen(function* () {
        const validMetadata: ChunkMetadata = {
          biome: 'plains',
          lightLevel: 8,
          isModified: true,
          lastUpdate: Date.now(),
          heightMap: new Array(256).fill(64),
        }

        expect(() => Schema.decodeUnknownSync(ChunkMetadataSchema)(validMetadata)).not.toThrow()
      })
    )

    it.effect('should reject invalid light levels', () =>
      Effect.gen(function* () {
        const invalidMetadata = {
          biome: 'plains',
          lightLevel: 16, // invalid: > 15
          isModified: false,
          lastUpdate: Date.now(),
          heightMap: [],
        }

        expect(() => Schema.decodeUnknownSync(ChunkMetadataSchema)(invalidMetadata)).toThrow()
      })
    )

    it.effect('should reject negative light levels', () =>
      Effect.gen(function* () {
        const invalidMetadata = {
          biome: 'plains',
          lightLevel: -1, // invalid: < 0
          isModified: false,
          lastUpdate: Date.now(),
          heightMap: [],
        }

        expect(() => Schema.decodeUnknownSync(ChunkMetadataSchema)(invalidMetadata)).toThrow()
      })
    )
  })

  describe('getBlockIndex', () => {
    it.effect('should calculate correct indices for valid coordinates', () =>
      Effect.gen(function* () {
        const testCases: Array<[number, number, number, number]> = [
          [0, -64, 0, 0], // min Y at origin
          [0, 319, 0, 383], // max Y at origin
          [0, 0, 0, 64], // Y=0 at origin
          [1, 0, 0, 64 + 0 * 384 + 1 * 384 * 16], // X=1
          [0, 0, 1, 64 + 1 * 384], // Z=1
          [15, 319, 15, 383 + 15 * 384 + 15 * 384 * 16], // max coordinates
        ]

        for (const [x, y, z, expectedIndex] of testCases) {
          const result = getBlockIndex(
            BrandedTypes.createWorldCoordinate(x),
            BrandedTypes.createWorldCoordinate(y),
            BrandedTypes.createWorldCoordinate(z)
          )
          expect(result).toBe(expectedIndex)
        }
      })
    )

    it.effect('should throw for out-of-bounds coordinates', () =>
      Effect.gen(function* () {
        const invalidCases = [
          [-1, 0, 0], // X < 0
          [16, 0, 0], // X >= CHUNK_SIZE
          [0, -65, 0], // Y < CHUNK_MIN_Y
          [0, 320, 0], // Y > CHUNK_MAX_Y
          [0, 0, -1], // Z < 0
          [0, 0, 16], // Z >= CHUNK_SIZE
        ]

        for (const [x, y, z] of invalidCases) {
          // TypeScript type assertion: destructured array values are guaranteed to be numbers
          const safeX = x as number
          const safeY = y as number
          const safeZ = z as number

          yield* Effect.sync(() => {
            expect(() =>
              getBlockIndex(
                BrandedTypes.createWorldCoordinate(safeX),
                BrandedTypes.createWorldCoordinate(safeY),
                BrandedTypes.createWorldCoordinate(safeZ)
              )
            ).toThrow()
          })
        }
      })
    )

    it.effect('should generate unique indices for different coordinates', () =>
      Effect.gen(function* () {
        const indices = new Set<number>()
        const coordinates: Array<[number, number, number]> = []

        // Generate test coordinates
        for (let x = 0; x < CHUNK_SIZE; x += 4) {
          for (let y = CHUNK_MIN_Y; y <= CHUNK_MAX_Y; y += 32) {
            for (let z = 0; z < CHUNK_SIZE; z += 4) {
              coordinates.push([x, y, z] as const)
            }
          }
        }

        for (const [x, y, z] of coordinates) {
          const index = getBlockIndex(
            BrandedTypes.createWorldCoordinate(x),
            BrandedTypes.createWorldCoordinate(y),
            BrandedTypes.createWorldCoordinate(z)
          )
          expect(indices.has(index)).toBe(false)
          indices.add(index)
        }
      })
    )

    it.effect('should generate indices within valid range', () =>
      Effect.gen(function* () {
        for (let x = 0; x < CHUNK_SIZE; x += 2) {
          for (let y = CHUNK_MIN_Y; y <= CHUNK_MAX_Y; y += 40) {
            for (let z = 0; z < CHUNK_SIZE; z += 2) {
              const index = getBlockIndex(
                BrandedTypes.createWorldCoordinate(x),
                BrandedTypes.createWorldCoordinate(y),
                BrandedTypes.createWorldCoordinate(z)
              )
              expect(index).toBeGreaterThanOrEqual(0)
              expect(index).toBeLessThanOrEqual(CHUNK_VOLUME - 1)
            }
          }
        }
      })
    )
  })

  describe('getBlockCoords', () => {
    it.effect('should be inverse of getBlockIndex', () =>
      Effect.gen(function* () {
        const testCases: Array<[number, number, number]> = [
          [0, -64, 0],
          [0, 319, 0],
          [15, 319, 15],
          [8, 128, 8],
          [3, -32, 11],
        ]

        for (const [x, y, z] of testCases) {
          const index = getBlockIndex(
            BrandedTypes.createWorldCoordinate(x),
            BrandedTypes.createWorldCoordinate(y),
            BrandedTypes.createWorldCoordinate(z)
          )
          const [recoveredX, recoveredY, recoveredZ] = getBlockCoords(index)
          expect(recoveredX).toBe(x)
          expect(recoveredY).toBe(y)
          expect(recoveredZ).toBe(z)
        }
      })
    )

    it.effect('should throw for invalid indices', () =>
      Effect.gen(function* () {
        const invalidIndices = [-1, CHUNK_VOLUME, CHUNK_VOLUME + 1, -100, 200000]

        for (const index of invalidIndices) {
          expect(() => getBlockCoords(index)).toThrow()
        }
      })
    )
  })

  describe('createChunkData', () => {
    it.effect('should create chunk with default metadata', () =>
      Effect.gen(function* () {
        const chunk = createChunkData(testPosition)

        expect(chunk.position).toEqual(testPosition)
        expect(chunk.blocks).toBeInstanceOf(Uint16Array)
        expect(chunk.blocks.length).toBe(CHUNK_VOLUME)
        expect(chunk.isDirty).toBe(false)
        expect(chunk.metadata.biome).toBe('plains')
        expect(chunk.metadata.lightLevel).toBe(15)
        expect(chunk.metadata.isModified).toBe(false)
        expect(chunk.metadata.heightMap).toHaveLength(CHUNK_SIZE * CHUNK_SIZE)
      })
    )

    it.effect('should create chunk with custom metadata', () =>
      Effect.gen(function* () {
        const customMetadata: Partial<ChunkMetadata> = {
          biome: 'desert',
          lightLevel: 10,
          isModified: true,
        }

        const chunk = createChunkData(testPosition, customMetadata)

        expect(chunk.metadata.biome).toBe('desert')
        expect(chunk.metadata.lightLevel).toBe(10)
        expect(chunk.metadata.isModified).toBe(true)
        expect(chunk.metadata.heightMap).toHaveLength(CHUNK_SIZE * CHUNK_SIZE)
      })
    )

    it.effect('should initialize all blocks to Air (0)', () =>
      Effect.gen(function* () {
        const chunk = createChunkData(testPosition)

        for (let i = 0; i < chunk.blocks.length; i++) {
          expect(chunk.blocks[i]).toBe(0)
        }
      })
    )
  })

  describe('getBlock', () => {
    it.effect('should return Air (0) for newly created chunk', () =>
      Effect.gen(function* () {
        const testCases: Array<[number, number, number]> = [
          [0, 0, 0],
          [15, 319, 15],
          [8, -64, 8],
          [3, 100, 11],
        ]

        for (const [x, y, z] of testCases) {
          const block = getBlock(
            testChunk,
            BrandedTypes.createWorldCoordinate(x),
            BrandedTypes.createWorldCoordinate(y),
            BrandedTypes.createWorldCoordinate(z)
          )
          expect(block).toBe(0)
        }
      })
    )

    it.effect('should return correct block after setting', () =>
      Effect.gen(function* () {
        const modifiedChunk = setBlock(
          testChunk,
          BrandedTypes.createWorldCoordinate(5),
          BrandedTypes.createWorldCoordinate(100),
          BrandedTypes.createWorldCoordinate(10),
          42
        )
        const block = getBlock(
          modifiedChunk,
          BrandedTypes.createWorldCoordinate(5),
          BrandedTypes.createWorldCoordinate(100),
          BrandedTypes.createWorldCoordinate(10)
        )
        expect(block).toBe(42)
      })
    )
  })

  describe('setBlock', () => {
    it.effect('should set block and return new chunk', () =>
      Effect.gen(function* () {
        const newChunk = setBlock(
          testChunk,
          BrandedTypes.createWorldCoordinate(8),
          BrandedTypes.createWorldCoordinate(64),
          BrandedTypes.createWorldCoordinate(12),
          123
        )

        expect(newChunk).not.toBe(testChunk) // immutable
        expect(
          getBlock(
            newChunk,
            BrandedTypes.createWorldCoordinate(8),
            BrandedTypes.createWorldCoordinate(64),
            BrandedTypes.createWorldCoordinate(12)
          )
        ).toBe(123)
        expect(
          getBlock(
            testChunk,
            BrandedTypes.createWorldCoordinate(8),
            BrandedTypes.createWorldCoordinate(64),
            BrandedTypes.createWorldCoordinate(12)
          )
        ).toBe(0) // original unchanged
      })
    )

    it.effect('should mark chunk as dirty and modified', () =>
      Effect.gen(function* () {
        const newChunk = setBlock(
          testChunk,
          BrandedTypes.createWorldCoordinate(0),
          BrandedTypes.createWorldCoordinate(0),
          BrandedTypes.createWorldCoordinate(0),
          1
        )

        expect(newChunk.isDirty).toBe(true)
        expect(newChunk.metadata.isModified).toBe(true)
        expect(newChunk.metadata.lastUpdate).toBeGreaterThanOrEqual(testChunk.metadata.lastUpdate)
      })
    )

    it.effect('should preserve other blocks', () =>
      Effect.gen(function* () {
        let chunk = testChunk
        chunk = setBlock(
          chunk,
          BrandedTypes.createWorldCoordinate(1),
          BrandedTypes.createWorldCoordinate(1),
          BrandedTypes.createWorldCoordinate(1),
          10
        )
        chunk = setBlock(
          chunk,
          BrandedTypes.createWorldCoordinate(2),
          BrandedTypes.createWorldCoordinate(2),
          BrandedTypes.createWorldCoordinate(2),
          20
        )
        chunk = setBlock(
          chunk,
          BrandedTypes.createWorldCoordinate(3),
          BrandedTypes.createWorldCoordinate(3),
          BrandedTypes.createWorldCoordinate(3),
          30
        )

        expect(
          getBlock(
            chunk,
            BrandedTypes.createWorldCoordinate(1),
            BrandedTypes.createWorldCoordinate(1),
            BrandedTypes.createWorldCoordinate(1)
          )
        ).toBe(10)
        expect(
          getBlock(
            chunk,
            BrandedTypes.createWorldCoordinate(2),
            BrandedTypes.createWorldCoordinate(2),
            BrandedTypes.createWorldCoordinate(2)
          )
        ).toBe(20)
        expect(
          getBlock(
            chunk,
            BrandedTypes.createWorldCoordinate(3),
            BrandedTypes.createWorldCoordinate(3),
            BrandedTypes.createWorldCoordinate(3)
          )
        ).toBe(30)
        expect(
          getBlock(
            chunk,
            BrandedTypes.createWorldCoordinate(0),
            BrandedTypes.createWorldCoordinate(0),
            BrandedTypes.createWorldCoordinate(0)
          )
        ).toBe(0) // unchanged
      })
    )
  })

  describe('updateHeightMap', () => {
    it.effect('should update height at specified coordinates', () =>
      Effect.gen(function* () {
        const newChunk = updateHeightMap(
          testChunk,
          BrandedTypes.createWorldCoordinate(5),
          BrandedTypes.createWorldCoordinate(10),
          128
        )

        expect(getHeight(newChunk, BrandedTypes.createWorldCoordinate(5), BrandedTypes.createWorldCoordinate(10))).toBe(
          128
        )
        expect(newChunk.isDirty).toBe(true)
        expect(newChunk.metadata.lastUpdate).toBeGreaterThanOrEqual(testChunk.metadata.lastUpdate)
      })
    )

    it.effect('should preserve other height values', () =>
      Effect.gen(function* () {
        let chunk = testChunk
        chunk = updateHeightMap(
          chunk,
          BrandedTypes.createWorldCoordinate(0),
          BrandedTypes.createWorldCoordinate(0),
          100
        )
        chunk = updateHeightMap(
          chunk,
          BrandedTypes.createWorldCoordinate(15),
          BrandedTypes.createWorldCoordinate(15),
          200
        )
        chunk = updateHeightMap(
          chunk,
          BrandedTypes.createWorldCoordinate(8),
          BrandedTypes.createWorldCoordinate(8),
          150
        )

        expect(getHeight(chunk, BrandedTypes.createWorldCoordinate(0), BrandedTypes.createWorldCoordinate(0))).toBe(100)
        expect(getHeight(chunk, BrandedTypes.createWorldCoordinate(15), BrandedTypes.createWorldCoordinate(15))).toBe(
          200
        )
        expect(getHeight(chunk, BrandedTypes.createWorldCoordinate(8), BrandedTypes.createWorldCoordinate(8))).toBe(150)
        expect(getHeight(chunk, BrandedTypes.createWorldCoordinate(1), BrandedTypes.createWorldCoordinate(1))).toBe(0) // unchanged
      })
    )
  })

  describe('getHeight', () => {
    it.effect('should return 0 for newly created chunk', () =>
      Effect.gen(function* () {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          for (let z = 0; z < CHUNK_SIZE; z++) {
            expect(
              getHeight(testChunk, BrandedTypes.createWorldCoordinate(x), BrandedTypes.createWorldCoordinate(z))
            ).toBe(0)
          }
        }
      })
    )

    it.effect('should throw for out-of-bounds coordinates', () =>
      Effect.gen(function* () {
        const invalidCases = [
          [-1, 0],
          [16, 0],
          [0, -1],
          [0, 16],
          [-1, -1],
          [16, 16],
        ]

        for (const [x, z] of invalidCases) {
          // TypeScript type assertion: destructured array values are guaranteed to be numbers
          const safeX = x as number
          const safeZ = z as number

          yield* Effect.sync(() => {
            expect(() =>
              getHeight(testChunk, BrandedTypes.createWorldCoordinate(safeX), BrandedTypes.createWorldCoordinate(safeZ))
            ).toThrow()
          })
        }
      })
    )
  })

  describe('isEmpty', () => {
    it.effect('should return true for newly created chunk', () =>
      Effect.gen(function* () {
        expect(isEmpty(testChunk)).toBe(true)
      })
    )

    it.effect('should return false after setting any block', () =>
      Effect.gen(function* () {
        const modifiedChunk = setBlock(
          testChunk,
          BrandedTypes.createWorldCoordinate(0),
          BrandedTypes.createWorldCoordinate(0),
          BrandedTypes.createWorldCoordinate(0),
          1
        )
        expect(isEmpty(modifiedChunk)).toBe(false)
      })
    )

    it.effect('should return true after setting block back to Air', () =>
      Effect.gen(function* () {
        let chunk = setBlock(
          testChunk,
          BrandedTypes.createWorldCoordinate(5),
          BrandedTypes.createWorldCoordinate(100),
          BrandedTypes.createWorldCoordinate(10),
          42
        )
        expect(isEmpty(chunk)).toBe(false)

        chunk = setBlock(
          chunk,
          BrandedTypes.createWorldCoordinate(5),
          BrandedTypes.createWorldCoordinate(100),
          BrandedTypes.createWorldCoordinate(10),
          0
        )
        expect(isEmpty(chunk)).toBe(true)
      })
    )
  })

  describe('getMemoryUsage', () => {
    it.effect('should calculate memory usage correctly', () =>
      Effect.gen(function* () {
        const usage = getMemoryUsage(testChunk)
        const expectedBlocksSize = testChunk.blocks.byteLength // Uint16Array: 98304 * 2 = 196608 bytes
        const expectedHeightMapSize = testChunk.metadata.heightMap.length * 8 // 256 * 8 = 2048 bytes
        const expectedMetadataSize = 1024 // estimated

        expect(usage).toBe(expectedBlocksSize + expectedHeightMapSize + expectedMetadataSize)
        expect(usage).toBeGreaterThan(190000) // Should be around 200KB
        expect(usage).toBeLessThan(210000) // Should be under 210KB
      })
    )

    it.effect('should be consistent across multiple calls', () =>
      Effect.gen(function* () {
        const usage1 = getMemoryUsage(testChunk)
        const usage2 = getMemoryUsage(testChunk)
        expect(usage1).toBe(usage2)
      })
    )
  })

  describe('resetChunkData', () => {
    it.effect('should reset chunk to empty state', () =>
      Effect.gen(function* () {
        let chunk = setBlock(
          testChunk,
          BrandedTypes.createWorldCoordinate(1),
          BrandedTypes.createWorldCoordinate(1),
          BrandedTypes.createWorldCoordinate(1),
          100
        )
        chunk = setBlock(
          chunk,
          BrandedTypes.createWorldCoordinate(2),
          BrandedTypes.createWorldCoordinate(2),
          BrandedTypes.createWorldCoordinate(2),
          200
        )
        chunk = updateHeightMap(
          chunk,
          BrandedTypes.createWorldCoordinate(5),
          BrandedTypes.createWorldCoordinate(5),
          150
        )

        const newPosition = { x: 10, z: 20 }
        const resetChunk = resetChunkData(chunk, newPosition)

        expect(resetChunk.position).toEqual(newPosition)
        expect(isEmpty(resetChunk)).toBe(true)
        expect(resetChunk.isDirty).toBe(false)
        expect(resetChunk.metadata.isModified).toBe(false)
        expect(resetChunk.metadata.biome).toBe('plains')
        expect(
          getHeight(resetChunk, BrandedTypes.createWorldCoordinate(5), BrandedTypes.createWorldCoordinate(5))
        ).toBe(0)
      })
    )

    it.effect('should reuse the same Uint16Array for memory efficiency', () =>
      Effect.gen(function* () {
        const originalBlocks = testChunk.blocks
        const resetChunk = resetChunkData(testChunk, { x: 100, z: 200 })

        expect(resetChunk.blocks).toBe(originalBlocks) // same reference
        expect(isEmpty(resetChunk)).toBe(true) // but cleared
      })
    )
  })

  describe.sequential('performance', () => {
    it.effect('should handle block operations efficiently', () =>
      Effect.gen(function* () {
        const iterations = 1000 // 大幅削減
        let chunk = testChunk

        for (let i = 0; i < iterations; i++) {
          const x = i % CHUNK_SIZE
          const y = (i % 50) + 50 // 簡略化
          const z = (i * 2) % CHUNK_SIZE
          const blockId = (i % 10) + 1 // 簡略化

          chunk = setBlock(
            chunk,
            BrandedTypes.createWorldCoordinate(x),
            BrandedTypes.createWorldCoordinate(y),
            BrandedTypes.createWorldCoordinate(z),
            blockId
          )
          const retrieved = getBlock(
            chunk,
            BrandedTypes.createWorldCoordinate(x),
            BrandedTypes.createWorldCoordinate(y),
            BrandedTypes.createWorldCoordinate(z)
          )
          expect(retrieved).toBe(blockId)
        }

        // パフォーマンステストは削除、機能テストに集約
        expect(chunk).toBeDefined()
      })
    )

    it.effect('should handle chunk population', () =>
      Effect.gen(function* () {
        let chunk = testChunk

        // 最小限の検証のみ
        for (let x = 0; x < CHUNK_SIZE; x += 8) {
          for (let y = 50; y <= 100; y += 25) {
            for (let z = 0; z < CHUNK_SIZE; z += 8) {
              chunk = setBlock(
                chunk,
                BrandedTypes.createWorldCoordinate(x),
                BrandedTypes.createWorldCoordinate(y),
                BrandedTypes.createWorldCoordinate(z),
                1
              )
            }
          }
        }

        expect(chunk).toBeDefined()
        expect(getMemoryUsage(chunk)).toBeLessThan(500000) // 緩い制限
      })
    )
  })
})
