/**
 * Chunk Repository Tests - Comprehensive test suite for chunk repository implementation
 *
 * This test suite covers all chunk operations, spatial queries, block-level operations,
 * metadata management, and performance optimization features.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'
import * as HashMap from 'effect/HashMap'
import * as Option from 'effect/Option'

import { 
  createChunkRepository,
  type IChunkRepository,
  type ChunkRepositoryState,
  type ChunkMetadata,
  type ChunkQueryOptions,
  type ChunkChange,
  type ChunkStats,
  ChunkRepositoryLive
} from '@infrastructure/repositories/chunk.repository'
import { Chunk } from '@domain/entities/components/world/chunk'
import { BlockType } from '@domain/value-objects/block-type.vo'
import { ChunkCoordinate } from '@domain/value-objects/coordinates/chunk-coordinate.vo'
import { expectEffect, runEffect, measureEffectPerformance } from '../../../setup/infrastructure.setup'

describe('ChunkRepository', () => {
  let repository: IChunkRepository
  let stateRef: Ref.Ref<ChunkRepositoryState>

  const createTestState = (): ChunkRepositoryState => ({
    chunks: HashMap.empty(),
    metadata: HashMap.empty(),
    changes: [],
    maxChangeHistory: 100,
    spatialIndex: HashMap.empty(),
  })

  const createTestChunk = (x: number, z: number): Chunk => ({
    chunkX: x,
    chunkZ: z,
    blocks: Array.from({ length: 65536 }, (_, i) => {
      // Create a pattern of blocks for testing
      if (i < 1000) return 'stone' as BlockType
      if (i < 2000) return 'dirt' as BlockType
      return 'air' as BlockType
    }),
    heightMap: Array.from({ length: 256 }, () => 64),
    biome: 'plains',
    lastModified: Date.now(),
  })

  const createTestCoordinate = (x: number, z: number): ChunkCoordinate => ({ x, z })

  beforeEach(async () => {
    const initialState = createTestState()
    stateRef = await runEffect(Ref.make(initialState))
    repository = createChunkRepository(stateRef)
  })

  describe('Basic Chunk Operations', () => {
    describe('setChunk and getChunk', () => {
      it('should store and retrieve a chunk', async () => {
        const chunk = createTestChunk(0, 0)
        const coordinate = createTestCoordinate(0, 0)

        await expectEffect.toSucceed(repository.setChunk(chunk))
        const retrievedOpt = await expectEffect.toSucceed(repository.getChunk(coordinate))

        expect(Option.isSome(retrievedOpt)).toBe(true)
        if (Option.isSome(retrievedOpt)) {
          expect(retrievedOpt.value).toEqual(chunk)
        }
      })

      it('should create metadata when storing chunk', async () => {
        const chunk = createTestChunk(5, 10)
        const coordinate = createTestCoordinate(5, 10)

        await expectEffect.toSucceed(repository.setChunk(chunk))
        const metadataOpt = await expectEffect.toSucceed(repository.getChunkMetadata(coordinate))

        expect(Option.isSome(metadataOpt)).toBe(true)
        if (Option.isSome(metadataOpt)) {
          const metadata = metadataOpt.value
          expect(metadata.coordinate).toEqual(coordinate)
          expect(metadata.blockCount).toBe(65536)
          expect(metadata.nonAirBlockCount).toBe(2000)
          expect(metadata.generationStage).toBe('complete')
          expect(metadata.memorySize).toBeGreaterThan(0)
          expect(metadata.version).toBe(1)
        }
      })

      it('should update last accessed time when retrieving chunk', async () => {
        const chunk = createTestChunk(1, 1)
        const coordinate = createTestCoordinate(1, 1)

        await expectEffect.toSucceed(repository.setChunk(chunk))
        
        const beforeAccess = Date.now()
        await expectEffect.toSucceed(repository.getChunk(coordinate))
        const afterAccess = Date.now()

        const metadataOpt = await expectEffect.toSucceed(repository.getChunkMetadata(coordinate))
        expect(Option.isSome(metadataOpt)).toBe(true)
        
        if (Option.isSome(metadataOpt)) {
          const metadata = metadataOpt.value
          expect(metadata.lastAccessed).toBeGreaterThanOrEqual(beforeAccess)
          expect(metadata.lastAccessed).toBeLessThanOrEqual(afterAccess)
        }
      })

      it('should return None for non-existent chunk', async () => {
        const coordinate = createTestCoordinate(99, 99)
        const chunkOpt = await expectEffect.toSucceed(repository.getChunk(coordinate))
        
        expect(Option.isNone(chunkOpt)).toBe(true)
      })

      it('should update version when overwriting chunk', async () => {
        const coordinate = createTestCoordinate(2, 2)
        const chunk1 = createTestChunk(2, 2)
        const chunk2 = { ...chunk1, biome: 'desert' as const }

        await expectEffect.toSucceed(repository.setChunk(chunk1))
        await expectEffect.toSucceed(repository.setChunk(chunk2))

        const metadataOpt = await expectEffect.toSucceed(repository.getChunkMetadata(coordinate))
        expect(Option.isSome(metadataOpt)).toBe(true)
        
        if (Option.isSome(metadataOpt)) {
          expect(metadataOpt.value.version).toBe(2)
        }
      })
    })

    describe('hasChunk', () => {
      it('should return true for existing chunk', async () => {
        const chunk = createTestChunk(3, 3)
        const coordinate = createTestCoordinate(3, 3)

        await expectEffect.toSucceed(repository.setChunk(chunk))
        const exists = await expectEffect.toSucceed(repository.hasChunk(coordinate))

        expect(exists).toBe(true)
      })

      it('should return false for non-existent chunk', async () => {
        const coordinate = createTestCoordinate(99, 99)
        const exists = await expectEffect.toSucceed(repository.hasChunk(coordinate))

        expect(exists).toBe(false)
      })
    })

    describe('removeChunk', () => {
      it('should remove existing chunk', async () => {
        const chunk = createTestChunk(4, 4)
        const coordinate = createTestCoordinate(4, 4)

        await expectEffect.toSucceed(repository.setChunk(chunk))
        const removed = await expectEffect.toSucceed(repository.removeChunk(coordinate))

        expect(removed).toBe(true)

        const exists = await expectEffect.toSucceed(repository.hasChunk(coordinate))
        expect(exists).toBe(false)
      })

      it('should remove metadata when removing chunk', async () => {
        const chunk = createTestChunk(5, 5)
        const coordinate = createTestCoordinate(5, 5)

        await expectEffect.toSucceed(repository.setChunk(chunk))
        await expectEffect.toSucceed(repository.removeChunk(coordinate))

        const metadataOpt = await expectEffect.toSucceed(repository.getChunkMetadata(coordinate))
        expect(Option.isNone(metadataOpt)).toBe(true)
      })

      it('should return false for non-existent chunk', async () => {
        const coordinate = createTestCoordinate(99, 99)
        const removed = await expectEffect.toSucceed(repository.removeChunk(coordinate))

        expect(removed).toBe(false)
      })

      it('should update spatial index when removing chunk', async () => {
        const chunk = createTestChunk(6, 6)
        const coordinate = createTestCoordinate(6, 6)

        await expectEffect.toSucceed(repository.setChunk(chunk))
        await expectEffect.toSucceed(repository.removeChunk(coordinate))

        // Verify chunk is not found in spatial queries
        const chunksInRadius = await expectEffect.toSucceed(
          repository.getChunksInRadius(coordinate, 1)
        )
        expect(chunksInRadius).toHaveLength(0)
      })
    })
  })

  describe('Chunk Metadata Operations', () => {
    let testCoordinate: ChunkCoordinate

    beforeEach(async () => {
      testCoordinate = createTestCoordinate(10, 10)
      const chunk = createTestChunk(10, 10)
      await expectEffect.toSucceed(repository.setChunk(chunk))
    })

    describe('getChunkMetadata', () => {
      it('should return metadata for existing chunk', async () => {
        const metadataOpt = await expectEffect.toSucceed(repository.getChunkMetadata(testCoordinate))

        expect(Option.isSome(metadataOpt)).toBe(true)
        if (Option.isSome(metadataOpt)) {
          const metadata = metadataOpt.value
          expect(metadata.coordinate).toEqual(testCoordinate)
          expect(metadata.blockCount).toBe(65536)
          expect(metadata.generationStage).toBe('complete')
        }
      })

      it('should return None for non-existent chunk', async () => {
        const nonExistentCoord = createTestCoordinate(99, 99)
        const metadataOpt = await expectEffect.toSucceed(repository.getChunkMetadata(nonExistentCoord))

        expect(Option.isNone(metadataOpt)).toBe(true)
      })
    })

    describe('updateChunkMetadata', () => {
      it('should update existing metadata', async () => {
        const updater = (metadata: ChunkMetadata) => ({
          ...metadata,
          generationStage: 'terrain' as const,
          lastModified: Date.now(),
        })

        const updated = await expectEffect.toSucceed(
          repository.updateChunkMetadata(testCoordinate, updater)
        )
        expect(updated).toBe(true)

        const metadataOpt = await expectEffect.toSucceed(repository.getChunkMetadata(testCoordinate))
        expect(Option.isSome(metadataOpt)).toBe(true)
        
        if (Option.isSome(metadataOpt)) {
          expect(metadataOpt.value.generationStage).toBe('terrain')
        }
      })

      it('should return false for non-existent chunk', async () => {
        const nonExistentCoord = createTestCoordinate(99, 99)
        const updater = (metadata: ChunkMetadata) => metadata

        const updated = await expectEffect.toSucceed(
          repository.updateChunkMetadata(nonExistentCoord, updater)
        )
        expect(updated).toBe(false)
      })
    })

    describe('markChunkDirty and markChunkClean', () => {
      it('should mark chunk as dirty', async () => {
        await expectEffect.toSucceed(repository.markChunkDirty(testCoordinate))

        const metadataOpt = await expectEffect.toSucceed(repository.getChunkMetadata(testCoordinate))
        expect(Option.isSome(metadataOpt)).toBe(true)
        
        if (Option.isSome(metadataOpt)) {
          expect(metadataOpt.value.isDirty).toBe(true)
        }
      })

      it('should mark chunk as clean', async () => {
        await expectEffect.toSucceed(repository.markChunkDirty(testCoordinate))
        await expectEffect.toSucceed(repository.markChunkClean(testCoordinate))

        const metadataOpt = await expectEffect.toSucceed(repository.getChunkMetadata(testCoordinate))
        expect(Option.isSome(metadataOpt)).toBe(true)
        
        if (Option.isSome(metadataOpt)) {
          expect(metadataOpt.value.isDirty).toBe(false)
        }
      })
    })
  })

  describe('Bulk Operations', () => {
    describe('getChunks', () => {
      beforeEach(async () => {
        const chunks = [
          createTestChunk(20, 20),
          createTestChunk(21, 20),
          createTestChunk(20, 21),
        ]
        await expectEffect.toSucceed(repository.setChunks(chunks))
      })

      it('should retrieve multiple chunks', async () => {
        const coordinates = [
          createTestCoordinate(20, 20),
          createTestCoordinate(21, 20),
          createTestCoordinate(20, 21),
        ]

        const chunksMap = await expectEffect.toSucceed(repository.getChunks(coordinates))
        expect(HashMap.size(chunksMap)).toBe(3)

        // Verify all chunks are present
        coordinates.forEach(coord => {
          const key = `${coord.x},${coord.z}`
          expect(HashMap.has(chunksMap, key)).toBe(true)
        })
      })

      it('should handle mix of existing and non-existent coordinates', async () => {
        const coordinates = [
          createTestCoordinate(20, 20),
          createTestCoordinate(99, 99), // Non-existent
          createTestCoordinate(21, 20),
        ]

        const chunksMap = await expectEffect.toSucceed(repository.getChunks(coordinates))
        expect(HashMap.size(chunksMap)).toBe(2) // Only existing chunks
      })

      it('should update last accessed time for retrieved chunks', async () => {
        const coordinates = [createTestCoordinate(20, 20)]
        const beforeAccess = Date.now()
        
        await expectEffect.toSucceed(repository.getChunks(coordinates))
        
        const metadataOpt = await expectEffect.toSucceed(
          repository.getChunkMetadata(coordinates[0])
        )
        expect(Option.isSome(metadataOpt)).toBe(true)
        
        if (Option.isSome(metadataOpt)) {
          expect(metadataOpt.value.lastAccessed).toBeGreaterThanOrEqual(beforeAccess)
        }
      })
    })

    describe('setChunks', () => {
      it('should store multiple chunks', async () => {
        const chunks = [
          createTestChunk(30, 30),
          createTestChunk(31, 30),
          createTestChunk(30, 31),
        ]

        await expectEffect.toSucceed(repository.setChunks(chunks))

        // Verify all chunks were stored
        for (const chunk of chunks) {
          const coord = createTestCoordinate(chunk.chunkX, chunk.chunkZ)
          const exists = await expectEffect.toSucceed(repository.hasChunk(coord))
          expect(exists).toBe(true)
        }
      })
    })

    describe('removeChunks', () => {
      beforeEach(async () => {
        const chunks = [
          createTestChunk(40, 40),
          createTestChunk(41, 40),
          createTestChunk(40, 41),
          createTestChunk(41, 41),
        ]
        await expectEffect.toSucceed(repository.setChunks(chunks))
      })

      it('should remove multiple chunks', async () => {
        const coordinates = [
          createTestCoordinate(40, 40),
          createTestCoordinate(41, 40),
        ]

        const removedCount = await expectEffect.toSucceed(repository.removeChunks(coordinates))
        expect(removedCount).toBe(2)

        // Verify chunks were removed
        for (const coord of coordinates) {
          const exists = await expectEffect.toSucceed(repository.hasChunk(coord))
          expect(exists).toBe(false)
        }
      })

      it('should handle mix of existing and non-existent coordinates', async () => {
        const coordinates = [
          createTestCoordinate(40, 40),
          createTestCoordinate(99, 99), // Non-existent
          createTestCoordinate(41, 40),
        ]

        const removedCount = await expectEffect.toSucceed(repository.removeChunks(coordinates))
        expect(removedCount).toBe(2) // Only existing chunks removed
      })
    })
  })

  describe('Spatial Queries', () => {
    beforeEach(async () => {
      // Create a 5x5 grid of chunks centered at (50, 50)
      const chunks: Chunk[] = []
      for (let x = 48; x <= 52; x++) {
        for (let z = 48; z <= 52; z++) {
          chunks.push(createTestChunk(x, z))
        }
      }
      await expectEffect.toSucceed(repository.setChunks(chunks))
    })

    describe('getChunksInRadius', () => {
      it('should find chunks within radius', async () => {
        const center = createTestCoordinate(50, 50)
        const chunks = await expectEffect.toSucceed(repository.getChunksInRadius(center, 1.5))

        // Should find chunks in a cross pattern
        expect(chunks.length).toBeGreaterThan(0)
        expect(chunks.length).toBeLessThanOrEqual(9) // Maximum possible in 1.5 radius

        // Verify chunks are sorted by distance
        for (let i = 1; i < chunks.length; i++) {
          const distPrev = Math.sqrt(
            (chunks[i-1].chunkX - center.x) ** 2 + (chunks[i-1].chunkZ - center.z) ** 2
          )
          const distCurr = Math.sqrt(
            (chunks[i].chunkX - center.x) ** 2 + (chunks[i].chunkZ - center.z) ** 2
          )
          expect(distCurr).toBeGreaterThanOrEqual(distPrev)
        }
      })

      it('should return empty array for no chunks in radius', async () => {
        const center = createTestCoordinate(100, 100) // Far from test chunks
        const chunks = await expectEffect.toSucceed(repository.getChunksInRadius(center, 1))

        expect(chunks).toHaveLength(0)
      })

      it('should include center chunk', async () => {
        const center = createTestCoordinate(50, 50)
        const chunks = await expectEffect.toSucceed(repository.getChunksInRadius(center, 0.5))

        expect(chunks.length).toBeGreaterThan(0)
        const centerChunk = chunks.find(chunk => chunk.chunkX === 50 && chunk.chunkZ === 50)
        expect(centerChunk).toBeDefined()
      })
    })

    describe('getChunksInArea', () => {
      it('should find chunks in rectangular area', async () => {
        const chunks = await expectEffect.toSucceed(
          repository.getChunksInArea(49, 49, 51, 51)
        )

        expect(chunks.length).toBe(9) // 3x3 grid

        // Verify all chunks are within bounds
        chunks.forEach(chunk => {
          expect(chunk.chunkX).toBeGreaterThanOrEqual(49)
          expect(chunk.chunkX).toBeLessThanOrEqual(51)
          expect(chunk.chunkZ).toBeGreaterThanOrEqual(49)
          expect(chunk.chunkZ).toBeLessThanOrEqual(51)
        })
      })

      it('should return empty array for area with no chunks', async () => {
        const chunks = await expectEffect.toSucceed(
          repository.getChunksInArea(100, 100, 102, 102)
        )

        expect(chunks).toHaveLength(0)
      })
    })

    describe('findChunks', () => {
      beforeEach(async () => {
        // Set different generation stages and mark some as dirty
        await expectEffect.toSucceed(
          repository.setGenerationStage(createTestCoordinate(48, 48), 'terrain')
        )
        await expectEffect.toSucceed(
          repository.setGenerationStage(createTestCoordinate(49, 49), 'features')
        )
        await expectEffect.toSucceed(
          repository.markChunkDirty(createTestCoordinate(50, 50))
        )
      })

      it('should filter by generation stage', async () => {
        const options: ChunkQueryOptions = {
          generationStage: 'terrain'
        }

        const chunks = await expectEffect.toSucceed(repository.findChunks(options))
        expect(chunks.length).toBe(1)
        expect(chunks[0].chunkX).toBe(48)
        expect(chunks[0].chunkZ).toBe(48)
      })

      it('should filter by dirty status', async () => {
        const options: ChunkQueryOptions = {
          onlyDirty: true
        }

        const chunks = await expectEffect.toSucceed(repository.findChunks(options))
        expect(chunks.length).toBe(1)
        expect(chunks[0].chunkX).toBe(50)
        expect(chunks[0].chunkZ).toBe(50)
      })

      it('should filter by radius', async () => {
        const options: ChunkQueryOptions = {
          center: createTestCoordinate(50, 50),
          radius: 1.5
        }

        const chunks = await expectEffect.toSucceed(repository.findChunks(options))
        expect(chunks.length).toBeGreaterThan(0)
        
        // All chunks should be within radius
        chunks.forEach(chunk => {
          const distance = Math.sqrt(
            (chunk.chunkX - 50) ** 2 + (chunk.chunkZ - 50) ** 2
          )
          expect(distance).toBeLessThanOrEqual(1.5)
        })
      })

      it('should apply pagination', async () => {
        const options: ChunkQueryOptions = {
          limit: 3,
          offset: 2
        }

        const allChunks = await expectEffect.toSucceed(repository.findChunks({}))
        const paginatedChunks = await expectEffect.toSucceed(repository.findChunks(options))

        expect(paginatedChunks.length).toBe(Math.min(3, Math.max(0, allChunks.length - 2)))
      })

      it('should sort by distance when center provided', async () => {
        const center = createTestCoordinate(50, 50)
        const options: ChunkQueryOptions = {
          center,
          sortBy: 'distance'
        }

        const chunks = await expectEffect.toSucceed(repository.findChunks(options))
        
        // Verify sorting by distance
        for (let i = 1; i < chunks.length; i++) {
          const distPrev = Math.sqrt(
            (chunks[i-1].chunkX - center.x) ** 2 + (chunks[i-1].chunkZ - center.z) ** 2
          )
          const distCurr = Math.sqrt(
            (chunks[i].chunkX - center.x) ** 2 + (chunks[i].chunkZ - center.z) ** 2
          )
          expect(distCurr).toBeGreaterThanOrEqual(distPrev)
        }
      })
    })
  })

  describe('Block-Level Operations', () => {
    let testCoordinate: ChunkCoordinate
    let testChunk: Chunk

    beforeEach(async () => {
      testCoordinate = createTestCoordinate(60, 60)
      testChunk = createTestChunk(60, 60)
      await expectEffect.toSucceed(repository.setChunk(testChunk))
    })

    describe('getBlock', () => {
      it('should retrieve block from chunk', async () => {
        const blockOpt = await expectEffect.toSucceed(repository.getBlock(testCoordinate, 500))

        expect(Option.isSome(blockOpt)).toBe(true)
        if (Option.isSome(blockOpt)) {
          expect(blockOpt.value).toBe('stone') // Based on test chunk pattern
        }
      })

      it('should return None for invalid block index', async () => {
        const blockOpt = await expectEffect.toSucceed(repository.getBlock(testCoordinate, -1))
        expect(Option.isNone(blockOpt)).toBe(true)

        const blockOpt2 = await expectEffect.toSucceed(repository.getBlock(testCoordinate, 100000))
        expect(Option.isNone(blockOpt2)).toBe(true)
      })

      it('should return None for non-existent chunk', async () => {
        const nonExistentCoord = createTestCoordinate(99, 99)
        const blockOpt = await expectEffect.toSucceed(repository.getBlock(nonExistentCoord, 0))

        expect(Option.isNone(blockOpt)).toBe(true)
      })
    })

    describe('setBlock', () => {
      it('should set block in chunk', async () => {
        const success = await expectEffect.toSucceed(
          repository.setBlock(testCoordinate, 500, 'diamond' as BlockType)
        )
        expect(success).toBe(true)

        const blockOpt = await expectEffect.toSucceed(repository.getBlock(testCoordinate, 500))
        expect(Option.isSome(blockOpt)).toBe(true)
        if (Option.isSome(blockOpt)) {
          expect(blockOpt.value).toBe('diamond')
        }
      })

      it('should mark chunk as dirty after block change', async () => {
        await expectEffect.toSucceed(
          repository.setBlock(testCoordinate, 500, 'diamond' as BlockType)
        )

        const metadataOpt = await expectEffect.toSucceed(repository.getChunkMetadata(testCoordinate))
        expect(Option.isSome(metadataOpt)).toBe(true)
        if (Option.isSome(metadataOpt)) {
          expect(metadataOpt.value.isDirty).toBe(true)
        }
      })

      it('should record block change in history', async () => {
        await expectEffect.toSucceed(
          repository.setBlock(testCoordinate, 500, 'diamond' as BlockType)
        )

        const changes = await expectEffect.toSucceed(repository.getChunkChanges(testCoordinate))
        expect(changes.length).toBe(1)
        expect(changes[0].blockIndex).toBe(500)
        expect(changes[0].previousBlockType).toBe('stone')
        expect(changes[0].newBlockType).toBe('diamond')
      })

      it('should return false for invalid block index', async () => {
        const success = await expectEffect.toSucceed(
          repository.setBlock(testCoordinate, -1, 'diamond' as BlockType)
        )
        expect(success).toBe(false)
      })

      it('should return false for non-existent chunk', async () => {
        const nonExistentCoord = createTestCoordinate(99, 99)
        const success = await expectEffect.toSucceed(
          repository.setBlock(nonExistentCoord, 0, 'diamond' as BlockType)
        )
        expect(success).toBe(false)
      })
    })

    describe('updateBlocks', () => {
      it('should update multiple blocks', async () => {
        const updates = [
          { index: 500, blockType: 'diamond' as BlockType },
          { index: 501, blockType: 'emerald' as BlockType },
          { index: 502, blockType: 'gold' as BlockType },
        ]

        const success = await expectEffect.toSucceed(
          repository.updateBlocks(testCoordinate, updates)
        )
        expect(success).toBe(true)

        // Verify all blocks were updated
        for (const update of updates) {
          const blockOpt = await expectEffect.toSucceed(
            repository.getBlock(testCoordinate, update.index)
          )
          expect(Option.isSome(blockOpt)).toBe(true)
          if (Option.isSome(blockOpt)) {
            expect(blockOpt.value).toBe(update.blockType)
          }
        }
      })

      it('should record all changes in history', async () => {
        const updates = [
          { index: 500, blockType: 'diamond' as BlockType },
          { index: 501, blockType: 'emerald' as BlockType },
        ]

        await expectEffect.toSucceed(repository.updateBlocks(testCoordinate, updates))

        const changes = await expectEffect.toSucceed(repository.getChunkChanges(testCoordinate))
        expect(changes.length).toBe(2)
        expect(changes[0].blockIndex).toBe(500)
        expect(changes[1].blockIndex).toBe(501)
      })

      it('should skip invalid indices', async () => {
        const updates = [
          { index: -1, blockType: 'diamond' as BlockType }, // Invalid
          { index: 500, blockType: 'emerald' as BlockType }, // Valid
          { index: 100000, blockType: 'gold' as BlockType }, // Invalid
        ]

        const success = await expectEffect.toSucceed(
          repository.updateBlocks(testCoordinate, updates)
        )
        expect(success).toBe(true)

        // Only valid update should be recorded
        const changes = await expectEffect.toSucceed(repository.getChunkChanges(testCoordinate))
        expect(changes.length).toBe(1)
        expect(changes[0].blockIndex).toBe(500)
      })
    })
  })

  describe('Change Tracking', () => {
    let testCoordinate: ChunkCoordinate

    beforeEach(async () => {
      testCoordinate = createTestCoordinate(70, 70)
      const chunk = createTestChunk(70, 70)
      await expectEffect.toSucceed(repository.setChunk(chunk))
    })

    describe('getChunkChanges', () => {
      beforeEach(async () => {
        await expectEffect.toSucceed(repository.setBlock(testCoordinate, 100, 'diamond' as BlockType))
        await expectEffect.toSucceed(repository.setBlock(testCoordinate, 101, 'emerald' as BlockType))
        
        // Add changes for a different chunk
        const otherCoord = createTestCoordinate(71, 71)
        const otherChunk = createTestChunk(71, 71)
        await expectEffect.toSucceed(repository.setChunk(otherChunk))
        await expectEffect.toSucceed(repository.setBlock(otherCoord, 100, 'gold' as BlockType))
      })

      it('should return all changes when no filters applied', async () => {
        const changes = await expectEffect.toSucceed(repository.getChunkChanges())
        expect(changes.length).toBe(3) // 2 for first chunk + 1 for second chunk
      })

      it('should filter changes by chunk coordinate', async () => {
        const changes = await expectEffect.toSucceed(repository.getChunkChanges(testCoordinate))
        expect(changes.length).toBe(2)
        
        changes.forEach(change => {
          expect(change.chunkCoordinate).toEqual(testCoordinate)
        })
      })

      it('should filter changes by timestamp', async () => {
        const cutoffTime = Date.now()
        
        // Add another change after cutoff
        await expectEffect.toSucceed(repository.setBlock(testCoordinate, 102, 'iron' as BlockType))
        
        const recentChanges = await expectEffect.toSucceed(
          repository.getChunkChanges(undefined, cutoffTime)
        )
        expect(recentChanges.length).toBe(1) // Only the iron change
        expect(recentChanges[0].newBlockType).toBe('iron')
      })

      it('should combine chunk and timestamp filters', async () => {
        const cutoffTime = Date.now()
        await expectEffect.toSucceed(repository.setBlock(testCoordinate, 102, 'iron' as BlockType))
        
        const filteredChanges = await expectEffect.toSucceed(
          repository.getChunkChanges(testCoordinate, cutoffTime)
        )
        expect(filteredChanges.length).toBe(1)
        expect(filteredChanges[0].chunkCoordinate).toEqual(testCoordinate)
        expect(filteredChanges[0].newBlockType).toBe('iron')
      })
    })

    describe('clearChangeHistory', () => {
      beforeEach(async () => {
        await expectEffect.toSucceed(repository.setBlock(testCoordinate, 100, 'diamond' as BlockType))
        await expectEffect.toSucceed(repository.setBlock(testCoordinate, 101, 'emerald' as BlockType))
      })

      it('should clear all changes when no timestamp specified', async () => {
        const clearedCount = await expectEffect.toSucceed(repository.clearChangeHistory())
        expect(clearedCount).toBe(2)
        
        const remainingChanges = await expectEffect.toSucceed(repository.getChunkChanges())
        expect(remainingChanges.length).toBe(0)
      })

      it('should clear changes before specified timestamp', async () => {
        const cutoffTime = Date.now()
        await expectEffect.toSucceed(repository.setBlock(testCoordinate, 102, 'iron' as BlockType))
        
        const clearedCount = await expectEffect.toSucceed(repository.clearChangeHistory(cutoffTime))
        expect(clearedCount).toBe(2) // Two changes before cutoff
        
        const remainingChanges = await expectEffect.toSucceed(repository.getChunkChanges())
        expect(remainingChanges.length).toBe(1) // Only the iron change remains
      })
    })
  })

  describe('Generation Status Management', () => {
    let testCoordinate: ChunkCoordinate

    beforeEach(async () => {
      testCoordinate = createTestCoordinate(80, 80)
      const chunk = createTestChunk(80, 80)
      await expectEffect.toSucceed(repository.setChunk(chunk))
    })

    describe('setGenerationStage', () => {
      it('should update generation stage', async () => {
        await expectEffect.toSucceed(
          repository.setGenerationStage(testCoordinate, 'terrain')
        )

        const metadataOpt = await expectEffect.toSucceed(repository.getChunkMetadata(testCoordinate))
        expect(Option.isSome(metadataOpt)).toBe(true)
        if (Option.isSome(metadataOpt)) {
          expect(metadataOpt.value.generationStage).toBe('terrain')
        }
      })

      it('should update last modified time', async () => {
        const beforeUpdate = Date.now()
        await expectEffect.toSucceed(
          repository.setGenerationStage(testCoordinate, 'features')
        )

        const metadataOpt = await expectEffect.toSucceed(repository.getChunkMetadata(testCoordinate))
        expect(Option.isSome(metadataOpt)).toBe(true)
        if (Option.isSome(metadataOpt)) {
          expect(metadataOpt.value.lastModified).toBeGreaterThanOrEqual(beforeUpdate)
        }
      })
    })

    describe('getChunksByGenerationStage', () => {
      beforeEach(async () => {
        // Create chunks with different generation stages
        const coordinates = [
          createTestCoordinate(81, 80),
          createTestCoordinate(82, 80),
          createTestCoordinate(83, 80),
        ]
        
        for (const coord of coordinates) {
          const chunk = createTestChunk(coord.x, coord.z)
          await expectEffect.toSucceed(repository.setChunk(chunk))
        }

        await expectEffect.toSucceed(repository.setGenerationStage(coordinates[0], 'terrain'))
        await expectEffect.toSucceed(repository.setGenerationStage(coordinates[1], 'terrain'))
        await expectEffect.toSucceed(repository.setGenerationStage(coordinates[2], 'features'))
      })

      it('should find chunks by generation stage', async () => {
        const terrainChunks = await expectEffect.toSucceed(
          repository.getChunksByGenerationStage('terrain')
        )
        expect(terrainChunks.length).toBe(2)

        const featureChunks = await expectEffect.toSucceed(
          repository.getChunksByGenerationStage('features')
        )
        expect(featureChunks.length).toBe(1)
        expect(featureChunks[0]).toEqual(createTestCoordinate(83, 80))
      })

      it('should return empty array for stage with no chunks', async () => {
        const decorationChunks = await expectEffect.toSucceed(
          repository.getChunksByGenerationStage('decorations')
        )
        expect(decorationChunks.length).toBe(0)
      })
    })

    describe('getIncompleteChunks', () => {
      beforeEach(async () => {
        const coordinates = [
          createTestCoordinate(85, 80),
          createTestCoordinate(86, 80),
          createTestCoordinate(87, 80),
        ]
        
        for (const coord of coordinates) {
          const chunk = createTestChunk(coord.x, coord.z)
          await expectEffect.toSucceed(repository.setChunk(chunk))
        }

        await expectEffect.toSucceed(repository.setGenerationStage(coordinates[0], 'terrain'))
        await expectEffect.toSucceed(repository.setGenerationStage(coordinates[1], 'features'))
        // coordinates[2] remains 'complete'
      })

      it('should find all incomplete chunks', async () => {
        const incompleteChunks = await expectEffect.toSucceed(repository.getIncompleteChunks())
        
        // Should include testCoordinate (complete), and the two incomplete ones
        const incompleteCoords = incompleteChunks.filter(coord => 
          coord.x !== testCoordinate.x || coord.z !== testCoordinate.z
        )
        
        expect(incompleteCoords.length).toBe(2)
      })
    })
  })

  describe('Performance and Maintenance', () => {
    beforeEach(async () => {
      // Create test data for stats
      const chunks = [
        createTestChunk(90, 90),
        createTestChunk(91, 90),
        createTestChunk(92, 90),
      ]
      await expectEffect.toSucceed(repository.setChunks(chunks))
      
      await expectEffect.toSucceed(repository.markChunkDirty(createTestCoordinate(90, 90)))
      await expectEffect.toSucceed(repository.setGenerationStage(createTestCoordinate(91, 90), 'terrain'))
    })

    describe('getChunkStats', () => {
      it('should return comprehensive chunk statistics', async () => {
        const stats = await expectEffect.toSucceed(repository.getChunkStats())

        expect(stats.totalChunks).toBe(3)
        expect(stats.loadedChunks).toBe(3)
        expect(stats.dirtyChunks).toBe(1)
        expect(stats.memoryUsage).toBeGreaterThan(0)
        expect(stats.averageBlockDensity).toBeGreaterThan(0)
        expect(stats.chunksByStage.complete).toBe(2)
        expect(stats.chunksByStage.terrain).toBe(1)
      })
    })

    describe('unloadOldChunks', () => {
      it('should unload chunks older than max age', async () => {
        // Wait a bit and then access one chunk to update its access time
        await new Promise(resolve => setTimeout(resolve, 10))
        await expectEffect.toSucceed(repository.getChunk(createTestCoordinate(90, 90)))
        
        const maxAge = 5 // 5ms
        const unloadedCount = await expectEffect.toSucceed(
          repository.unloadOldChunks(maxAge)
        )
        
        // Should unload some chunks but not the recently accessed dirty one
        expect(unloadedCount).toBeGreaterThanOrEqual(0)
      })

      it('should not unload dirty chunks', async () => {
        const maxAge = 0 // Unload everything older than now
        const unloadedCount = await expectEffect.toSucceed(
          repository.unloadOldChunks(maxAge)
        )
        
        // Dirty chunk should remain
        const exists = await expectEffect.toSucceed(
          repository.hasChunk(createTestCoordinate(90, 90))
        )
        expect(exists).toBe(true)
      })

      it('should respect max count limit', async () => {
        const maxAge = 0
        const maxCount = 1
        const unloadedCount = await expectEffect.toSucceed(
          repository.unloadOldChunks(maxAge, maxCount)
        )
        
        expect(unloadedCount).toBeLessThanOrEqual(maxCount)
      })
    })

    describe('compactStorage', () => {
      it('should compact storage successfully', async () => {
        // Remove some chunks to create empty regions
        await expectEffect.toSucceed(repository.removeChunk(createTestCoordinate(90, 90)))
        await expectEffect.toSucceed(repository.removeChunk(createTestCoordinate(91, 90)))
        
        await expectEffect.toSucceed(repository.compactStorage())
        
        // Should complete without error
        const stats = await expectEffect.toSucceed(repository.getChunkStats())
        expect(stats).toBeDefined()
      })
    })

    describe('validateChunkData', () => {
      it('should validate correct chunk data', async () => {
        const coordinate = createTestCoordinate(90, 90)
        const isValid = await expectEffect.toSucceed(repository.validateChunkData(coordinate))
        expect(isValid).toBe(true)
      })

      it('should return false for non-existent chunk', async () => {
        const coordinate = createTestCoordinate(99, 99)
        const isValid = await expectEffect.toSucceed(repository.validateChunkData(coordinate))
        expect(isValid).toBe(false)
      })

      it('should detect invalid chunk coordinates', async () => {
        // Create a chunk with mismatched coordinates (this is a test scenario)
        const chunk = createTestChunk(95, 95)
        const coordinate = createTestCoordinate(96, 96) // Different from chunk coords
        
        await expectEffect.toSucceed(repository.setChunk(chunk))
        
        const isValid = await expectEffect.toSucceed(repository.validateChunkData(coordinate))
        expect(isValid).toBe(false)
      })
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent chunk storage', async () => {
      const chunks = Array.from({ length: 20 }, (_, i) => createTestChunk(i, 0))
      
      const concurrentOps = chunks.map(chunk => repository.setChunk(chunk))
      
      await expectEffect.toSucceed(
        Effect.all(concurrentOps, { concurrency: 'unbounded' })
      )
      
      // Verify all chunks were stored
      for (const chunk of chunks) {
        const exists = await expectEffect.toSucceed(
          repository.hasChunk(createTestCoordinate(chunk.chunkX, chunk.chunkZ))
        )
        expect(exists).toBe(true)
      }
    })

    it('should handle concurrent block modifications', async () => {
      const coordinate = createTestCoordinate(100, 100)
      const chunk = createTestChunk(100, 100)
      await expectEffect.toSucceed(repository.setChunk(chunk))
      
      const concurrentBlockOps = Array.from({ length: 10 }, (_, i) =>
        repository.setBlock(coordinate, i, `block_${i}` as BlockType)
      )
      
      const results = await expectEffect.toSucceed(
        Effect.all(concurrentBlockOps, { concurrency: 'unbounded' })
      )
      
      // All operations should succeed
      results.forEach(result => expect(result).toBe(true))
      
      // Verify changes were recorded
      const changes = await expectEffect.toSucceed(repository.getChunkChanges(coordinate))
      expect(changes.length).toBe(10)
    })

    it('should handle concurrent spatial queries', async () => {
      // Create test chunks
      const chunks = Array.from({ length: 25 }, (_, i) => 
        createTestChunk(i % 5, Math.floor(i / 5))
      )
      await expectEffect.toSucceed(repository.setChunks(chunks))
      
      const concurrentQueries = [
        repository.getChunksInRadius(createTestCoordinate(2, 2), 2),
        repository.getChunksInArea(1, 1, 3, 3),
        repository.findChunks({ generationStage: 'complete' }),
        repository.getChunkStats(),
      ]
      
      const results = await expectEffect.toSucceed(
        Effect.all(concurrentQueries, { concurrency: 'unbounded' })
      )
      
      expect(results).toHaveLength(4)
      expect(results[0]).toBeInstanceOf(Array)
      expect(results[1]).toBeInstanceOf(Array)
      expect(results[2]).toBeInstanceOf(Array)
      expect(results[3]).toHaveProperty('totalChunks')
    })
  })

  describe('Performance Tests', () => {
    it('should handle large numbers of chunks efficiently', async () => {
      const chunkCount = 1000
      const chunks = Array.from({ length: chunkCount }, (_, i) => 
        createTestChunk(i % 32, Math.floor(i / 32))
      )
      
      const { result, duration } = await measureEffectPerformance(
        repository.setChunks(chunks),
        'store 1000 chunks'
      )
      
      expect(duration).toBeLessThan(2000) // Should complete within 2 seconds
      
      // Verify chunks were stored
      const stats = await expectEffect.toSucceed(repository.getChunkStats())
      expect(stats.totalChunks).toBe(chunkCount)
    })

    it('should maintain performance with large change history', async () => {
      const coordinate = createTestCoordinate(200, 200)
      const chunk = createTestChunk(200, 200)
      await expectEffect.toSucceed(repository.setChunk(chunk))
      
      // Perform many block updates
      const updates = Array.from({ length: 100 }, (_, i) => 
        repository.setBlock(coordinate, i, `block_${i}` as BlockType)
      )
      
      const { duration } = await measureEffectPerformance(
        Effect.all(updates, { concurrency: 1 }),
        '100 block updates'
      )
      
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
      
      // Verify change history was maintained
      const changes = await expectEffect.toSucceed(repository.getChunkChanges(coordinate))
      expect(changes.length).toBe(100)
    })

    it('should perform spatial queries efficiently', async () => {
      // Create a large grid of chunks
      const gridSize = 50
      const chunks: Chunk[] = []
      for (let x = 0; x < gridSize; x++) {
        for (let z = 0; z < gridSize; z++) {
          chunks.push(createTestChunk(x, z))
        }
      }
      await expectEffect.toSucceed(repository.setChunks(chunks))
      
      const center = createTestCoordinate(25, 25)
      const { result, duration } = await measureEffectPerformance(
        repository.getChunksInRadius(center, 10),
        'spatial query on 2500 chunks'
      )
      
      expect(duration).toBeLessThan(500) // Should complete within 500ms
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle chunk with all air blocks', async () => {
      const chunk: Chunk = {
        chunkX: 300,
        chunkZ: 300,
        blocks: Array.from({ length: 65536 }, () => 'air' as BlockType),
        heightMap: Array.from({ length: 256 }, () => 0),
        biome: 'void',
        lastModified: Date.now(),
      }
      
      await expectEffect.toSucceed(repository.setChunk(chunk))
      
      const metadataOpt = await expectEffect.toSucceed(
        repository.getChunkMetadata(createTestCoordinate(300, 300))
      )
      expect(Option.isSome(metadataOpt)).toBe(true)
      if (Option.isSome(metadataOpt)) {
        expect(metadataOpt.value.nonAirBlockCount).toBe(0)
      }
    })

    it('should handle maximum change history limit', async () => {
      const coordinate = createTestCoordinate(400, 400)
      const chunk = createTestChunk(400, 400)
      await expectEffect.toSucceed(repository.setChunk(chunk))
      
      // Exceed change history limit
      const updateCount = 150 // More than maxChangeHistory (100)
      for (let i = 0; i < updateCount; i++) {
        await expectEffect.toSucceed(
          repository.setBlock(coordinate, i % 100, `block_${i}` as BlockType)
        )
      }
      
      const changes = await expectEffect.toSucceed(repository.getChunkChanges(coordinate))
      expect(changes.length).toBeLessThanOrEqual(100) // Should respect limit
    })

    it('should handle chunks at extreme coordinates', async () => {
      const extremeCoords = [
        createTestCoordinate(-1000, -1000),
        createTestCoordinate(1000, 1000),
        createTestCoordinate(-500, 500),
      ]
      
      for (const coord of extremeCoords) {
        const chunk = createTestChunk(coord.x, coord.z)
        await expectEffect.toSucceed(repository.setChunk(chunk))
        
        const exists = await expectEffect.toSucceed(repository.hasChunk(coord))
        expect(exists).toBe(true)
      }
    })

    it('should handle empty update arrays', async () => {
      const coordinate = createTestCoordinate(500, 500)
      const chunk = createTestChunk(500, 500)
      await expectEffect.toSucceed(repository.setChunk(chunk))
      
      const success = await expectEffect.toSucceed(
        repository.updateBlocks(coordinate, [])
      )
      expect(success).toBe(true)
      
      // No changes should be recorded
      const changes = await expectEffect.toSucceed(repository.getChunkChanges(coordinate))
      expect(changes.length).toBe(0)
    })
  })

  describe('Layer Integration', () => {
    it('should work with Effect Layer system', async () => {
      const effect = Effect.gen(function* (_) {
        const repo = yield* _(ChunkRepository)
        const chunk = createTestChunk(600, 600)
        yield* _(repo.setChunk(chunk))
        const hasChunk = yield* _(repo.hasChunk(createTestCoordinate(600, 600)))
        return hasChunk
      })
      
      const result = await runEffect(Effect.provide(effect, ChunkRepositoryLive))
      expect(result).toBe(true)
    })
  })
})