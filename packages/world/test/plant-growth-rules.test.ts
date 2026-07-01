import { describe, expect, it } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import {
  canPlantGrowAt,
  plantGrowthTypeFromBlockIndex,
} from '@ts-minecraft/world/domain/plant-growth-rules'
import { plantGrowthChunkKey } from '@ts-minecraft/world/domain/plant-growth-chunk-access'
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

const setBlock = (chunk: PlantGrowthChunk, lx: number, y: number, lz: number, blockType: string): void => {
  chunk.blocks[blockIdx(lx, y, lz)] = blockTypeToIndex(blockType as Parameters<typeof blockTypeToIndex>[0])
}

// Single-chunk map at chunk (0,0) — world coords 0..15
const makeSimpleMap = (): { chunk: PlantGrowthChunk; map: ReadonlyMap<string, PlantGrowthChunk> } => {
  const chunk = makeChunk(0, 0)
  return { chunk, map: makeChunkMap(chunk) }
}

// ─── plantGrowthTypeFromBlockIndex ───────────────────────────────────────────
describe('plantGrowthTypeFromBlockIndex', () => {
  it('returns SUGAR_CANE for the SUGAR_CANE block index', () => {
    expect(plantGrowthTypeFromBlockIndex(blockTypeToIndex('SUGAR_CANE'))).toBe('SUGAR_CANE')
  })

  it('returns CACTUS for the CACTUS block index', () => {
    expect(plantGrowthTypeFromBlockIndex(blockTypeToIndex('CACTUS'))).toBe('CACTUS')
  })

  it('returns undefined for AIR', () => {
    expect(plantGrowthTypeFromBlockIndex(blockTypeToIndex('AIR'))).toBeUndefined()
  })

  it('returns undefined for an arbitrary non-plant block', () => {
    expect(plantGrowthTypeFromBlockIndex(blockTypeToIndex('STONE'))).toBeUndefined()
  })
})

// ─── canPlantGrowAt — SUGAR_CANE ─────────────────────────────────────────────
describe('canPlantGrowAt — SUGAR_CANE', () => {
  it('returns true for a single-block sugar cane with adjacent water on dirt', () => {
    const { chunk, map } = makeSimpleMap()
    // Support layer at y=60: DIRT
    setBlock(chunk, 4, 60, 4, 'DIRT')
    // Sugar cane at y=61
    setBlock(chunk, 4, 61, 4, 'SUGAR_CANE')
    // Adjacent water at the base level (y=60)
    setBlock(chunk, 5, 60, 4, 'WATER')
    expect(canPlantGrowAt(map, 'SUGAR_CANE', 4, 61, 4)).toBe(true)
  })

  it('returns false when the space above y+1 is blocked', () => {
    const { chunk, map } = makeSimpleMap()
    setBlock(chunk, 4, 60, 4, 'DIRT')
    setBlock(chunk, 4, 61, 4, 'SUGAR_CANE')
    setBlock(chunk, 5, 60, 4, 'WATER')
    // Block the target position
    setBlock(chunk, 4, 62, 4, 'STONE')
    expect(canPlantGrowAt(map, 'SUGAR_CANE', 4, 61, 4)).toBe(false)
  })

  it('returns false when the stack is already 3 blocks tall (max height)', () => {
    const { chunk, map } = makeSimpleMap()
    setBlock(chunk, 4, 60, 4, 'DIRT')
    setBlock(chunk, 5, 60, 4, 'WATER')
    // 3 cane blocks: y=61, 62, 63
    setBlock(chunk, 4, 61, 4, 'SUGAR_CANE')
    setBlock(chunk, 4, 62, 4, 'SUGAR_CANE')
    setBlock(chunk, 4, 63, 4, 'SUGAR_CANE')
    expect(canPlantGrowAt(map, 'SUGAR_CANE', 4, 63, 4)).toBe(false)
  })

  it('returns true for a 2-block stack (stack=2, not yet at max)', () => {
    const { chunk, map } = makeSimpleMap()
    setBlock(chunk, 4, 60, 4, 'DIRT')
    setBlock(chunk, 5, 60, 4, 'WATER')
    setBlock(chunk, 4, 61, 4, 'SUGAR_CANE')
    setBlock(chunk, 4, 62, 4, 'SUGAR_CANE')
    expect(canPlantGrowAt(map, 'SUGAR_CANE', 4, 62, 4)).toBe(true)
  })

  it('returns false when there is no adjacent water at the base', () => {
    const { chunk, map } = makeSimpleMap()
    setBlock(chunk, 4, 60, 4, 'DIRT')
    setBlock(chunk, 4, 61, 4, 'SUGAR_CANE')
    // No water adjacent
    expect(canPlantGrowAt(map, 'SUGAR_CANE', 4, 61, 4)).toBe(false)
  })

  it('returns false when the base support is not DIRT/GRASS/SAND', () => {
    const { chunk, map } = makeSimpleMap()
    setBlock(chunk, 4, 60, 4, 'STONE') // unsupported base
    setBlock(chunk, 4, 61, 4, 'SUGAR_CANE')
    setBlock(chunk, 5, 60, 4, 'WATER')
    expect(canPlantGrowAt(map, 'SUGAR_CANE', 4, 61, 4)).toBe(false)
  })
})

// ─── canPlantGrowAt — CACTUS ─────────────────────────────────────────────────
describe('canPlantGrowAt — CACTUS', () => {
  it('returns true for a single cactus with all horizontal neighbors at target y clear', () => {
    const { chunk, map } = makeSimpleMap()
    setBlock(chunk, 4, 61, 4, 'CACTUS')
    // All neighbors at y=62 remain AIR (zero-initialised)
    expect(canPlantGrowAt(map, 'CACTUS', 4, 61, 4)).toBe(true)
  })

  it('returns false when a horizontal neighbor at targetY is not AIR', () => {
    const { chunk, map } = makeSimpleMap()
    setBlock(chunk, 4, 61, 4, 'CACTUS')
    // Place a STONE next to the target position (y=62)
    setBlock(chunk, 5, 62, 4, 'STONE')
    expect(canPlantGrowAt(map, 'CACTUS', 4, 61, 4)).toBe(false)
  })

  it('returns false when the stack is already 3 blocks tall', () => {
    const { chunk, map } = makeSimpleMap()
    setBlock(chunk, 4, 60, 4, 'CACTUS')
    setBlock(chunk, 4, 61, 4, 'CACTUS')
    setBlock(chunk, 4, 62, 4, 'CACTUS')
    expect(canPlantGrowAt(map, 'CACTUS', 4, 62, 4)).toBe(false)
  })

  it('returns false when the target y+1 position is blocked', () => {
    const { chunk, map } = makeSimpleMap()
    setBlock(chunk, 4, 61, 4, 'CACTUS')
    setBlock(chunk, 4, 62, 4, 'STONE')
    expect(canPlantGrowAt(map, 'CACTUS', 4, 61, 4)).toBe(false)
  })
})
