import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Schema } from '@effect/schema'
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
    it('should have correct chunk dimensions', () => {
      expect(CHUNK_SIZE).toBe(16)
      expect(CHUNK_HEIGHT).toBe(384)
      expect(CHUNK_VOLUME).toBe(98304) // 16 * 16 * 384
      expect(CHUNK_MIN_Y).toBe(-64)
      expect(CHUNK_MAX_Y).toBe(319)
    })

    it('should have consistent derived values', () => {
      expect(CHUNK_VOLUME).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      expect(CHUNK_MAX_Y - CHUNK_MIN_Y + 1).toBe(CHUNK_HEIGHT)
    })
  })

  describe('ChunkMetadataSchema', () => {
    it('should validate correct metadata', () => {
      const validMetadata: ChunkMetadata = {
        biome: 'plains',
        lightLevel: 8,
        isModified: true,
        lastUpdate: Date.now(),
        heightMap: new Array(256).fill(64),
      }

      expect(() => Schema.decodeUnknownSync(ChunkMetadataSchema)(validMetadata)).not.toThrow()
    })

    it('should reject invalid light levels', () => {
      const invalidMetadata = {
        biome: 'plains',
        lightLevel: 16, // invalid: > 15
        isModified: false,
        lastUpdate: Date.now(),
        heightMap: [],
      }

      expect(() => Schema.decodeUnknownSync(ChunkMetadataSchema)(invalidMetadata)).toThrow()
    })

    it('should reject negative light levels', () => {
      const invalidMetadata = {
        biome: 'plains',
        lightLevel: -1, // invalid: < 0
        isModified: false,
        lastUpdate: Date.now(),
        heightMap: [],
      }

      expect(() => Schema.decodeUnknownSync(ChunkMetadataSchema)(invalidMetadata)).toThrow()
    })
  })

  describe('getBlockIndex', () => {
    it('should calculate correct indices for valid coordinates', () => {
      const testCases: Array<[number, number, number, number]> = [
        [0, -64, 0, 0], // min Y at origin
        [0, 319, 0, 383], // max Y at origin
        [0, 0, 0, 64], // Y=0 at origin
        [1, 0, 0, 64 + 0 * 384 + 1 * 384 * 16], // X=1
        [0, 0, 1, 64 + 1 * 384], // Z=1
        [15, 319, 15, 383 + 15 * 384 + 15 * 384 * 16], // max coordinates
      ]

      testCases.forEach(([x, y, z, expectedIndex]) => {
        const result = getBlockIndex(x, y, z)
        expect(result).toBe(expectedIndex)
      })
    })

    it('should throw for out-of-bounds coordinates', () => {
      const invalidCases = [
        [-1, 0, 0], // X < 0
        [16, 0, 0], // X >= CHUNK_SIZE
        [0, -65, 0], // Y < CHUNK_MIN_Y
        [0, 320, 0], // Y > CHUNK_MAX_Y
        [0, 0, -1], // Z < 0
        [0, 0, 16], // Z >= CHUNK_SIZE
      ]

      invalidCases.forEach(([x, y, z]) => {
        if (x !== undefined && y !== undefined && z !== undefined) {
          expect(() => getBlockIndex(x, y, z)).toThrow()
        }
      })
    })

    it('should generate unique indices for different coordinates', () => {
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

      coordinates.forEach(([x, y, z]) => {
        const index = getBlockIndex(x, y, z)
        expect(indices.has(index)).toBe(false)
        indices.add(index)
      })
    })

    it('should generate indices within valid range', () => {
      for (let x = 0; x < CHUNK_SIZE; x += 2) {
        for (let y = CHUNK_MIN_Y; y <= CHUNK_MAX_Y; y += 40) {
          for (let z = 0; z < CHUNK_SIZE; z += 2) {
            const index = getBlockIndex(x, y, z)
            expect(index).toBeGreaterThanOrEqual(0)
            expect(index).toBeLessThanOrEqual(CHUNK_VOLUME - 1)
          }
        }
      }
    })
  })

  describe('getBlockCoords', () => {
    it('should be inverse of getBlockIndex', () => {
      const testCases: Array<[number, number, number]> = [
        [0, -64, 0],
        [0, 319, 0],
        [15, 319, 15],
        [8, 128, 8],
        [3, -32, 11],
      ]

      testCases.forEach(([x, y, z]) => {
        const index = getBlockIndex(x, y, z)
        const [recoveredX, recoveredY, recoveredZ] = getBlockCoords(index)
        expect(recoveredX).toBe(x)
        expect(recoveredY).toBe(y)
        expect(recoveredZ).toBe(z)
      })
    })

    it('should throw for invalid indices', () => {
      const invalidIndices = [-1, CHUNK_VOLUME, CHUNK_VOLUME + 1, -100, 200000]

      invalidIndices.forEach((index) => {
        expect(() => getBlockCoords(index)).toThrow()
      })
    })
  })

  describe('createChunkData', () => {
    it('should create chunk with default metadata', () => {
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

    it('should create chunk with custom metadata', () => {
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

    it('should initialize all blocks to Air (0)', () => {
      const chunk = createChunkData(testPosition)

      for (let i = 0; i < chunk.blocks.length; i++) {
        expect(chunk.blocks[i]).toBe(0)
      }
    })
  })

  describe('getBlock', () => {
    it('should return Air (0) for newly created chunk', () => {
      const testCases: Array<[number, number, number]> = [
        [0, 0, 0],
        [15, 319, 15],
        [8, -64, 8],
        [3, 100, 11],
      ]

      testCases.forEach(([x, y, z]) => {
        const block = getBlock(testChunk, x, y, z)
        expect(block).toBe(0)
      })
    })

    it('should return correct block after setting', () => {
      const modifiedChunk = setBlock(testChunk, 5, 100, 10, 42)
      const block = getBlock(modifiedChunk, 5, 100, 10)
      expect(block).toBe(42)
    })
  })

  describe('setBlock', () => {
    it('should set block and return new chunk', () => {
      const newChunk = setBlock(testChunk, 8, 64, 12, 123)

      expect(newChunk).not.toBe(testChunk) // immutable
      expect(getBlock(newChunk, 8, 64, 12)).toBe(123)
      expect(getBlock(testChunk, 8, 64, 12)).toBe(0) // original unchanged
    })

    it('should mark chunk as dirty and modified', async () => {
      // Add small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 1))
      const newChunk = setBlock(testChunk, 0, 0, 0, 1)

      expect(newChunk.isDirty).toBe(true)
      expect(newChunk.metadata.isModified).toBe(true)
      expect(newChunk.metadata.lastUpdate).toBeGreaterThanOrEqual(testChunk.metadata.lastUpdate)
    })

    it('should preserve other blocks', () => {
      let chunk = testChunk
      chunk = setBlock(chunk, 1, 1, 1, 10)
      chunk = setBlock(chunk, 2, 2, 2, 20)
      chunk = setBlock(chunk, 3, 3, 3, 30)

      expect(getBlock(chunk, 1, 1, 1)).toBe(10)
      expect(getBlock(chunk, 2, 2, 2)).toBe(20)
      expect(getBlock(chunk, 3, 3, 3)).toBe(30)
      expect(getBlock(chunk, 0, 0, 0)).toBe(0) // unchanged
    })
  })

  describe('updateHeightMap', () => {
    it('should update height at specified coordinates', async () => {
      // Add small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 1))
      const newChunk = updateHeightMap(testChunk, 5, 10, 128)

      expect(getHeight(newChunk, 5, 10)).toBe(128)
      expect(newChunk.isDirty).toBe(true)
      expect(newChunk.metadata.lastUpdate).toBeGreaterThanOrEqual(testChunk.metadata.lastUpdate)
    })

    it('should preserve other height values', () => {
      let chunk = testChunk
      chunk = updateHeightMap(chunk, 0, 0, 100)
      chunk = updateHeightMap(chunk, 15, 15, 200)
      chunk = updateHeightMap(chunk, 8, 8, 150)

      expect(getHeight(chunk, 0, 0)).toBe(100)
      expect(getHeight(chunk, 15, 15)).toBe(200)
      expect(getHeight(chunk, 8, 8)).toBe(150)
      expect(getHeight(chunk, 1, 1)).toBe(0) // unchanged
    })
  })

  describe('getHeight', () => {
    it('should return 0 for newly created chunk', () => {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          expect(getHeight(testChunk, x, z)).toBe(0)
        }
      }
    })

    it('should throw for out-of-bounds coordinates', () => {
      const invalidCases = [
        [-1, 0],
        [16, 0],
        [0, -1],
        [0, 16],
        [-1, -1],
        [16, 16],
      ]

      invalidCases.forEach(([x, z]) => {
        if (x !== undefined && z !== undefined) {
          expect(() => getHeight(testChunk, x, z)).toThrow()
        }
      })
    })
  })

  describe('isEmpty', () => {
    it('should return true for newly created chunk', () => {
      expect(isEmpty(testChunk)).toBe(true)
    })

    it('should return false after setting any block', () => {
      const modifiedChunk = setBlock(testChunk, 0, 0, 0, 1)
      expect(isEmpty(modifiedChunk)).toBe(false)
    })

    it('should return true after setting block back to Air', () => {
      let chunk = setBlock(testChunk, 5, 100, 10, 42)
      expect(isEmpty(chunk)).toBe(false)

      chunk = setBlock(chunk, 5, 100, 10, 0)
      expect(isEmpty(chunk)).toBe(true)
    })
  })

  describe('getMemoryUsage', () => {
    it('should calculate memory usage correctly', () => {
      const usage = getMemoryUsage(testChunk)
      const expectedBlocksSize = testChunk.blocks.byteLength // Uint16Array: 98304 * 2 = 196608 bytes
      const expectedHeightMapSize = testChunk.metadata.heightMap.length * 8 // 256 * 8 = 2048 bytes
      const expectedMetadataSize = 1024 // estimated

      expect(usage).toBe(expectedBlocksSize + expectedHeightMapSize + expectedMetadataSize)
      expect(usage).toBeGreaterThan(190000) // Should be around 200KB
      expect(usage).toBeLessThan(210000) // Should be under 210KB
    })

    it('should be consistent across multiple calls', () => {
      const usage1 = getMemoryUsage(testChunk)
      const usage2 = getMemoryUsage(testChunk)
      expect(usage1).toBe(usage2)
    })
  })

  describe('resetChunkData', () => {
    it('should reset chunk to empty state', () => {
      let chunk = setBlock(testChunk, 1, 1, 1, 100)
      chunk = setBlock(chunk, 2, 2, 2, 200)
      chunk = updateHeightMap(chunk, 5, 5, 150)

      const newPosition = { x: 10, z: 20 }
      const resetChunk = resetChunkData(chunk, newPosition)

      expect(resetChunk.position).toEqual(newPosition)
      expect(isEmpty(resetChunk)).toBe(true)
      expect(resetChunk.isDirty).toBe(false)
      expect(resetChunk.metadata.isModified).toBe(false)
      expect(resetChunk.metadata.biome).toBe('plains')
      expect(getHeight(resetChunk, 5, 5)).toBe(0)
    })

    it('should reuse the same Uint16Array for memory efficiency', () => {
      const originalBlocks = testChunk.blocks
      const resetChunk = resetChunkData(testChunk, { x: 100, z: 200 })

      expect(resetChunk.blocks).toBe(originalBlocks) // same reference
      expect(isEmpty(resetChunk)).toBe(true) // but cleared
    })
  })

  describe('performance', () => {
    it('should handle block operations efficiently', () => {
      const iterations = 10000
      const start = performance.now()

      let chunk = testChunk
      for (let i = 0; i < iterations; i++) {
        const x = i % CHUNK_SIZE
        const y = (i % 100) - 64 + 100 // Valid Y range
        const z = (i * 2) % CHUNK_SIZE
        const blockId = (i % 255) + 1 // 1-255, avoid 0 which is Air

        chunk = setBlock(chunk, x, y, z, blockId)
        const retrieved = getBlock(chunk, x, y, z)
        expect(retrieved).toBe(blockId)
      }

      const end = performance.now()
      const timePerOperation = (end - start) / (iterations * 2) // set + get

      // Should be very fast (less than 0.1ms per operation)
      expect(timePerOperation).toBeLessThan(0.1)
    })

    it('should maintain O(1) block access time', () => {
      // Test different chunk sizes to ensure O(1) scaling
      const sizes = [1000, 5000, 10000] as const
      const times: number[] = []

      for (const size of sizes) {
        let chunk = testChunk
        const start = performance.now()

        for (let i = 0; i < size; i++) {
          const x = i % CHUNK_SIZE
          const y = (i % 100) + 50 // Valid Y range
          const z = (i * 3) % CHUNK_SIZE
          chunk = setBlock(chunk, x, y, z, i % 256)
        }

        const end = performance.now()
        const timePerOperation = (end - start) / size
        if (timePerOperation !== undefined) {
          times.push(timePerOperation)
        }
      }

      // Time per operation should not increase significantly with size
      const lastTime = times[times.length - 1]
      const firstTime = times[0]
      if (lastTime !== undefined && firstTime !== undefined) {
        const ratioLastToFirst = lastTime / firstTime
        expect(ratioLastToFirst).toBeLessThan(2.0) // Allow some variance but should be roughly constant
      }
    })

    it('should handle full chunk population efficiently', () => {
      const start = performance.now()

      let chunk = testChunk
      let operationCount = 0

      // Set every 8th block to test realistic usage
      for (let x = 0; x < CHUNK_SIZE; x += 4) {
        for (let y = CHUNK_MIN_Y; y <= CHUNK_MAX_Y; y += 16) {
          for (let z = 0; z < CHUNK_SIZE; z += 4) {
            chunk = setBlock(chunk, x, y, z, 1)
            operationCount++
          }
        }
      }

      const end = performance.now()
      const totalTime = end - start
      const timePerOperation = totalTime / operationCount

      // Should handle many operations quickly
      expect(operationCount).toBeGreaterThan(300)
      expect(timePerOperation).toBeLessThan(0.1) // Less than 0.1ms per operation
      expect(totalTime).toBeLessThan(1000) // Total time under 1 second
    })

    it('should maintain memory efficiency under load', () => {
      let chunk = testChunk
      const initialUsage = getMemoryUsage(chunk)

      // Fill chunk with various blocks
      for (let x = 0; x < CHUNK_SIZE; x += 4) {
        for (let y = CHUNK_MIN_Y; y <= CHUNK_MAX_Y; y += 16) {
          for (let z = 0; z < CHUNK_SIZE; z += 4) {
            chunk = setBlock(chunk, x, y, z, (x + y + z) % 256)
          }
        }
      }

      const finalUsage = getMemoryUsage(chunk)

      // Memory usage should not increase significantly (blocks are pre-allocated)
      expect(finalUsage).toBe(initialUsage)
      expect(finalUsage).toBeLessThan(220000) // Should stay under 220KB
    })
  })
})
