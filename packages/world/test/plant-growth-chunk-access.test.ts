import { describe, expect, it } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import {
  plantGrowthChunkKey,
  plantGrowthChunkCoordForBlock,
  plantGrowthLocalCoordForBlock,
  plantGrowthBlockAt,
  plantGrowthBlockAtWorld,
  toPlantGrowthWorldBlock,
} from '@ts-minecraft/world/domain/plant-growth-chunk-access'
import type { PlantGrowthChunk } from '@ts-minecraft/world/domain/plant-growth-model'
import { EXPECTED_PLANT_GROWTH_CHUNK_BLOCK_COUNT } from '@ts-minecraft/world/domain/plant-growth-model'

// ─── helpers ─────────────────────────────────────────────────────────────────

const blockIdx = (lx: number, y: number, lz: number): number =>
  y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

const makeChunk = (cx: number, cz: number): PlantGrowthChunk => ({
  coord: { x: cx, z: cz },
  blocks: new Uint8Array(EXPECTED_PLANT_GROWTH_CHUNK_BLOCK_COUNT),
})

const makeChunkMap = (...chunks: PlantGrowthChunk[]): ReadonlyMap<string, PlantGrowthChunk> => {
  const map = new Map<string, PlantGrowthChunk>()
  for (const chunk of chunks) {
    map.set(plantGrowthChunkKey(chunk.coord.x, chunk.coord.z), chunk)
  }
  return map
}

const AIR_IDX = blockTypeToIndex('AIR')
const STONE_IDX = blockTypeToIndex('STONE')

// ─── plantGrowthChunkKey ─────────────────────────────────────────────────────
describe('plantGrowthChunkKey', () => {
  it('formats positive coordinates as "cx,cz"', () => {
    expect(plantGrowthChunkKey(3, 5)).toBe('3,5')
  })

  it('handles zero', () => {
    expect(plantGrowthChunkKey(0, 0)).toBe('0,0')
  })

  it('handles negative chunk coordinates', () => {
    expect(plantGrowthChunkKey(-2, -1)).toBe('-2,-1')
  })

  it('produces distinct keys for different coordinate pairs', () => {
    expect(plantGrowthChunkKey(1, 2)).not.toBe(plantGrowthChunkKey(2, 1))
  })
})

// ─── plantGrowthChunkCoordForBlock ────────────────────────────────────────────
describe('plantGrowthChunkCoordForBlock', () => {
  it('maps world block 0 to chunk 0', () => {
    expect(plantGrowthChunkCoordForBlock(0)).toBe(0)
  })

  it('maps the last block in chunk 0 to chunk 0', () => {
    expect(plantGrowthChunkCoordForBlock(CHUNK_SIZE - 1)).toBe(0)
  })

  it('maps the first block of chunk 1 to chunk 1', () => {
    expect(plantGrowthChunkCoordForBlock(CHUNK_SIZE)).toBe(1)
  })

  it('maps negative world coordinates to negative chunk coordinates', () => {
    expect(plantGrowthChunkCoordForBlock(-1)).toBe(-1)
    expect(plantGrowthChunkCoordForBlock(-CHUNK_SIZE)).toBe(-1)
    expect(plantGrowthChunkCoordForBlock(-(CHUNK_SIZE + 1))).toBe(-2)
  })
})

// ─── plantGrowthLocalCoordForBlock ────────────────────────────────────────────
describe('plantGrowthLocalCoordForBlock', () => {
  it('returns 0 for the first block in the chunk', () => {
    expect(plantGrowthLocalCoordForBlock(0, 0)).toBe(0)
    expect(plantGrowthLocalCoordForBlock(CHUNK_SIZE, 1)).toBe(0)
  })

  it('returns CHUNK_SIZE-1 for the last block in the chunk', () => {
    expect(plantGrowthLocalCoordForBlock(CHUNK_SIZE - 1, 0)).toBe(CHUNK_SIZE - 1)
  })

  it('round-trips with plantGrowthChunkCoordForBlock', () => {
    const worldCoord = 37
    const chunkCoord = plantGrowthChunkCoordForBlock(worldCoord)
    expect(plantGrowthLocalCoordForBlock(worldCoord, chunkCoord)).toBe(worldCoord - chunkCoord * CHUNK_SIZE)
  })
})

// ─── plantGrowthBlockAt ───────────────────────────────────────────────────────
describe('plantGrowthBlockAt', () => {
  it('returns AIR for an empty (zero-filled) chunk', () => {
    const chunk = makeChunk(0, 0)
    expect(plantGrowthBlockAt(chunk, 0, 0, 0)).toBe(AIR_IDX)
  })

  it('reads a block that was explicitly set', () => {
    const chunk = makeChunk(0, 0)
    chunk.blocks[blockIdx(4, 64, 4)] = STONE_IDX
    expect(plantGrowthBlockAt(chunk, 4, 64, 4)).toBe(STONE_IDX)
  })

  it('returns AIR for an out-of-bounds access', () => {
    const chunk = makeChunk(0, 0)
    expect(plantGrowthBlockAt(chunk, 0, CHUNK_HEIGHT + 1, 0)).toBe(AIR_IDX)
  })
})

// ─── plantGrowthBlockAtWorld ──────────────────────────────────────────────────
describe('plantGrowthBlockAtWorld', () => {
  it('returns undefined when the target chunk is not in the map', () => {
    const map = makeChunkMap()
    expect(plantGrowthBlockAtWorld(map, 0, 64, 0)).toBeUndefined()
  })

  it('returns undefined for y out of [0, CHUNK_HEIGHT)', () => {
    const chunk = makeChunk(0, 0)
    const map = makeChunkMap(chunk)
    expect(plantGrowthBlockAtWorld(map, 0, -1, 0)).toBeUndefined()
    expect(plantGrowthBlockAtWorld(map, 0, CHUNK_HEIGHT, 0)).toBeUndefined()
  })

  it('reads AIR from an empty chunk at valid coordinates', () => {
    const chunk = makeChunk(0, 0)
    const map = makeChunkMap(chunk)
    expect(plantGrowthBlockAtWorld(map, 0, 64, 0)).toBe(AIR_IDX)
  })

  it('reads the correct block set via local indices', () => {
    const chunk = makeChunk(0, 0)
    chunk.blocks[blockIdx(4, 64, 4)] = STONE_IDX
    const map = makeChunkMap(chunk)
    expect(plantGrowthBlockAtWorld(map, 4, 64, 4)).toBe(STONE_IDX)
  })

  it('resolves world coordinates that cross chunk boundaries (negative chunk)', () => {
    const chunk = makeChunk(-1, 0)
    chunk.blocks[blockIdx(15, 64, 0)] = STONE_IDX
    const map = makeChunkMap(chunk)
    expect(plantGrowthBlockAtWorld(map, -1, 64, 0)).toBe(STONE_IDX)
  })
})

// ─── toPlantGrowthWorldBlock ──────────────────────────────────────────────────
describe('toPlantGrowthWorldBlock', () => {
  it('converts chunk (0,0) local (0,64,0) to world (0,64,0)', () => {
    const chunk = makeChunk(0, 0)
    expect(toPlantGrowthWorldBlock(chunk, 0, 64, 0)).toEqual({ x: 0, y: 64, z: 0 })
  })

  it('converts chunk (1,0) local (3,70,5) to world (19,70,5)', () => {
    const chunk = makeChunk(1, 0)
    expect(toPlantGrowthWorldBlock(chunk, 3, 70, 5)).toEqual({ x: 19, y: 70, z: 5 })
  })

  it('handles negative chunk coordinates', () => {
    const chunk = makeChunk(-1, -1)
    expect(toPlantGrowthWorldBlock(chunk, 0, 64, 0)).toEqual({ x: -16, y: 64, z: -16 })
  })

  it('preserves y verbatim', () => {
    const chunk = makeChunk(0, 0)
    const result = toPlantGrowthWorldBlock(chunk, 5, 200, 7)
    expect(result.y).toBe(200)
  })
})
