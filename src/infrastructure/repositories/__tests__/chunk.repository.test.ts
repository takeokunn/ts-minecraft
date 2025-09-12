/**
 * Chunk Repository Tests
 * 
 * Comprehensive test suite for ChunkRepository implementation using Effect-TS patterns.
 * Tests all chunk operations, metadata management, spatial queries, and performance features.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as Effect from 'effect/Effect'
import * as TestContext from 'effect/TestContext'
import * as Option from 'effect/Option'
import * as HashMap from 'effect/HashMap'
import * as Array from 'effect/Array'

import { 
  ChunkRepository, 
  ChunkRepositoryLive, 
  type ChunkMetadata, 
  type ChunkQueryOptions,
  type ChunkChange 
} from '../chunk.repository'
import { Chunk } from '@domain/entities/components/world/chunk'
import { BlockType } from '@domain/value-objects/block-type.value-object'
import { expectEffect } from '../../../../tests/setup/infrastructure.setup'

// Type definitions for missing imports
export interface ChunkCoordinate {
  readonly x: number
  readonly z: number
}

// Test data factories
const createTestChunk = (x: number = 0, z: number = 0, blocks?: BlockType[]): Chunk => ({
  chunkX: x,
  chunkZ: z,
  blocks: blocks || Array(65536).fill('stone' as BlockType), // 16x256x16 = 65536 blocks
  entities: [],
  lightData: new Uint8Array(65536),
  heightMap: new Uint16Array(256), // 16x16
  biomes: Array(256).fill('plains'),
  metadata: {
    generatedAt: Date.now(),
    version: 1,
    seed: 12345
  }
})

const createTestCoordinate = (x: number = 0, z: number = 0): ChunkCoordinate => ({ x, z })

// Helper to run effects in test context
const runTest = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(effect.pipe(
    Effect.provide(ChunkRepositoryLive),
    Effect.provide(TestContext.TestContext)
  ))

describe('ChunkRepository', () => {
  describe('Basic Chunk Operations', () => {
    it('should save and retrieve a chunk', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const testChunk = createTestChunk(1, 1)
        const coordinate = createTestCoordinate(1, 1)

        // Save chunk
        yield* repo.setChunk(testChunk)

        // Retrieve chunk
        const retrieved = yield* repo.getChunk(coordinate)

        expect(Option.isSome(retrieved)).toBe(true)
        if (Option.isSome(retrieved)) {
          expect(retrieved.value).toEqual(testChunk)
        }
      }))
    })

    it('should return None for non-existent chunk', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const coordinate = createTestCoordinate(99, 99)

        const retrieved = yield* repo.getChunk(coordinate)

        expect(Option.isNone(retrieved)).toBe(true)
      }))
    })

    it('should check chunk existence correctly', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const testChunk = createTestChunk(2, 2)
        const coordinate = createTestCoordinate(2, 2)

        // Initially should not exist
        const existsBefore = yield* repo.hasChunk(coordinate)
        expect(existsBefore).toBe(false)

        // Save chunk
        yield* repo.setChunk(testChunk)

        // Now should exist
        const existsAfter = yield* repo.hasChunk(coordinate)
        expect(existsAfter).toBe(true)
      }))
    })

    it('should remove chunks correctly', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const testChunk = createTestChunk(3, 3)
        const coordinate = createTestCoordinate(3, 3)

        // Save chunk
        yield* repo.setChunk(testChunk)
        expect(yield* repo.hasChunk(coordinate)).toBe(true)

        // Remove chunk
        const removed = yield* repo.removeChunk(coordinate)
        expect(removed).toBe(true)

        // Should no longer exist
        expect(yield* repo.hasChunk(coordinate)).toBe(false)

        // Removing non-existent chunk should return false
        const removedAgain = yield* repo.removeChunk(coordinate)
        expect(removedAgain).toBe(false)
      }))
    })
  })

  describe('Chunk Metadata Management', () => {
    it('should create and retrieve chunk metadata', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const testChunk = createTestChunk(4, 4)
        const coordinate = createTestCoordinate(4, 4)

        yield* repo.setChunk(testChunk)

        const metadata = yield* repo.getChunkMetadata(coordinate)
        expect(Option.isSome(metadata)).toBe(true)

        if (Option.isSome(metadata)) {
          const meta = metadata.value
          expect(meta.coordinate).toEqual(coordinate)
          expect(meta.blockCount).toBe(65536)
          expect(meta.generationStage).toBe('complete')
          expect(meta.isDirty).toBe(false)
          expect(meta.version).toBe(1)
        }
      }))
    })

    it('should update chunk metadata correctly', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const testChunk = createTestChunk(5, 5)
        const coordinate = createTestCoordinate(5, 5)

        yield* repo.setChunk(testChunk)

        const updated = yield* repo.updateChunkMetadata(coordinate, (meta) => ({
          ...meta,
          generationStage: 'terrain' as const,
          nonAirBlockCount: 1000
        }))
        expect(updated).toBe(true)

        const metadata = yield* repo.getChunkMetadata(coordinate)
        expect(Option.isSome(metadata)).toBe(true)

        if (Option.isSome(metadata)) {
          expect(metadata.value.generationStage).toBe('terrain')
          expect(metadata.value.nonAirBlockCount).toBe(1000)
        }
      }))
    })

    it('should handle dirty chunk marking', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const testChunk = createTestChunk(6, 6)
        const coordinate = createTestCoordinate(6, 6)

        yield* repo.setChunk(testChunk)

        // Mark chunk as dirty
        yield* repo.markChunkDirty(coordinate)

        const metadata = yield* repo.getChunkMetadata(coordinate)
        expect(Option.isSome(metadata)).toBe(true)

        if (Option.isSome(metadata)) {
          expect(metadata.value.isDirty).toBe(true)
        }

        // Mark chunk as clean
        yield* repo.markChunkClean(coordinate)

        const metadataAfter = yield* repo.getChunkMetadata(coordinate)
        if (Option.isSome(metadataAfter)) {
          expect(metadataAfter.value.isDirty).toBe(false)
        }
      }))
    })
  })

  describe('Bulk Operations', () => {
    it('should handle bulk chunk retrieval', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const chunks = [
          createTestChunk(10, 10),
          createTestChunk(11, 11),
          createTestChunk(12, 12)
        ]
        const coordinates = [
          createTestCoordinate(10, 10),
          createTestCoordinate(11, 11),
          createTestCoordinate(12, 12),
          createTestCoordinate(99, 99) // Non-existent
        ]

        // Save chunks
        for (const chunk of chunks) {
          yield* repo.setChunk(chunk)
        }

        // Bulk retrieve
        const retrieved = yield* repo.getChunks(coordinates)

        expect(HashMap.size(retrieved)).toBe(3) // Should only get existing chunks
        expect(HashMap.has(retrieved, '10,10')).toBe(true)
        expect(HashMap.has(retrieved, '11,11')).toBe(true)
        expect(HashMap.has(retrieved, '12,12')).toBe(true)
        expect(HashMap.has(retrieved, '99,99')).toBe(false)
      }))
    })

    it('should handle bulk chunk saving', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const chunks = [
          createTestChunk(20, 20),
          createTestChunk(21, 21),
          createTestChunk(22, 22)
        ]

        yield* repo.setChunks(chunks)

        // Verify all chunks were saved
        for (const chunk of chunks) {
          const coordinate = createTestCoordinate(chunk.chunkX, chunk.chunkZ)
          const exists = yield* repo.hasChunk(coordinate)
          expect(exists).toBe(true)
        }
      }))
    })

    it('should handle bulk chunk removal', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const chunks = [
          createTestChunk(30, 30),
          createTestChunk(31, 31),
          createTestChunk(32, 32)
        ]
        const coordinates = chunks.map(c => createTestCoordinate(c.chunkX, c.chunkZ))

        // Save chunks
        yield* repo.setChunks(chunks)

        // Remove chunks
        const removedCount = yield* repo.removeChunks([
          ...coordinates,
          createTestCoordinate(99, 99) // Non-existent
        ])

        expect(removedCount).toBe(3) // Only existing chunks should be counted

        // Verify chunks were removed
        for (const coordinate of coordinates) {
          const exists = yield* repo.hasChunk(coordinate)
          expect(exists).toBe(false)
        }
      }))
    })
  })

  describe('Spatial Queries', () => {
    it('should find chunks within radius', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const center = createTestCoordinate(50, 50)
        
        // Create chunks at different distances
        const chunks = [
          createTestChunk(50, 50), // Distance 0
          createTestChunk(51, 50), // Distance 1
          createTestChunk(52, 50), // Distance 2
          createTestChunk(55, 50)  // Distance 5
        ]

        yield* repo.setChunks(chunks)

        // Find chunks within radius 2
        const nearbyChunks = yield* repo.getChunksInRadius(center, 2)

        expect(nearbyChunks.length).toBe(3) // Should exclude the chunk at distance 5
        
        // Verify chunks are sorted by distance
        expect(nearbyChunks[0].chunkX).toBe(50) // Closest
        expect(nearbyChunks[0].chunkZ).toBe(50)
      }))
    })

    it('should find chunks in rectangular area', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        
        // Create chunks in a grid
        const chunks = [
          createTestChunk(60, 60),
          createTestChunk(61, 60),
          createTestChunk(60, 61),
          createTestChunk(61, 61),
          createTestChunk(65, 65) // Outside area
        ]

        yield* repo.setChunks(chunks)

        // Find chunks in area (60,60) to (61,61)
        const areaChunks = yield* repo.getChunksInArea(60, 60, 61, 61)

        expect(areaChunks.length).toBe(4)
        expect(areaChunks.some(c => c.chunkX === 65 && c.chunkZ === 65)).toBe(false)
      }))
    })

    it('should handle complex chunk queries', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const chunks = [
          createTestChunk(70, 70),
          createTestChunk(71, 71),
          createTestChunk(72, 72)
        ]

        yield* repo.setChunks(chunks)

        // Mark one chunk as dirty
        yield* repo.markChunkDirty(createTestCoordinate(71, 71))

        // Set generation stages
        yield* repo.setGenerationStage(createTestCoordinate(70, 70), 'terrain')
        yield* repo.setGenerationStage(createTestCoordinate(72, 72), 'features')

        // Query dirty chunks only
        const dirtyChunks = yield* repo.findChunks({
          onlyDirty: true
        })
        expect(dirtyChunks.length).toBe(1)
        expect(dirtyChunks[0].chunkX).toBe(71)

        // Query by generation stage
        const terrainChunks = yield* repo.findChunks({
          generationStage: 'terrain'
        })
        expect(terrainChunks.length).toBe(1)
        expect(terrainChunks[0].chunkX).toBe(70)
      }))
    })
  })

  describe('Block-Level Operations', () => {
    it('should handle individual block access', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const testChunk = createTestChunk(80, 80)
        const coordinate = createTestCoordinate(80, 80)

        yield* repo.setChunk(testChunk)

        // Get block
        const block = yield* repo.getBlock(coordinate, 0)
        expect(Option.isSome(block)).toBe(true)
        if (Option.isSome(block)) {
          expect(block.value).toBe('stone')
        }

        // Set block
        const setResult = yield* repo.setBlock(coordinate, 0, 'dirt' as BlockType)
        expect(setResult).toBe(true)

        // Verify block was changed
        const changedBlock = yield* repo.getBlock(coordinate, 0)
        expect(Option.isSome(changedBlock)).toBe(true)
        if (Option.isSome(changedBlock)) {
          expect(changedBlock.value).toBe('dirt')
        }

        // Chunk should be marked dirty
        const metadata = yield* repo.getChunkMetadata(coordinate)
        if (Option.isSome(metadata)) {
          expect(metadata.value.isDirty).toBe(true)
        }
      }))
    })

    it('should handle bulk block updates', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const testChunk = createTestChunk(81, 81)
        const coordinate = createTestCoordinate(81, 81)

        yield* repo.setChunk(testChunk)

        // Update multiple blocks
        const updates = [
          { index: 0, blockType: 'dirt' as BlockType },
          { index: 1, blockType: 'grass' as BlockType },
          { index: 2, blockType: 'water' as BlockType }
        ]

        const updateResult = yield* repo.updateBlocks(coordinate, updates)
        expect(updateResult).toBe(true)

        // Verify blocks were changed
        for (const update of updates) {
          const block = yield* repo.getBlock(coordinate, update.index)
          expect(Option.isSome(block)).toBe(true)
          if (Option.isSome(block)) {
            expect(block.value).toBe(update.blockType)
          }
        }
      }))
    })

    it('should handle out-of-bounds block access gracefully', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const testChunk = createTestChunk(82, 82)
        const coordinate = createTestCoordinate(82, 82)

        yield* repo.setChunk(testChunk)

        // Try to access invalid block index
        const block = yield* repo.getBlock(coordinate, -1)
        expect(Option.isNone(block)).toBe(true)

        const block2 = yield* repo.getBlock(coordinate, 100000)
        expect(Option.isNone(block2)).toBe(true)

        // Try to set invalid block index
        const setResult = yield* repo.setBlock(coordinate, -1, 'dirt' as BlockType)
        expect(setResult).toBe(false)

        const setResult2 = yield* repo.setBlock(coordinate, 100000, 'dirt' as BlockType)
        expect(setResult2).toBe(false)
      }))
    })
  })

  describe('Change Tracking', () => {
    it('should track block changes', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const testChunk = createTestChunk(90, 90)
        const coordinate = createTestCoordinate(90, 90)

        yield* repo.setChunk(testChunk)

        // Make some changes
        yield* repo.setBlock(coordinate, 0, 'dirt' as BlockType)
        yield* repo.setBlock(coordinate, 1, 'grass' as BlockType)

        // Get changes
        const changes = yield* repo.getChunkChanges(coordinate)

        expect(changes.length).toBe(2)
        expect(changes[0].blockIndex).toBe(0)
        expect(changes[0].newBlockType).toBe('dirt')
        expect(changes[0].previousBlockType).toBe('stone')

        expect(changes[1].blockIndex).toBe(1)
        expect(changes[1].newBlockType).toBe('grass')
        expect(changes[1].previousBlockType).toBe('stone')
      }))
    })

    it('should filter changes by time', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const testChunk = createTestChunk(91, 91)
        const coordinate = createTestCoordinate(91, 91)

        yield* repo.setChunk(testChunk)

        const beforeTime = Date.now()
        
        // Make a change
        yield* repo.setBlock(coordinate, 0, 'dirt' as BlockType)

        // Get changes since before the change
        const changes = yield* repo.getChunkChanges(undefined, beforeTime)

        expect(changes.length).toBe(1)
        expect(changes[0].timestamp).toBeGreaterThanOrEqual(beforeTime)
      }))
    })

    it('should clear change history', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const testChunk = createTestChunk(92, 92)
        const coordinate = createTestCoordinate(92, 92)

        yield* repo.setChunk(testChunk)

        // Make changes
        yield* repo.setBlock(coordinate, 0, 'dirt' as BlockType)
        yield* repo.setBlock(coordinate, 1, 'grass' as BlockType)

        // Clear history
        const clearedCount = yield* repo.clearChangeHistory()
        expect(clearedCount).toBe(2)

        // Should have no changes now
        const changes = yield* repo.getChunkChanges()
        expect(changes.length).toBe(0)
      }))
    })
  })

  describe('Generation Stage Management', () => {
    it('should manage generation stages', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const testChunk = createTestChunk(100, 100)
        const coordinate = createTestCoordinate(100, 100)

        yield* repo.setChunk(testChunk)

        // Set generation stage
        yield* repo.setGenerationStage(coordinate, 'terrain')

        // Get chunks by generation stage
        const terrainChunks = yield* repo.getChunksByGenerationStage('terrain')
        expect(terrainChunks.length).toBe(1)
        expect(terrainChunks[0]).toEqual(coordinate)

        // Get incomplete chunks
        const incompleteChunks = yield* repo.getIncompleteChunks()
        expect(incompleteChunks.length).toBe(1)
        expect(incompleteChunks[0]).toEqual(coordinate)

        // Set to complete
        yield* repo.setGenerationStage(coordinate, 'complete')

        const incompleteAfter = yield* repo.getIncompleteChunks()
        expect(incompleteAfter.length).toBe(0)
      }))
    })
  })

  describe('Performance and Statistics', () => {
    it('should provide chunk statistics', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const chunks = [
          createTestChunk(110, 110),
          createTestChunk(111, 111),
          createTestChunk(112, 112)
        ]

        yield* repo.setChunks(chunks)
        yield* repo.markChunkDirty(createTestCoordinate(111, 111))

        const stats = yield* repo.getChunkStats()

        expect(stats.totalChunks).toBe(3)
        expect(stats.loadedChunks).toBe(3)
        expect(stats.dirtyChunks).toBe(1)
        expect(stats.memoryUsage).toBeGreaterThan(0)
        expect(stats.chunksByStage.complete).toBe(3)
      }))
    })

    it('should unload old chunks', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const chunks = [
          createTestChunk(120, 120),
          createTestChunk(121, 121)
        ]

        yield* repo.setChunks(chunks)

        // Make one chunk dirty (should not be unloaded)
        yield* repo.markChunkDirty(createTestCoordinate(121, 121))

        // Unload old chunks (maxAge = 0 means all non-dirty chunks)
        const unloadedCount = yield* repo.unloadOldChunks(0)

        expect(unloadedCount).toBe(1) // Only the non-dirty chunk should be unloaded

        // Verify clean chunk was removed but dirty chunk remains
        const exists120 = yield* repo.hasChunk(createTestCoordinate(120, 120))
        const exists121 = yield* repo.hasChunk(createTestCoordinate(121, 121))

        expect(exists120).toBe(false)
        expect(exists121).toBe(true)
      }))
    })

    it('should validate chunk data', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const validChunk = createTestChunk(130, 130)
        const coordinate = createTestCoordinate(130, 130)

        yield* repo.setChunk(validChunk)

        const isValid = yield* repo.validateChunkData(coordinate)
        expect(isValid).toBe(true)

        // Validate non-existent chunk
        const isValidNonExistent = yield* repo.validateChunkData(createTestCoordinate(999, 999))
        expect(isValidNonExistent).toBe(false)
      }))
    })

    it('should compact storage', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const testChunk = createTestChunk(140, 140)

        yield* repo.setChunk(testChunk)
        yield* repo.removeChunk(createTestCoordinate(140, 140))

        // Compact storage should clean up empty regions
        yield* repo.compactStorage()

        // This is more of a smoke test - hard to verify internal state changes
        // but the operation should complete without error
      }))
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent chunk operations gracefully', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const nonExistentCoord = createTestCoordinate(999, 999)

        // Metadata operations on non-existent chunk
        const metadata = yield* repo.getChunkMetadata(nonExistentCoord)
        expect(Option.isNone(metadata)).toBe(true)

        const updateResult = yield* repo.updateChunkMetadata(nonExistentCoord, (m) => m)
        expect(updateResult).toBe(false)

        // Block operations on non-existent chunk
        const block = yield* repo.getBlock(nonExistentCoord, 0)
        expect(Option.isNone(block)).toBe(true)

        const setBlockResult = yield* repo.setBlock(nonExistentCoord, 0, 'dirt' as BlockType)
        expect(setBlockResult).toBe(false)
      }))
    })

    it('should handle concurrent access patterns', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ChunkRepository
        const testChunk = createTestChunk(150, 150)
        const coordinate = createTestCoordinate(150, 150)

        yield* repo.setChunk(testChunk)

        // Simulate concurrent access
        const effects = Array.from({ length: 10 }, (_, i) =>
          repo.setBlock(coordinate, i, 'dirt' as BlockType)
        )

        const results = yield* Effect.all(effects, { concurrency: 5 })

        // All operations should succeed
        expect(results.every(r => r === true)).toBe(true)

        // Verify all blocks were set
        for (let i = 0; i < 10; i++) {
          const block = yield* repo.getBlock(coordinate, i)
          expect(Option.isSome(block)).toBe(true)
          if (Option.isSome(block)) {
            expect(block.value).toBe('dirt')
          }
        }
      }))
    })
  })
})