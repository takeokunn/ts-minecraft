import { describe, it, expect, beforeEach } from 'vitest'
import { Effect } from 'effect'
import {
  ChunkBoundsError,
  ChunkSerializationError,
  type Chunk,
  createChunk,
  createEmptyChunk,
} from '../Chunk.js'
import { createChunkData, CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_MIN_Y, CHUNK_MAX_Y } from '../ChunkData.js'
import type { ChunkPosition } from '../ChunkPosition.js'

describe('Chunk', () => {
  let testPosition: ChunkPosition
  let testChunk: Chunk

  beforeEach(() => {
    testPosition = { x: 10, z: -5 }
    testChunk = createEmptyChunk(testPosition)
  })

  describe('createEmptyChunk', () => {
    it('should create an empty chunk at specified position', () => {
      const chunk = createEmptyChunk(testPosition)

      expect(chunk.position).toEqual(testPosition)
      expect(chunk.blocks).toBeInstanceOf(Uint16Array)
      expect(chunk.blocks.length).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      expect(chunk.isDirty).toBe(false)
      expect(chunk.isEmpty()).toBe(true)
    })

    it('should initialize with default metadata', () => {
      const chunk = createEmptyChunk(testPosition)

      expect(chunk.metadata.biome).toBe('plains')
      expect(chunk.metadata.lightLevel).toBe(15)
      expect(chunk.metadata.isModified).toBe(false)
      expect(chunk.metadata.heightMap).toHaveLength(CHUNK_SIZE * CHUNK_SIZE)
    })
  })

  describe('createChunk', () => {
    it('should create chunk from ChunkData', () => {
      const chunkData = createChunkData(testPosition, { biome: 'desert', lightLevel: 8 })
      const chunk = createChunk(chunkData)

      expect(chunk.position).toEqual(testPosition)
      expect(chunk.metadata.biome).toBe('desert')
      expect(chunk.metadata.lightLevel).toBe(8)
    })
  })

  describe('getBlock', () => {
    it('should return Air (0) for empty chunk', async () => {
      const testCases: Array<[number, number, number]> = [
        [0, 0, 0],
        [15, 319, 15],
        [8, -64, 8],
        [7, 100, 12],
      ]

      for (const [x, y, z] of testCases) {
        const result = await Effect.runPromise(testChunk.getBlock(x, y, z))
        expect(result).toBe(0)
      }
    })

    it('should return correct block after setting', async () => {
      const modifiedChunk = await Effect.runPromise(testChunk.setBlock(5, 100, 10, 42))
      const block = await Effect.runPromise(modifiedChunk.getBlock(5, 100, 10))
      expect(block).toBe(42)
    })

    it('should fail for invalid coordinates', async () => {
      const invalidCases = [
        [-1, 0, 0],
        [16, 0, 0],
        [0, -65, 0],
        [0, 320, 0],
        [0, 0, -1],
        [0, 0, 16],
      ]

      for (const [x, y, z] of invalidCases) {
        if (x !== undefined && y !== undefined && z !== undefined) {
          const result = Effect.runPromise(testChunk.getBlock(x, y, z))
          await expect(result).rejects.toThrow()
        }
      }
    })
  })

  describe('setBlock', () => {
    it('should set block and return new chunk', async () => {
      const newChunk = await Effect.runPromise(testChunk.setBlock(8, 64, 12, 123))

      expect(newChunk).not.toBe(testChunk) // immutable
      const block = await Effect.runPromise(newChunk.getBlock(8, 64, 12))
      expect(block).toBe(123)

      // Original chunk unchanged
      const originalBlock = await Effect.runPromise(testChunk.getBlock(8, 64, 12))
      expect(originalBlock).toBe(0)
    })

    it('should mark chunk as dirty and modified', async () => {
      // Add small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1))
      const newChunk = await Effect.runPromise(testChunk.setBlock(0, 0, 0, 1))

      expect(newChunk.isDirty).toBe(true)
      expect(newChunk.metadata.isModified).toBe(true)
      expect(newChunk.metadata.lastUpdate).toBeGreaterThanOrEqual(testChunk.metadata.lastUpdate)
    })

    it('should fail with ChunkBoundsError for invalid coordinates', async () => {
      const invalidCases = [
        [-1, 0, 0, 1],
        [16, 0, 0, 1],
        [0, -65, 0, 1],
        [0, 320, 0, 1],
        [0, 0, -1, 1],
        [0, 0, 16, 1],
      ]

      for (const [x, y, z, blockId] of invalidCases) {
        if (x !== undefined && y !== undefined && z !== undefined && blockId !== undefined) {
          const result = Effect.runPromise(testChunk.setBlock(x, y, z, blockId))
          await expect(result).rejects.toThrow()
        }
      }
    })

    it('should handle multiple sequential operations', async () => {
      let chunk = testChunk

      // Chain multiple setBlock operations
      chunk = await Effect.runPromise(chunk.setBlock(1, 1, 1, 10))
      chunk = await Effect.runPromise(chunk.setBlock(2, 2, 2, 20))
      chunk = await Effect.runPromise(chunk.setBlock(3, 3, 3, 30))

      const block1 = await Effect.runPromise(chunk.getBlock(1, 1, 1))
      const block2 = await Effect.runPromise(chunk.getBlock(2, 2, 2))
      const block3 = await Effect.runPromise(chunk.getBlock(3, 3, 3))

      expect(block1).toBe(10)
      expect(block2).toBe(20)
      expect(block3).toBe(30)
    })
  })

  describe('fillRegion', () => {
    it('should fill rectangular region with specified block', async () => {
      const chunk = await Effect.runPromise(
        testChunk.fillRegion(5, 60, 5, 10, 65, 10, 42)
      )

      // Check corners and center of filled region
      const testPoints = [
        [5, 60, 5],
        [10, 65, 10],
        [7, 62, 8],
        [5, 65, 10],
        [10, 60, 5],
      ]

      for (const [x, y, z] of testPoints) {
        if (x !== undefined && y !== undefined && z !== undefined) {
          const block = await Effect.runPromise(chunk.getBlock(x, y, z))
          expect(block).toBe(42)
        }
      }

      // Check outside region is still empty
      const outsidePoints = [
        [4, 60, 5],
        [11, 65, 10],
        [5, 59, 5],
        [5, 66, 5],
      ]

      for (const [x, y, z] of outsidePoints) {
        if (x !== undefined && y !== undefined && z !== undefined) {
          const block = await Effect.runPromise(chunk.getBlock(x, y, z))
          expect(block).toBe(0)
        }
      }
    })

    it('should fail with ChunkBoundsError for invalid region', async () => {
      const invalidRegions = [
        [-1, 0, 0, 5, 5, 5, 1], // startX < 0
        [0, 0, 0, 16, 5, 5, 1], // endX >= CHUNK_SIZE
        [0, -65, 0, 5, 5, 5, 1], // startY < CHUNK_MIN_Y
        [0, 0, 0, 5, 320, 5, 1], // endY > CHUNK_MAX_Y
        [0, 0, -1, 5, 5, 5, 1], // startZ < 0
        [0, 0, 0, 5, 5, 16, 1], // endZ >= CHUNK_SIZE
      ]

      for (const [sx, sy, sz, ex, ey, ez, blockId] of invalidRegions) {
        if (sx !== undefined && sy !== undefined && sz !== undefined &&
            ex !== undefined && ey !== undefined && ez !== undefined && blockId !== undefined) {
          const result = Effect.runPromise(testChunk.fillRegion(sx, sy, sz, ex, ey, ez, blockId))
          await expect(result).rejects.toThrow()
        }
      }
    })

    it('should handle single block region', async () => {
      const chunk = await Effect.runPromise(
        testChunk.fillRegion(8, 100, 8, 8, 100, 8, 99)
      )

      const block = await Effect.runPromise(chunk.getBlock(8, 100, 8))
      expect(block).toBe(99)
    })
  })

  describe('serialize and deserialize', () => {
    it('should serialize and deserialize empty chunk', async () => {
      const serialized = await Effect.runPromise(testChunk.serialize())
      const deserialized = await Effect.runPromise(testChunk.deserialize(serialized))

      expect(deserialized.position).toEqual(testChunk.position)
      expect(deserialized.isEmpty()).toBe(true)
      expect(deserialized.metadata.lastUpdate).toBe(testChunk.metadata.lastUpdate)
    })

    it('should serialize and deserialize chunk with blocks', async () => {
      let chunk = testChunk
      chunk = await Effect.runPromise(chunk.setBlock(5, 100, 10, 42))
      chunk = await Effect.runPromise(chunk.setBlock(8, 150, 3, 100))
      chunk = await Effect.runPromise(chunk.setBlock(15, 200, 15, 255))

      const serialized = await Effect.runPromise(chunk.serialize())
      const deserialized = await Effect.runPromise(chunk.deserialize(serialized))

      const block1 = await Effect.runPromise(deserialized.getBlock(5, 100, 10))
      const block2 = await Effect.runPromise(deserialized.getBlock(8, 150, 3))
      const block3 = await Effect.runPromise(deserialized.getBlock(15, 200, 15))

      expect(block1).toBe(42)
      expect(block2).toBe(100)
      expect(block3).toBe(255)
    })

    it('should preserve metadata during serialization', async () => {
      const chunk = testChunk

      const serialized = await Effect.runPromise(chunk.serialize())
      const deserialized = await Effect.runPromise(chunk.deserialize(serialized))

      expect(deserialized.metadata.biome).toBe(chunk.metadata.biome)
      expect(deserialized.metadata.lightLevel).toBe(chunk.metadata.lightLevel)
      expect(deserialized.metadata.heightMap).toEqual(chunk.metadata.heightMap)
    })

    it('should handle serialization errors gracefully', async () => {
      // Test with invalid data that would cause serialization to fail
      const corruptedData = new ArrayBuffer(10) // Too small

      const result = Effect.runPromise(testChunk.deserialize(corruptedData))
      await expect(result).rejects.toThrow()
    })
  })

  describe('compress and decompress', () => {
    it('should compress and decompress empty chunk', async () => {
      const compressed = await Effect.runPromise(testChunk.compress())
      const decompressed = await Effect.runPromise(testChunk.decompress(compressed))

      expect(decompressed.isEmpty()).toBe(true)
      expect(decompressed.position).toEqual(testChunk.position)
    })

    it('should compress and decompress chunk with blocks', async () => {
      let chunk = testChunk
      chunk = await Effect.runPromise(chunk.setBlock(1, 1, 1, 10))
      chunk = await Effect.runPromise(chunk.setBlock(2, 2, 2, 20))
      chunk = await Effect.runPromise(chunk.fillRegion(10, 100, 10, 12, 102, 12, 50))

      const compressed = await Effect.runPromise(chunk.compress())
      const decompressed = await Effect.runPromise(chunk.decompress(compressed))

      const block1 = await Effect.runPromise(decompressed.getBlock(1, 1, 1))
      const block2 = await Effect.runPromise(decompressed.getBlock(2, 2, 2))
      const block3 = await Effect.runPromise(decompressed.getBlock(11, 101, 11))

      expect(block1).toBe(10)
      expect(block2).toBe(20)
      expect(block3).toBe(50)
    })

    it('should achieve good compression ratio for empty chunks', async () => {
      const originalSize = testChunk.getMemoryUsage()
      const compressed = await Effect.runPromise(testChunk.compress())

      const compressionRatio = compressed.byteLength / originalSize
      expect(compressionRatio).toBeLessThan(0.1) // Should compress to less than 10% of original
    })

    it('should achieve reasonable compression for sparse chunks', async () => {
      let chunk = testChunk

      // Add some sparse blocks
      for (let i = 0; i < 100; i++) {
        const x = (i * 7) % CHUNK_SIZE
        const y = (i * 11) % 200 + 50
        const z = (i * 13) % CHUNK_SIZE
        chunk = await Effect.runPromise(chunk.setBlock(x, y, z, 1))
      }

      const originalSize = chunk.getMemoryUsage()
      const compressed = await Effect.runPromise(chunk.compress())

      const compressionRatio = compressed.byteLength / originalSize
      expect(compressionRatio).toBeLessThan(0.5) // Should compress to less than 50%
    })
  })

  describe('isEmpty', () => {
    it('should return true for empty chunk', () => {
      expect(testChunk.isEmpty()).toBe(true)
    })

    it('should return false after setting any block', async () => {
      const chunk = await Effect.runPromise(testChunk.setBlock(0, 0, 0, 1))
      expect(chunk.isEmpty()).toBe(false)
    })

    it('should return true after clearing all blocks', async () => {
      let chunk = await Effect.runPromise(testChunk.setBlock(5, 100, 10, 42))
      expect(chunk.isEmpty()).toBe(false)

      chunk = await Effect.runPromise(chunk.setBlock(5, 100, 10, 0))
      expect(chunk.isEmpty()).toBe(true)
    })
  })

  describe('getMemoryUsage', () => {
    it('should return consistent memory usage', () => {
      const usage1 = testChunk.getMemoryUsage()
      const usage2 = testChunk.getMemoryUsage()
      expect(usage1).toBe(usage2)
    })

    it('should stay within expected range', () => {
      const usage = testChunk.getMemoryUsage()
      expect(usage).toBeGreaterThan(190000) // Around 200KB
      expect(usage).toBeLessThan(210000)
    })

    it('should not change significantly after setting blocks', async () => {
      const originalUsage = testChunk.getMemoryUsage()

      let chunk = testChunk
      for (let i = 0; i < 1000; i++) {
        const x = i % CHUNK_SIZE
        const y = (i % 100) + 50
        const z = (i * 2) % CHUNK_SIZE
        chunk = await Effect.runPromise(chunk.setBlock(x, y, z, i % 256))
      }

      const newUsage = chunk.getMemoryUsage()
      expect(newUsage).toBe(originalUsage) // Pre-allocated arrays
    })
  })

  describe('clone', () => {
    it('should create independent copy', async () => {
      let originalChunk = await Effect.runPromise(testChunk.setBlock(5, 100, 10, 42))
      const clonedChunk = originalChunk.clone()

      expect(clonedChunk).not.toBe(originalChunk)
      expect(clonedChunk.position).toEqual(originalChunk.position)
      expect(clonedChunk.isDirty).toBe(originalChunk.isDirty)

      const originalBlock = await Effect.runPromise(originalChunk.getBlock(5, 100, 10))
      const clonedBlock = await Effect.runPromise(clonedChunk.getBlock(5, 100, 10))
      expect(clonedBlock).toBe(originalBlock)
    })

    it('should be independent after modifications', async () => {
      let originalChunk = await Effect.runPromise(testChunk.setBlock(1, 1, 1, 10))
      const clonedChunk = originalChunk.clone()

      // Modify original
      originalChunk = await Effect.runPromise(originalChunk.setBlock(2, 2, 2, 20))

      // Clone should be unchanged
      const clonedBlock1 = await Effect.runPromise(clonedChunk.getBlock(1, 1, 1))
      const clonedBlock2 = await Effect.runPromise(clonedChunk.getBlock(2, 2, 2))

      expect(clonedBlock1).toBe(10) // Original value
      expect(clonedBlock2).toBe(0) // Not modified in clone
    })
  })

  describe('error handling', () => {
    it('should handle ChunkBoundsError correctly', async () => {
      const invalidOperations = [
        () => testChunk.getBlock(-1, 0, 0),
        () => testChunk.setBlock(16, 0, 0, 1),
        () => testChunk.fillRegion(-1, 0, 0, 5, 5, 5, 1),
      ]

      for (const operation of invalidOperations) {
        const result = Effect.runPromise(operation())
        await expect(result).rejects.toThrow()
      }
    })

    it('should provide meaningful error messages', async () => {
      try {
        await Effect.runPromise(testChunk.getBlock(-1, 0, 0))
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('(-1, 0, 0)')
      }
    })
  })

  describe('performance', () => {
    it('should handle many operations efficiently', async () => {
      const iterations = 1000
      const start = performance.now()

      let chunk = testChunk
      for (let i = 0; i < iterations; i++) {
        const x = i % CHUNK_SIZE
        const y = (i % 100) + 50
        const z = (i * 2) % CHUNK_SIZE
        const blockId = (i % 255) + 1 // 1-255, avoid 0 which is Air

        chunk = await Effect.runPromise(chunk.setBlock(x, y, z, blockId))
        const retrieved = await Effect.runPromise(chunk.getBlock(x, y, z))
        expect(retrieved).toBe(blockId)
      }

      const end = performance.now()
      const timePerOperation = (end - start) / (iterations * 2)

      expect(timePerOperation).toBeLessThan(0.1) // Less than 0.1ms per operation
    })

    it('should handle region fills efficiently', async () => {
      const start = performance.now()

      let chunk = testChunk
      const regions = [
        [0, 0, 0, 5, 5, 5, 1],
        [10, 50, 10, 15, 55, 15, 2],
        [5, 100, 5, 10, 105, 10, 3],
        [0, 200, 0, 15, 205, 15, 4],
      ]

      for (const region of regions) {
        const [sx, sy, sz, ex, ey, ez, blockId] = region
        chunk = await Effect.runPromise(chunk.fillRegion(sx, sy, sz, ex, ey, ez, blockId))
      }

      const end = performance.now()
      expect(end - start).toBeLessThan(100) // Should complete in under 100ms
    })

    it('should handle serialization efficiently', async () => {
      // Fill chunk with some data
      let chunk = testChunk
      for (let i = 0; i < 1000; i++) {
        const x = i % CHUNK_SIZE
        const y = (i % 100) + 50
        const z = (i * 2) % CHUNK_SIZE
        chunk = await Effect.runPromise(chunk.setBlock(x, y, z, i % 256))
      }

      const start = performance.now()
      const serialized = await Effect.runPromise(chunk.serialize())
      const deserialized = await Effect.runPromise(chunk.deserialize(serialized))
      const end = performance.now()

      expect(end - start).toBeLessThan(50) // Should complete in under 50ms
      expect(deserialized.position).toEqual(chunk.position)
    })
  })
})