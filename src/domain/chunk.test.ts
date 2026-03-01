import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import { expect } from 'vitest'
import { ChunkService, ChunkServiceLive, CHUNK_SIZE, CHUNK_HEIGHT, blockIndex, blockTypeToIndex, indexToBlockType } from './chunk'
import { ChunkError } from './errors'
import type { BlockType } from './block'

describe('blockIndex', () => {
  it('(0, 0, 0) === 0', () => {
    expect(blockIndex(0, 0, 0)).toBe(0)
  })

  it('(0, 1, 0) === 1 (y increments first)', () => {
    expect(blockIndex(0, 1, 0)).toBe(1)
  })

  it('(0, 0, 1) === CHUNK_HEIGHT (z is second axis)', () => {
    expect(blockIndex(0, 0, 1)).toBe(CHUNK_HEIGHT)
  })

  it('(1, 0, 0) === CHUNK_HEIGHT * CHUNK_SIZE (x is third axis)', () => {
    expect(blockIndex(1, 0, 0)).toBe(CHUNK_HEIGHT * CHUNK_SIZE)
  })

  it('formula: y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE', () => {
    const x = 3
    const y = 42
    const z = 7
    expect(blockIndex(x, y, z)).toBe(y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE)
  })

  it('boundary: last valid index', () => {
    const lastIndex = blockIndex(CHUNK_SIZE - 1, CHUNK_HEIGHT - 1, CHUNK_SIZE - 1)
    const expectedMax = (CHUNK_SIZE - 1) * CHUNK_HEIGHT * CHUNK_SIZE + (CHUNK_SIZE - 1) * CHUNK_HEIGHT + (CHUNK_HEIGHT - 1)
    expect(lastIndex).toBe(expectedMax)
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
    for (const type of allBlockTypes) {
      expect(indexToBlockType(blockTypeToIndex(type))).toBe(type)
    }
  })

  it('indexToBlockType returns AIR for out-of-range index', () => {
    expect(indexToBlockType(999)).toBe('AIR')
  })

  it('all block types produce unique indices', () => {
    const indices = allBlockTypes.map(blockTypeToIndex)
    const unique = new Set(indices)
    expect(unique.size).toBe(allBlockTypes.length)
  })
})

describe('ChunkService', () => {
  describe('createChunk', () => {
    it('should return a chunk with the correct coord', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = { x: 3, z: -5 }
        const chunk = yield* service.createChunk(coord)
        expect(chunk.coord).toEqual(coord)
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should initialize all blocks as AIR (0)', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        for (let i = 0; i < chunk.blocks.length; i++) {
          expect(chunk.blocks[i]).toBe(0)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should create blocks array with length CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        expect(chunk.blocks.length).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('blocks array length is 65536 (16 * 16 * 256)', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        expect(chunk.blocks.length).toBe(65536)
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should set dirty to false', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        expect(chunk.dirty).toBe(false)
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should create a Uint8Array for blocks', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        expect(chunk.blocks).toBeInstanceOf(Uint8Array)
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should work for negative chunk coordinates', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = { x: -10, z: -20 }
        const chunk = yield* service.createChunk(coord)
        expect(chunk.coord.x).toBe(-10)
        expect(chunk.coord.z).toBe(-20)
        expect(chunk.dirty).toBe(false)
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })
  })

  describe('getBlock', () => {
    it('should return AIR for an empty chunk at (0, 0, 0)', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const block = yield* service.getBlock(chunk, 0, 0, 0)
        expect(block).toBe('AIR')
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should return AIR for any valid position in an empty chunk', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const positions = [
          [0, 0, 0],
          [5, 10, 3],
          [15, 255, 15],
          [8, 128, 8],
        ] as const
        for (const [x, y, z] of positions) {
          const block = yield* service.getBlock(chunk, x, y, z)
          expect(block).toBe('AIR')
        }
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should return the correct block type after setBlock', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const updated = yield* service.setBlock(chunk, 5, 64, 7, 'STONE')
        const block = yield* service.getBlock(updated, 5, 64, 7)
        expect(block).toBe('STONE')
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should fail with ChunkError for localX = -1', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.getBlock(chunk, -1, 0, 0))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(ChunkError)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should fail with ChunkError for localX = CHUNK_SIZE', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.getBlock(chunk, CHUNK_SIZE, 0, 0))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(ChunkError)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should fail with ChunkError for y = -1', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.getBlock(chunk, 0, -1, 0))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(ChunkError)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should fail with ChunkError for y = CHUNK_HEIGHT', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.getBlock(chunk, 0, CHUNK_HEIGHT, 0))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(ChunkError)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should fail with ChunkError for localZ = -1', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.getBlock(chunk, 0, 0, -1))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(ChunkError)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should fail with ChunkError for localZ = CHUNK_SIZE', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.getBlock(chunk, 0, 0, CHUNK_SIZE))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(ChunkError)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should succeed at boundary: (0, 0, 0)', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const block = yield* service.getBlock(chunk, 0, 0, 0)
        expect(block).toBe('AIR')
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should succeed at boundary: (CHUNK_SIZE-1, CHUNK_HEIGHT-1, CHUNK_SIZE-1)', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const block = yield* service.getBlock(chunk, CHUNK_SIZE - 1, CHUNK_HEIGHT - 1, CHUNK_SIZE - 1)
        expect(block).toBe('AIR')
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })
  })

  describe('setBlock', () => {
    it('should return a new chunk object (immutability)', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const original = yield* service.createChunk({ x: 0, z: 0 })
        const updated = yield* service.setBlock(original, 0, 0, 0, 'DIRT')
        expect(updated).not.toBe(original)
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should set the correct block type at the target position', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const updated = yield* service.setBlock(chunk, 3, 100, 12, 'GRASS')
        const block = yield* service.getBlock(updated, 3, 100, 12)
        expect(block).toBe('GRASS')
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should leave other blocks as AIR', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const updated = yield* service.setBlock(chunk, 3, 100, 12, 'STONE')

        const neighbor1 = yield* service.getBlock(updated, 2, 100, 12)
        const neighbor2 = yield* service.getBlock(updated, 3, 99, 12)
        const neighbor3 = yield* service.getBlock(updated, 3, 100, 11)

        expect(neighbor1).toBe('AIR')
        expect(neighbor2).toBe('AIR')
        expect(neighbor3).toBe('AIR')
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should set dirty to true on the returned chunk', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        expect(chunk.dirty).toBe(false)
        const updated = yield* service.setBlock(chunk, 0, 0, 0, 'WOOD')
        expect(updated.dirty).toBe(true)
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should NOT modify the original chunk (immutability)', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const original = yield* service.createChunk({ x: 0, z: 0 })
        const originalBlock = yield* service.getBlock(original, 5, 50, 5)
        expect(originalBlock).toBe('AIR')

        yield* service.setBlock(original, 5, 50, 5, 'SAND')

        const stillAir = yield* service.getBlock(original, 5, 50, 5)
        expect(stillAir).toBe('AIR')
        expect(original.dirty).toBe(false)
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should work for all block types', () => {
      const allBlockTypes: BlockType[] = ['AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND', 'WATER', 'LEAVES', 'GLASS', 'SNOW', 'GRAVEL', 'COBBLESTONE']

      const program = Effect.gen(function* () {
        const service = yield* ChunkService

        for (let i = 0; i < allBlockTypes.length; i++) {
          const blockType = allBlockTypes[i]!
          const chunk = yield* service.createChunk({ x: 0, z: 0 })
          const updated = yield* service.setBlock(chunk, i, i, i, blockType)
          const retrieved = yield* service.getBlock(updated, i, i, i)
          expect(retrieved).toBe(blockType)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should preserve the chunk coord', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = { x: 7, z: -3 }
        const chunk = yield* service.createChunk(coord)
        const updated = yield* service.setBlock(chunk, 0, 0, 0, 'DIRT')
        expect(updated.coord).toEqual(coord)
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should fail with ChunkError for invalid localX = -1', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.setBlock(chunk, -1, 0, 0, 'STONE'))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(ChunkError)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should fail with ChunkError for invalid localX = CHUNK_SIZE', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.setBlock(chunk, CHUNK_SIZE, 0, 0, 'STONE'))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(ChunkError)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should fail with ChunkError for invalid y = -1', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.setBlock(chunk, 0, -1, 0, 'STONE'))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(ChunkError)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should fail with ChunkError for invalid y = CHUNK_HEIGHT', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.setBlock(chunk, 0, CHUNK_HEIGHT, 0, 'STONE'))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(ChunkError)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should fail with ChunkError for invalid localZ = -1', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.setBlock(chunk, 0, 0, -1, 'STONE'))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(ChunkError)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should fail with ChunkError for invalid localZ = CHUNK_SIZE', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunk = yield* service.createChunk({ x: 0, z: 0 })
        const result = yield* Effect.either(service.setBlock(chunk, 0, 0, CHUNK_SIZE, 'STONE'))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(ChunkError)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('should support chained setBlock calls', () => {
      const program = Effect.gen(function* () {
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
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })
  })

  describe('worldToChunkCoord', () => {
    it('(0, 0) should map to chunk {x:0, z:0}', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = service.worldToChunkCoord(0, 0)
        expect(coord).toEqual({ x: 0, z: 0 })
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('(15, 15) should map to chunk {x:0, z:0}', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = service.worldToChunkCoord(15, 15)
        expect(coord).toEqual({ x: 0, z: 0 })
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('(16, 0) should map to chunk {x:1, z:0}', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = service.worldToChunkCoord(16, 0)
        expect(coord).toEqual({ x: 1, z: 0 })
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('(0, 16) should map to chunk {x:0, z:1}', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = service.worldToChunkCoord(0, 16)
        expect(coord).toEqual({ x: 0, z: 1 })
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('(-1, 0) should map to chunk {x:-1, z:0} (floor division)', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = service.worldToChunkCoord(-1, 0)
        expect(coord).toEqual({ x: -1, z: 0 })
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('(-16, -1) should map to chunk {x:-1, z:-1}', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = service.worldToChunkCoord(-16, -1)
        expect(coord).toEqual({ x: -1, z: -1 })
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('(-16, 0) should map to chunk {x:-1, z:0}', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = service.worldToChunkCoord(-16, 0)
        expect(coord).toEqual({ x: -1, z: 0 })
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('(-17, 0) should map to chunk {x:-2, z:0}', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = service.worldToChunkCoord(-17, 0)
        expect(coord).toEqual({ x: -2, z: 0 })
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('(32, 48) should map to chunk {x:2, z:3}', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const coord = service.worldToChunkCoord(32, 48)
        expect(coord).toEqual({ x: 2, z: 3 })
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })
  })

  describe('chunkToWorldCoord', () => {
    it('({x:0,z:0}, 0, 0) should return {x:0, z:0}', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const world = service.chunkToWorldCoord({ x: 0, z: 0 }, 0, 0)
        expect(world).toEqual({ x: 0, z: 0 })
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('({x:0,z:0}, 5, 3) should return {x:5, z:3}', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const world = service.chunkToWorldCoord({ x: 0, z: 0 }, 5, 3)
        expect(world).toEqual({ x: 5, z: 3 })
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('({x:1,z:2}, 0, 0) should return {x:16, z:32}', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const world = service.chunkToWorldCoord({ x: 1, z: 2 }, 0, 0)
        expect(world).toEqual({ x: 16, z: 32 })
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('({x:1,z:2}, 5, 3) should return {x:21, z:35}', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const world = service.chunkToWorldCoord({ x: 1, z: 2 }, 5, 3)
        expect(world).toEqual({ x: 21, z: 35 })
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('({x:-1,z:-1}, 0, 0) should return {x:-16, z:-16}', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const world = service.chunkToWorldCoord({ x: -1, z: -1 }, 0, 0)
        expect(world).toEqual({ x: -16, z: -16 })
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('round-trip: worldToChunkCoord then chunkToWorldCoord returns local origin of containing chunk', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService

        const testCases = [
          [0, 0],
          [15, 15],
          [16, 0],
          [32, 48],
          [-1, 0],
          [-16, -16],
        ] as const

        for (const [wx, wz] of testCases) {
          const chunkCoord = service.worldToChunkCoord(wx, wz)
          const origin = service.chunkToWorldCoord(chunkCoord, 0, 0)
          expect(origin.x).toBe(chunkCoord.x * CHUNK_SIZE)
          expect(origin.z).toBe(chunkCoord.z * CHUNK_SIZE)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })

    it('local coordinates within chunk are preserved in world space', () => {
      const program = Effect.gen(function* () {
        const service = yield* ChunkService
        const chunkCoord = { x: 3, z: -2 }
        const localX = 7
        const localZ = 11
        const world = service.chunkToWorldCoord(chunkCoord, localX, localZ)
        expect(world.x).toBe(3 * CHUNK_SIZE + localX)
        expect(world.z).toBe(-2 * CHUNK_SIZE + localZ)
      })

      Effect.runSync(program.pipe(Effect.provide(ChunkServiceLive)))
    })
  })
})
