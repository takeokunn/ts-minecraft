import { describe, expect, it } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import {
  placeCactusStack,
  placeGroundPlant,
  placeLilyPad,
  placeMushroom,
  placeSugarCaneStack,
} from '@ts-minecraft/world/domain/terrain/plant-placement-ops'
import {
  AIR_BLOCK_INDEX,
  CACTUS_BLOCK_INDEX,
  LILY_PAD_BLOCK_INDEX,
  SAND_BLOCK_INDEX,
  SUGAR_CANE_BLOCK_INDEX,
} from '@ts-minecraft/world/domain/terrain/plant-placement-model'
import { blockTypeToIndex } from '@ts-minecraft/core'

// ─── helpers ─────────────────────────────────────────────────────────────────

const BLOCK_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
const blockIdx = (lx: number, y: number, lz: number): number =>
  y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

const makeBlocks = (): Uint8Array => new Uint8Array(BLOCK_COUNT)

const getBlock = (blocks: Uint8Array, lx: number, y: number, lz: number): number =>
  blocks[blockIdx(lx, y, lz)] ?? AIR_BLOCK_INDEX

const setBlock = (blocks: Uint8Array, lx: number, y: number, lz: number, idx: number): void => {
  blocks[blockIdx(lx, y, lz)] = idx
}

const countBlock = (blocks: Uint8Array, idx: number): number => {
  let count = 0
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i] === idx) count++
  }
  return count
}

const STONE = blockTypeToIndex('STONE')

// ─── placeGroundPlant ─────────────────────────────────────────────────────────
describe('placeGroundPlant', () => {
  it('places the given blockIndex at surfaceY + 1', () => {
    const blocks = makeBlocks()
    placeGroundPlant(blocks, 4, 64, 4, STONE)
    expect(getBlock(blocks, 4, 65, 4)).toBe(STONE)
  })

  it('does not place anything at surfaceY itself', () => {
    const blocks = makeBlocks()
    placeGroundPlant(blocks, 4, 64, 4, STONE)
    expect(getBlock(blocks, 4, 64, 4)).toBe(AIR_BLOCK_INDEX)
  })

  it('places exactly one block', () => {
    const blocks = makeBlocks()
    placeGroundPlant(blocks, 4, 64, 4, STONE)
    expect(countBlock(blocks, STONE)).toBe(1)
  })

  it('respects the x/z column (does not bleed into adjacent columns)', () => {
    const blocks = makeBlocks()
    placeGroundPlant(blocks, 2, 50, 3, STONE)
    expect(getBlock(blocks, 2, 51, 3)).toBe(STONE)
    expect(getBlock(blocks, 3, 51, 3)).toBe(AIR_BLOCK_INDEX)
    expect(getBlock(blocks, 2, 51, 4)).toBe(AIR_BLOCK_INDEX)
  })
})

// ─── placeLilyPad ─────────────────────────────────────────────────────────────
describe('placeLilyPad', () => {
  it('places LILY_PAD at surfaceY + 1', () => {
    const blocks = makeBlocks()
    placeLilyPad(blocks, 4, 62, 4)
    expect(getBlock(blocks, 4, 63, 4)).toBe(LILY_PAD_BLOCK_INDEX)
  })

  it('places exactly one block', () => {
    const blocks = makeBlocks()
    placeLilyPad(blocks, 4, 62, 4)
    expect(countBlock(blocks, LILY_PAD_BLOCK_INDEX)).toBe(1)
  })
})

// ─── placeMushroom ────────────────────────────────────────────────────────────
describe('placeMushroom', () => {
  it('places the given blockIndex at surfaceY + 1', () => {
    const BROWN = blockTypeToIndex('BROWN_MUSHROOM')
    const blocks = makeBlocks()
    placeMushroom(blocks, 6, 30, 6, BROWN)
    expect(getBlock(blocks, 6, 31, 6)).toBe(BROWN)
  })

  it('places exactly one block', () => {
    const RED = blockTypeToIndex('RED_MUSHROOM')
    const blocks = makeBlocks()
    placeMushroom(blocks, 0, 10, 0, RED)
    expect(countBlock(blocks, RED)).toBe(1)
  })
})

// ─── placeSugarCaneStack ──────────────────────────────────────────────────────
describe('placeSugarCaneStack', () => {
  it('places at least one SUGAR_CANE block above the surface', () => {
    const blocks = makeBlocks()
    // wx=0, wz=0, salt=SUGAR_CANE_HEIGHT_SALT → deterministic height ≥ 1
    placeSugarCaneStack(blocks, 4, 64, 4, 0, 0)
    const count = countBlock(blocks, SUGAR_CANE_BLOCK_INDEX)
    expect(count).toBeGreaterThanOrEqual(1)
  })

  it('places SUGAR_CANE starting directly at surfaceY + 1', () => {
    const blocks = makeBlocks()
    placeSugarCaneStack(blocks, 4, 64, 4, 0, 0)
    expect(getBlock(blocks, 4, 65, 4)).toBe(SUGAR_CANE_BLOCK_INDEX)
  })

  it('places no more than MAX_NATURAL_PLANT_HEIGHT (3) blocks per column', () => {
    const blocks = makeBlocks()
    placeSugarCaneStack(blocks, 4, 64, 4, 0, 0)
    const count = countBlock(blocks, SUGAR_CANE_BLOCK_INDEX)
    expect(count).toBeLessThanOrEqual(3)
  })

  it('stops early when a non-AIR block occupies the next position', () => {
    const blocks = makeBlocks()
    // Block the second slot — only one cane should be placed
    setBlock(blocks, 4, 66, 4, STONE)
    placeSugarCaneStack(blocks, 4, 64, 4, 0, 0)
    expect(getBlock(blocks, 4, 65, 4)).toBe(SUGAR_CANE_BLOCK_INDEX)
    expect(getBlock(blocks, 4, 67, 4)).toBe(AIR_BLOCK_INDEX)
  })

  it('places no block above CHUNK_HEIGHT - 1', () => {
    const blocks = makeBlocks()
    // Surface near the top — cane cannot grow past the top of the chunk
    const nearTop = CHUNK_HEIGHT - 2
    placeSugarCaneStack(blocks, 4, nearTop, 4, 0, 0)
    // Only one cell above nearTop exists (nearTop+1 = CHUNK_HEIGHT-1)
    expect(getBlock(blocks, 4, nearTop + 1, 4)).toBe(SUGAR_CANE_BLOCK_INDEX)
  })
})

// ─── placeCactusStack ─────────────────────────────────────────────────────────
describe('placeCactusStack', () => {
  it('places at least one CACTUS block above the surface on clear sand', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 64, 4, SAND_BLOCK_INDEX)
    // Use wx/wz that produce height ≥ 1
    placeCactusStack(blocks, 4, 64, 4, 0, 0)
    const count = countBlock(blocks, CACTUS_BLOCK_INDEX)
    expect(count).toBeGreaterThanOrEqual(1)
  })

  it('places CACTUS starting directly at surfaceY + 1', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 64, 4, SAND_BLOCK_INDEX)
    placeCactusStack(blocks, 4, 64, 4, 0, 0)
    expect(getBlock(blocks, 4, 65, 4)).toBe(CACTUS_BLOCK_INDEX)
  })

  it('stops when a horizontal neighbor at the target Y is non-AIR', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 64, 4, SAND_BLOCK_INDEX)
    // Place a wall adjacent to the first segment position (y=65)
    setBlock(blocks, 5, 65, 4, STONE)
    placeCactusStack(blocks, 4, 64, 4, 0, 0)
    // First segment is blocked by adjacent wall → zero cactus placed
    expect(getBlock(blocks, 4, 65, 4)).toBe(AIR_BLOCK_INDEX)
  })

  it('places no more than MAX_NATURAL_PLANT_HEIGHT (3) blocks per column', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 4, 64, 4, SAND_BLOCK_INDEX)
    placeCactusStack(blocks, 4, 64, 4, 0, 0)
    const count = countBlock(blocks, CACTUS_BLOCK_INDEX)
    expect(count).toBeLessThanOrEqual(3)
  })
})
