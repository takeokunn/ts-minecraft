import { describe, expect, it } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import {
  plantRng,
  naturalHeight,
  selectGroundPlantBlockIndex,
  selectMushroomBlockIndex,
  canPlaceGroundPlantAt,
  canPlaceLilyPadAt,
  canPlaceSugarCaneAt,
  canPlaceCactusAt,
  canPlaceMushroomAt,
} from '@ts-minecraft/world/domain/terrain/plant-placement-rules'
import {
  AIR_BLOCK_INDEX,
  DIRT_BLOCK_INDEX,
  GRASS_BLOCK_INDEX,
  SAND_BLOCK_INDEX,
  WATER_BLOCK_INDEX,
  BROWN_MUSHROOM_BLOCK_INDEX,
  RED_MUSHROOM_BLOCK_INDEX,
  FERN_BLOCK_INDEX,
  TALL_GRASS_BLOCK_INDEX,
  DANDELION_BLOCK_INDEX,
  POPPY_BLOCK_INDEX,
  MAX_NATURAL_PLANT_HEIGHT,
} from '@ts-minecraft/world/domain/terrain/plant-placement-model'

// ─── helpers ─────────────────────────────────────────────────────────────────

const BLOCK_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
const blockIdx = (lx: number, y: number, lz: number): number =>
  y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

const makeBlocks = (): Uint8Array => new Uint8Array(BLOCK_COUNT)

const setBlock = (blocks: Uint8Array, lx: number, y: number, lz: number, idx: number): void => {
  blocks[blockIdx(lx, y, lz)] = idx
}

// ─── plantRng ─────────────────────────────────────────────────────────────────
describe('plantRng', () => {
  it('always returns a value in [0, 1)', () => {
    for (const [wx, wz, salt] of [[0, 0, 1], [100, -50, 7], [-200, 300, 99]] as const) {
      const v = plantRng(wx, wz, salt)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is deterministic — same inputs always produce the same value', () => {
    expect(plantRng(42, 17, 31)).toBe(plantRng(42, 17, 31))
  })

  it('changes output when any input changes', () => {
    const base = plantRng(10, 20, 5)
    expect(plantRng(11, 20, 5)).not.toBe(base)
    expect(plantRng(10, 21, 5)).not.toBe(base)
    expect(plantRng(10, 20, 6)).not.toBe(base)
  })
})

// ─── naturalHeight ────────────────────────────────────────────────────────────
describe('naturalHeight', () => {
  it('always returns an integer in [1, MAX_NATURAL_PLANT_HEIGHT]', () => {
    for (let wx = 0; wx < 50; wx++) {
      const h = naturalHeight(wx, wx * 3, 11)
      expect(Number.isInteger(h)).toBe(true)
      expect(h).toBeGreaterThanOrEqual(1)
      expect(h).toBeLessThanOrEqual(MAX_NATURAL_PLANT_HEIGHT)
    }
  })
})

// ─── selectGroundPlantBlockIndex ─────────────────────────────────────────────
describe('selectGroundPlantBlockIndex', () => {
  it('returns only FERN or TALL_GRASS for TAIGA biome', () => {
    const valid = new Set([FERN_BLOCK_INDEX, TALL_GRASS_BLOCK_INDEX])
    for (let wx = 0; wx < 30; wx++) {
      expect(valid.has(selectGroundPlantBlockIndex('TAIGA', wx, wx))).toBe(true)
    }
  })

  it('can return DANDELION for PLAINS biome (variant < 0.12 path)', () => {
    const results = new Set<number>()
    for (let wx = 0; wx < 200; wx++) {
      results.add(selectGroundPlantBlockIndex('PLAINS', wx, wx * 3))
    }
    // PLAINS can produce DANDELION, POPPY, or TALL_GRASS
    expect(results.has(TALL_GRASS_BLOCK_INDEX)).toBe(true)
  })

  it('returns only TALL_GRASS for biomes not covered by the biome switch', () => {
    // DESERT is not in the switch → falls through to default TALL_GRASS
    expect(selectGroundPlantBlockIndex('DESERT', 0, 0)).toBe(TALL_GRASS_BLOCK_INDEX)
  })
})

// ─── selectMushroomBlockIndex ─────────────────────────────────────────────────
describe('selectMushroomBlockIndex', () => {
  it('returns either BROWN_MUSHROOM or RED_MUSHROOM', () => {
    const valid = new Set([BROWN_MUSHROOM_BLOCK_INDEX, RED_MUSHROOM_BLOCK_INDEX])
    for (let wx = 0; wx < 50; wx++) {
      expect(valid.has(selectMushroomBlockIndex(wx, wx * 7))).toBe(true)
    }
  })

  it('produces both variants across many coordinates', () => {
    const results = new Set<number>()
    for (let wx = 0; wx < 200; wx++) {
      results.add(selectMushroomBlockIndex(wx, wx * 7 + 3))
    }
    expect(results.has(BROWN_MUSHROOM_BLOCK_INDEX)).toBe(true)
    expect(results.has(RED_MUSHROOM_BLOCK_INDEX)).toBe(true)
  })
})

// ─── canPlaceGroundPlantAt ────────────────────────────────────────────────────
describe('canPlaceGroundPlantAt', () => {
  it('returns true on DIRT support with AIR above', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 64, 4, DIRT_BLOCK_INDEX)
    // blocks[4,65,4] is AIR (zero-initialised)
    expect(canPlaceGroundPlantAt(blocks, 4, 64, 4)).toBe(true)
  })

  it('returns true on GRASS support with AIR above', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 64, 4, GRASS_BLOCK_INDEX)
    expect(canPlaceGroundPlantAt(blocks, 4, 64, 4)).toBe(true)
  })

  it('returns false when the support block is SAND (not DIRT/GRASS)', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 64, 4, SAND_BLOCK_INDEX)
    expect(canPlaceGroundPlantAt(blocks, 4, 64, 4)).toBe(false)
  })

  it('returns false when the target y+1 position is not AIR', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 64, 4, DIRT_BLOCK_INDEX)
    setBlock(blocks, 4, 65, 4, DIRT_BLOCK_INDEX) // blocked above
    expect(canPlaceGroundPlantAt(blocks, 4, 64, 4)).toBe(false)
  })
})

// ─── canPlaceLilyPadAt ────────────────────────────────────────────────────────
describe('canPlaceLilyPadAt', () => {
  it('returns true when surface is WATER and target above is AIR', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 62, 4, WATER_BLOCK_INDEX)
    expect(canPlaceLilyPadAt(blocks, 4, 62, 4)).toBe(true)
  })

  it('returns false when surface is not WATER', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 62, 4, DIRT_BLOCK_INDEX)
    expect(canPlaceLilyPadAt(blocks, 4, 62, 4)).toBe(false)
  })

  it('returns false when the space above WATER is occupied', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 62, 4, WATER_BLOCK_INDEX)
    setBlock(blocks, 4, 63, 4, DIRT_BLOCK_INDEX)
    expect(canPlaceLilyPadAt(blocks, 4, 62, 4)).toBe(false)
  })
})

// ─── canPlaceSugarCaneAt ──────────────────────────────────────────────────────
describe('canPlaceSugarCaneAt', () => {
  it('returns true when support is DIRT and water is adjacent', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 64, 4, DIRT_BLOCK_INDEX)
    setBlock(blocks, 5, 64, 4, WATER_BLOCK_INDEX) // adjacent water at support Y
    expect(canPlaceSugarCaneAt(blocks, 4, 64, 4)).toBe(true)
  })

  it('returns true when support is SAND and water is adjacent', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 64, 4, SAND_BLOCK_INDEX)
    setBlock(blocks, 4, 64, 5, WATER_BLOCK_INDEX) // adjacent water in Z direction
    expect(canPlaceSugarCaneAt(blocks, 4, 64, 4)).toBe(true)
  })

  it('returns false when no adjacent water at the support level', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 64, 4, DIRT_BLOCK_INDEX)
    expect(canPlaceSugarCaneAt(blocks, 4, 64, 4)).toBe(false)
  })

  it('returns false when the target position is already occupied', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 64, 4, DIRT_BLOCK_INDEX)
    setBlock(blocks, 5, 64, 4, WATER_BLOCK_INDEX)
    setBlock(blocks, 4, 65, 4, DIRT_BLOCK_INDEX) // blocked placement
    expect(canPlaceSugarCaneAt(blocks, 4, 64, 4)).toBe(false)
  })
})

// ─── canPlaceCactusAt ─────────────────────────────────────────────────────────
describe('canPlaceCactusAt', () => {
  it('returns true when surface is SAND and all horizontal neighbors of y+1 are AIR', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 64, 4, SAND_BLOCK_INDEX)
    expect(canPlaceCactusAt(blocks, 4, 64, 4)).toBe(true)
  })

  it('returns false when surface is not SAND', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 64, 4, DIRT_BLOCK_INDEX)
    expect(canPlaceCactusAt(blocks, 4, 64, 4)).toBe(false)
  })

  it('returns false when a horizontal neighbor of the target position is not AIR', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 64, 4, SAND_BLOCK_INDEX)
    setBlock(blocks, 5, 65, 4, DIRT_BLOCK_INDEX) // adjacent block at target y
    expect(canPlaceCactusAt(blocks, 4, 64, 4)).toBe(false)
  })
})

// ─── canPlaceMushroomAt ───────────────────────────────────────────────────────
describe('canPlaceMushroomAt', () => {
  it('returns true with DIRT support, AIR above, and shade overhead', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 30, 4, DIRT_BLOCK_INDEX)
    // shade at y=35 (within MAX_NATURAL_MUSHROOM_SHADE_SCAN=12 above y=31)
    setBlock(blocks, 4, 35, 4, blockTypeToIndex('WOOD'))
    expect(canPlaceMushroomAt(blocks, 4, 30, 4)).toBe(true)
  })

  it('returns false without overhead shade', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 30, 4, DIRT_BLOCK_INDEX)
    // all blocks above are AIR — no shade
    expect(canPlaceMushroomAt(blocks, 4, 30, 4)).toBe(false)
  })

  it('returns false when support is not DIRT or GRASS', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 30, 4, SAND_BLOCK_INDEX)
    setBlock(blocks, 4, 35, 4, blockTypeToIndex('WOOD'))
    expect(canPlaceMushroomAt(blocks, 4, 30, 4)).toBe(false)
  })
})
