import { describe, it } from '@effect/vitest'
import { Array as Arr, Effect, Either, HashSet, Option } from 'effect'
import { expect } from 'vitest'
import { ChunkService, ChunkServiceLive, ChunkSchema, CHUNK_SIZE, CHUNK_HEIGHT, blockIndex, blockTypeToIndex, indexToBlockType, getBlocksBatch, setBlockInChunk } from './chunk'
import { Schema } from 'effect'
import { ChunkError } from './errors'
import type { BlockType } from './block'

describe('blockIndex', () => {
  it('(0, 0, 0) === 0', () => {
    expect(blockIndex(0, 0, 0)).toEqual(Option.some(0))
  })

  it('(0, 1, 0) === 1 (y increments first)', () => {
    expect(blockIndex(0, 1, 0)).toEqual(Option.some(1))
  })

  it('(0, 0, 1) === CHUNK_HEIGHT (z is second axis)', () => {
    expect(blockIndex(0, 0, 1)).toEqual(Option.some(CHUNK_HEIGHT))
  })

  it('(1, 0, 0) === CHUNK_HEIGHT * CHUNK_SIZE (x is third axis)', () => {
    expect(blockIndex(1, 0, 0)).toEqual(Option.some(CHUNK_HEIGHT * CHUNK_SIZE))
  })

  it('formula: y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE', () => {
    const x = 3
    const y = 42
    const z = 7
    expect(blockIndex(x, y, z)).toEqual(Option.some(y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE))
  })

  it('boundary: last valid index', () => {
    const lastIndex = blockIndex(CHUNK_SIZE - 1, CHUNK_HEIGHT - 1, CHUNK_SIZE - 1)
    const expectedMax = (CHUNK_SIZE - 1) * CHUNK_HEIGHT * CHUNK_SIZE + (CHUNK_SIZE - 1) * CHUNK_HEIGHT + (CHUNK_HEIGHT - 1)
    expect(lastIndex).toEqual(Option.some(expectedMax))
  })
})

describe('blockTypeToIndex and indexToBlockType', () => {
  const allBlockTypes: BlockType[] = ['AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND', 'WATER', 'LEAVES', 'GLASS', 'SNOW', 'GRAVEL', 'COBBLESTONE']

  it('AIR maps to index 0', () => {
    expect(blockTypeToIndex('AIR')).toBe(0)
  })

  it('DIRT maps to index 1', () => {
    expect(blockTypeToIndex('DIRT')).toBe(1)
  })

  it('STONE maps to index 2', () => {
    expect(blockTypeToIndex('STONE')).toBe(2)
  })

  it('WOOD maps to index 3', () => {
    expect(blockTypeToIndex('WOOD')).toBe(3)
  })

  it('GRASS maps to index 4', () => {
    expect(blockTypeToIndex('GRASS')).toBe(4)
  })

  it('SAND maps to index 5', () => {
    expect(blockTypeToIndex('SAND')).toBe(5)
  })

  it('WATER maps to index 6', () => {
    expect(blockTypeToIndex('WATER')).toBe(6)
  })

  it('LEAVES maps to index 7', () => {
    expect(blockTypeToIndex('LEAVES')).toBe(7)
  })

  it('GLASS maps to index 8', () => {
    expect(blockTypeToIndex('GLASS')).toBe(8)
  })

  it('SNOW maps to index 9', () => {
    expect(blockTypeToIndex('SNOW')).toBe(9)
  })

  it('GRAVEL maps to index 10', () => {
    expect(blockTypeToIndex('GRAVEL')).toBe(10)
  })

  it('COBBLESTONE maps to index 11', () => {
    expect(blockTypeToIndex('COBBLESTONE')).toBe(11)
  })

  it('round-trip: indexToBlockType(blockTypeToIndex(type)) === type for all block types', () => {
    Arr.forEach(allBlockTypes, (type) => {
      expect(indexToBlockType(blockTypeToIndex(type))).toBe(type)
    })
  })

  it('indexToBlockType returns AIR for out-of-range index', () => {
    expect(indexToBlockType(999)).toBe('AIR')
  })

  it('all block types produce unique indices', () => {
    const indices = Arr.map(allBlockTypes, blockTypeToIndex)
    const unique = HashSet.fromIterable(indices)
    expect(HashSet.size(unique)).toBe(allBlockTypes.length)
  })
})

describe('ChunkService', () => {
  describe('createChunk', () => {
    it.effect('should return a chunk with the correct coord', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = { x: 3, z: -5 }
        const chunk = yield* service.createChunk(coord)
        expect(chunk.coord).toEqual(coord)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should initialize all blocks as AIR (0)', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        Arr.forEach(Arr.makeBy(chunk.blocks.length, i => i), i => {
          expect(chunk.blocks[i]).toBe(0)
        })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should create blocks array with length CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        expect(chunk.blocks.length).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('blocks array length is 65536 (16 * 16 * 256)', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        expect(chunk.blocks.length).toBe(65536)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should create a Uint8Array for blocks', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        expect(chunk.blocks).toBeInstanceOf(Uint8Array)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should work for negative chunk coordinates', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = { x: -10, z: -20 }
        const chunk = yield* service.createChunk(coord)
        expect(chunk.coord.x).toBe(-10)
        expect(chunk.coord.z).toBe(-20)
      }).pipe(Effect.provide(ChunkServiceLive))
    )
  })

  describe('getBlock', () => {
    it.effect('should return AIR for an empty chunk at (0, 0, 0)', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const block = yield* service.getBlock(chunk, 0, 0, 0)
        expect(block).toBe('AIR')
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should return AIR for any valid position in an empty chunk', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const positions = [
          [0, 0, 0],
          [5, 10, 3],
          [15, 255, 15],
          [8, 128, 8],
        ] as const
        yield* Effect.forEach(positions, ([x, y, z]) => Effect.gen(function* () {
          const block = yield* service.getBlock(chunk, x, y, z)
          expect(block).toBe('AIR')
        }), { concurrency: 1 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should return the correct block type after setBlock', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const updated = yield* service.setBlock(chunk, 5, 64, 7, 'STONE')
        const block = yield* service.getBlock(updated, 5, 64, 7)
        expect(block).toBe('STONE')
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should fail with ChunkError for localX = -1', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.getBlock(chunk, -1, 0, 0))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(ChunkError)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should fail with ChunkError for localX = CHUNK_SIZE', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.getBlock(chunk, CHUNK_SIZE, 0, 0))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(ChunkError)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should fail with ChunkError for y = -1', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.getBlock(chunk, 0, -1, 0))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(ChunkError)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should fail with ChunkError for y = CHUNK_HEIGHT', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.getBlock(chunk, 0, CHUNK_HEIGHT, 0))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(ChunkError)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should fail with ChunkError for localZ = -1', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.getBlock(chunk, 0, 0, -1))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(ChunkError)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should fail with ChunkError for localZ = CHUNK_SIZE', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.getBlock(chunk, 0, 0, CHUNK_SIZE))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(ChunkError)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should succeed at boundary: (0, 0, 0)', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const block = yield* service.getBlock(chunk, 0, 0, 0)
        expect(block).toBe('AIR')
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should succeed at boundary: (CHUNK_SIZE-1, CHUNK_HEIGHT-1, CHUNK_SIZE-1)', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const block = yield* service.getBlock(chunk, CHUNK_SIZE - 1, CHUNK_HEIGHT - 1, CHUNK_SIZE - 1)
        expect(block).toBe('AIR')
      }).pipe(Effect.provide(ChunkServiceLive))
    )
  })

  describe('setBlock', () => {
    it.effect('should return a new chunk object (immutability)', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const original = yield* service.createChunk({ x: 0, z: 0 })
        const updated = yield* service.setBlock(original, 0, 0, 0, 'DIRT')
        expect(updated).not.toBe(original)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should set the correct block type at the target position', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const updated = yield* service.setBlock(chunk, 3, 100, 12, 'GRASS')
        const block = yield* service.getBlock(updated, 3, 100, 12)
        expect(block).toBe('GRASS')
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should leave other blocks as AIR', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const updated = yield* service.setBlock(chunk, 3, 100, 12, 'STONE')

        const neighbor1 = yield* service.getBlock(updated, 2, 100, 12)
        const neighbor2 = yield* service.getBlock(updated, 3, 99, 12)
        const neighbor3 = yield* service.getBlock(updated, 3, 100, 11)

        expect(neighbor1).toBe('AIR')
        expect(neighbor2).toBe('AIR')
        expect(neighbor3).toBe('AIR')
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should NOT modify the original chunk (immutability)', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const original = yield* service.createChunk({ x: 0, z: 0 })
        const originalBlock = yield* service.getBlock(original, 5, 50, 5)
        expect(originalBlock).toBe('AIR')

        yield* service.setBlock(original, 5, 50, 5, 'SAND')

        const stillAir = yield* service.getBlock(original, 5, 50, 5)
        expect(stillAir).toBe('AIR')
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should work for all block types', () => {
      const allBlockTypes: BlockType[] = ['AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND', 'WATER', 'LEAVES', 'GLASS', 'SNOW', 'GRAVEL', 'COBBLESTONE']

      return Effect.gen(function* () {
        const service = yield* ChunkService

        yield* Effect.forEach(Arr.makeBy(allBlockTypes.length, i => i), (i) => Effect.gen(function* () {
          const blockType = allBlockTypes[i]!
          const chunk = yield* service.createChunk({ x: 0, z: 0 })
          const updated = yield* service.setBlock(chunk, i, i, i, blockType)
          const retrieved = yield* service.getBlock(updated, i, i, i)
          expect(retrieved).toBe(blockType)
        }), { concurrency: 1 })
      }).pipe(Effect.provide(ChunkServiceLive))
    })

    it.effect('should preserve the chunk coord', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = { x: 7, z: -3 }
        const chunk = yield* service.createChunk(coord)
        const updated = yield* service.setBlock(chunk, 0, 0, 0, 'DIRT')
        expect(updated.coord).toEqual(coord)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should fail with ChunkError for invalid localX = -1', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.setBlock(chunk, -1, 0, 0, 'STONE'))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(ChunkError)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should fail with ChunkError for invalid localX = CHUNK_SIZE', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.setBlock(chunk, CHUNK_SIZE, 0, 0, 'STONE'))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(ChunkError)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should fail with ChunkError for invalid y = -1', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.setBlock(chunk, 0, -1, 0, 'STONE'))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(ChunkError)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should fail with ChunkError for invalid y = CHUNK_HEIGHT', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.setBlock(chunk, 0, CHUNK_HEIGHT, 0, 'STONE'))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(ChunkError)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should fail with ChunkError for invalid localZ = -1', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.setBlock(chunk, 0, 0, -1, 'STONE'))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(ChunkError)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should fail with ChunkError for invalid localZ = CHUNK_SIZE', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.setBlock(chunk, 0, 0, CHUNK_SIZE, 'STONE'))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(ChunkError)
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('should support chained setBlock calls', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const step1 = yield* service.setBlock(chunk, 0, 0, 0, 'DIRT')
        const step2 = yield* service.setBlock(step1, 1, 0, 0, 'STONE')
        const step3 = yield* service.setBlock(step2, 2, 0, 0, 'WOOD')

        const b0 = yield* service.getBlock(step3, 0, 0, 0)
        const b1 = yield* service.getBlock(step3, 1, 0, 0)
        const b2 = yield* service.getBlock(step3, 2, 0, 0)

        expect(b0).toBe('DIRT')
        expect(b1).toBe('STONE')
        expect(b2).toBe('WOOD')
      }).pipe(Effect.provide(ChunkServiceLive))
    )
  })

  describe('worldToChunkCoord', () => {
    it.effect('(0, 0) should map to chunk {x:0, z:0}', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = yield* service.worldToChunkCoord(0, 0)
        expect(coord).toEqual({ x: 0, z: 0 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('(15, 15) should map to chunk {x:0, z:0}', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = yield* service.worldToChunkCoord(15, 15)
        expect(coord).toEqual({ x: 0, z: 0 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('(16, 0) should map to chunk {x:1, z:0}', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = yield* service.worldToChunkCoord(16, 0)
        expect(coord).toEqual({ x: 1, z: 0 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('(0, 16) should map to chunk {x:0, z:1}', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = yield* service.worldToChunkCoord(0, 16)
        expect(coord).toEqual({ x: 0, z: 1 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('(-1, 0) should map to chunk {x:-1, z:0} (floor division)', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = yield* service.worldToChunkCoord(-1, 0)
        expect(coord).toEqual({ x: -1, z: 0 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('(-16, -1) should map to chunk {x:-1, z:-1}', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = yield* service.worldToChunkCoord(-16, -1)
        expect(coord).toEqual({ x: -1, z: -1 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('(-16, 0) should map to chunk {x:-1, z:0}', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = yield* service.worldToChunkCoord(-16, 0)
        expect(coord).toEqual({ x: -1, z: 0 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('(-17, 0) should map to chunk {x:-2, z:0}', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = yield* service.worldToChunkCoord(-17, 0)
        expect(coord).toEqual({ x: -2, z: 0 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('(32, 48) should map to chunk {x:2, z:3}', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = yield* service.worldToChunkCoord(32, 48)
        expect(coord).toEqual({ x: 2, z: 3 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )
  })

  describe('getBlocksBatch', () => {
    it.effect('should return the backing Uint8Array as a readonly view', () =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService
        const chunk = yield* chunkService.createChunk({ x: 0, z: 0 })
        const blocks = yield* getBlocksBatch(chunk)
        expect(blocks).toBe(chunk.blocks) // same reference — zero copy
        expect(blocks.length).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      }).pipe(Effect.provide(ChunkService.Default))
    )

    it.effect('should reflect current block data', () =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService
        const chunk = yield* chunkService.createChunk({ x: 0, z: 0 })
        const updated = yield* chunkService.setBlock(chunk, 0, 0, 0, 'DIRT')
        const blocks = yield* getBlocksBatch(updated)
        const idx = Option.getOrThrow(blockIndex(0, 0, 0))
        expect(blocks[idx]).toBe(blockTypeToIndex('DIRT'))
      }).pipe(Effect.provide(ChunkService.Default))
    )
  })

  describe('setBlockInChunk', () => {
    it.effect('should mutate chunk in-place', () =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService
        const chunk = yield* chunkService.createChunk({ x: 0, z: 0 })
        yield* setBlockInChunk(chunk, 0, 0, 0, 'STONE')
        const idx = Option.getOrThrow(blockIndex(0, 0, 0))
        expect(chunk.blocks[idx]).toBe(blockTypeToIndex('STONE'))
      }).pipe(Effect.provide(ChunkService.Default))
    )

    it.effect('should mutate in-place (same Chunk object, no copy)', () =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService
        const chunk = yield* chunkService.createChunk({ x: 0, z: 0 })
        const originalBlocks = chunk.blocks
        yield* setBlockInChunk(chunk, 1, 2, 3, 'GRASS')
        expect(chunk.blocks).toBe(originalBlocks) // same backing array
      }).pipe(Effect.provide(ChunkService.Default))
    )

    it.effect('should fail with BlockIndexError for out-of-bounds x', () =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService
        const chunk = yield* chunkService.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(setBlockInChunk(chunk, -1, 0, 0, 'DIRT'))
        expect(Either.isLeft(result)).toBe(true)
        const err = Option.getOrThrow(Either.getLeft(result))
        expect(err._tag).toBe('BlockIndexError')
        expect(err.x).toBe(-1)
      }).pipe(Effect.provide(ChunkService.Default))
    )

    it.effect('should fail with BlockIndexError for out-of-bounds y', () =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService
        const chunk = yield* chunkService.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(setBlockInChunk(chunk, 0, CHUNK_HEIGHT, 0, 'DIRT'))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))._tag).toBe('BlockIndexError')
      }).pipe(Effect.provide(ChunkService.Default))
    )
  })

  describe('chunkToWorldCoord', () => {
    it.effect('({x:0,z:0}, 0, 0) should return {x:0, z:0}', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const world = yield* service.chunkToWorldCoord({ x: 0, z: 0 }, 0, 0)
        expect(world).toEqual({ x: 0, z: 0 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('({x:0,z:0}, 5, 3) should return {x:5, z:3}', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const world = yield* service.chunkToWorldCoord({ x: 0, z: 0 }, 5, 3)
        expect(world).toEqual({ x: 5, z: 3 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('({x:1,z:2}, 0, 0) should return {x:16, z:32}', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const world = yield* service.chunkToWorldCoord({ x: 1, z: 2 }, 0, 0)
        expect(world).toEqual({ x: 16, z: 32 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('({x:1,z:2}, 5, 3) should return {x:21, z:35}', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const world = yield* service.chunkToWorldCoord({ x: 1, z: 2 }, 5, 3)
        expect(world).toEqual({ x: 21, z: 35 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('({x:-1,z:-1}, 0, 0) should return {x:-16, z:-16}', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const world = yield* service.chunkToWorldCoord({ x: -1, z: -1 }, 0, 0)
        expect(world).toEqual({ x: -16, z: -16 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('round-trip: worldToChunkCoord then chunkToWorldCoord returns local origin of containing chunk', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService

        const testCases = [
          [0, 0],
          [15, 15],
          [16, 0],
          [32, 48],
          [-1, 0],
          [-16, -16],
        ] as const

        yield* Effect.forEach(testCases, ([wx, wz]) => Effect.gen(function* () {
          const chunkCoord = yield* service.worldToChunkCoord(wx, wz)
          const origin = yield* service.chunkToWorldCoord(chunkCoord, 0, 0)
          expect(origin.x).toBe(chunkCoord.x * CHUNK_SIZE)
          expect(origin.z).toBe(chunkCoord.z * CHUNK_SIZE)
        }), { concurrency: 1 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    it.effect('local coordinates within chunk are preserved in world space', () =>
      Effect.gen(function* () {
        const service = yield* ChunkService
        const chunkCoord = { x: 3, z: -2 }
        const localX = 7
        const localZ = 11
        const world = yield* service.chunkToWorldCoord(chunkCoord, localX, localZ)
        expect(world.x).toBe(3 * CHUNK_SIZE + localX)
        expect(world.z).toBe(-2 * CHUNK_SIZE + localZ)
      }).pipe(Effect.provide(ChunkServiceLive))
    )
  })
})

describe('ChunkSchema — blocks field runtime validation', () => {
  const decode = Schema.decodeUnknownSync(ChunkSchema)

  it('accepts a valid Chunk with Uint8Array blocks', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    expect(() => decode({ coord: { x: 0, z: 0 }, blocks })).not.toThrow()
  })

  it('rejects a plain Array as blocks (must be Uint8Array)', () => {
    const blocks = Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT, () => 0)
    expect(() => decode({ coord: { x: 0, z: 0 }, blocks })).toThrow()
  })

  it('rejects undefined blocks', () => {
    expect(() => decode({ coord: { x: 0, z: 0 }, blocks: undefined })).toThrow()
  })
})
