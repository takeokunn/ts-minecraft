import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { BEDROCK_LAYER_TOP, fillColumn } from '@ts-minecraft/world'

const GRASS     = blockTypeToIndex('GRASS')
const DIRT      = blockTypeToIndex('DIRT')
const STONE     = blockTypeToIndex('STONE')
const BEDROCK   = blockTypeToIndex('BEDROCK')
const DEEPSLATE = blockTypeToIndex('DEEPSLATE')

const FILL_PROPS = {
  surfaceBlockIndex: GRASS,
  subSurfaceBlockIndex: DIRT,
  surfaceDepth: 3,
  stoneBlockIndex: STONE,
  bedrockBlockIndex: BEDROCK,
  deepslateBlockIndex: DEEPSLATE,
  graniteBlockIndex: blockTypeToIndex('GRANITE'),
  dioriteBlockIndex: blockTypeToIndex('DIORITE'),
  andesiteBlockIndex: blockTypeToIndex('ANDESITE'),
  graniteFlag: false,
  dioriteFlag: false,
  andesiteFlag: false,
}

const getBlock = (blocks: Uint8Array, lx: number, y: number, lz: number): number =>
  blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE]!

const makeBlocks = (): Uint8Array => new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)


describe('fillColumn', () => {
  const LX = 4
  const LZ = 4
  const WX = 4
  const WZ = 4
  const SURFACE_Y = 80

  it('y=0 is always BEDROCK', () => {
    const blocks = makeBlocks()
    fillColumn(blocks, LX, LZ, WX, WZ, SURFACE_Y, FILL_PROPS)
    expect(getBlock(blocks, LX, 0, LZ)).toBe(BEDROCK)
  })

  it('y=surfaceY is the surface block', () => {
    const blocks = makeBlocks()
    fillColumn(blocks, LX, LZ, WX, WZ, SURFACE_Y, FILL_PROPS)
    expect(getBlock(blocks, LX, SURFACE_Y, LZ)).toBe(GRASS)
  })

  it('y just below surface (within surfaceDepth) is the sub-surface block', () => {
    const blocks = makeBlocks()
    fillColumn(blocks, LX, LZ, WX, WZ, SURFACE_Y, FILL_PROPS)
    // surfaceDepth=3 → y = SURFACE_Y-1, SURFACE_Y-2 are DIRT
    expect(getBlock(blocks, LX, SURFACE_Y - 1, LZ)).toBe(DIRT)
    expect(getBlock(blocks, LX, SURFACE_Y - 2, LZ)).toBe(DIRT)
  })

  it('y below DEEPSLATE_CEILING is DEEPSLATE (not STONE)', () => {
    const blocks = makeBlocks()
    // High surfaceY so DEEPSLATE_CEILING (16) is well below sub-surface region
    fillColumn(blocks, LX, LZ, WX, WZ, SURFACE_Y, FILL_PROPS)
    // y=10 is below DEEPSLATE_CEILING (16), so it should be DEEPSLATE
    expect(getBlock(blocks, LX, 10, LZ)).toBe(DEEPSLATE)
  })

  it('y between DEEPSLATE_CEILING and sub-surface floor is STONE (no variant flags)', () => {
    const blocks = makeBlocks()
    fillColumn(blocks, LX, LZ, WX, WZ, SURFACE_Y, FILL_PROPS)
    // y=40 is above DEEPSLATE_CEILING (16) and well below surfaceY - surfaceDepth
    expect(getBlock(blocks, LX, 40, LZ)).toBe(STONE)
  })

  it('applies granite variant to deep-stone layer when graniteFlag is set', () => {
    const blocks = makeBlocks()
    const props = { ...FILL_PROPS, graniteFlag: true }
    fillColumn(blocks, LX, LZ, WX, WZ, SURFACE_Y, props)
    // y=40: deep stone layer above DEEPSLATE_CEILING → should be GRANITE
    expect(getBlock(blocks, LX, 40, LZ)).toBe(blockTypeToIndex('GRANITE'))
  })

  it('y=1..4 block is BEDROCK or DEEPSLATE (probabilistic but exhaustive check)', () => {
    const blocks = makeBlocks()
    fillColumn(blocks, LX, LZ, WX, WZ, SURFACE_Y, FILL_PROPS)
    Arr.forEach(Arr.makeBy(BEDROCK_LAYER_TOP, i => 1 + i), y => {
      const b = getBlock(blocks, LX, y, LZ)
      expect(b === BEDROCK || b === DEEPSLATE).toBe(true)
    })
  })

  it('blocks above surfaceY are left as AIR (index 0)', () => {
    const blocks = makeBlocks()
    fillColumn(blocks, LX, LZ, WX, WZ, SURFACE_Y, FILL_PROPS)
    expect(getBlock(blocks, LX, SURFACE_Y + 1, LZ)).toBe(0) // AIR = 0
    expect(getBlock(blocks, LX, SURFACE_Y + 5, LZ)).toBe(0)
  })

  it('applies diorite variant to deep-stone layer when dioriteFlag is set (and graniteFlag false)', () => {
    const blocks = makeBlocks()
    const props = { ...FILL_PROPS, dioriteFlag: true }
    fillColumn(blocks, LX, LZ, WX, WZ, SURFACE_Y, props)
    expect(getBlock(blocks, LX, 40, LZ)).toBe(blockTypeToIndex('DIORITE'))
  })

  it('applies andesite variant when andesiteFlag is set (and granite/diorite false)', () => {
    const blocks = makeBlocks()
    const props = { ...FILL_PROPS, andesiteFlag: true }
    fillColumn(blocks, LX, LZ, WX, WZ, SURFACE_Y, props)
    expect(getBlock(blocks, LX, 40, LZ)).toBe(blockTypeToIndex('ANDESITE'))
  })

  it('granite takes priority over diorite when both flags are set', () => {
    const blocks = makeBlocks()
    const props = { ...FILL_PROPS, graniteFlag: true, dioriteFlag: true }
    fillColumn(blocks, LX, LZ, WX, WZ, SURFACE_Y, props)
    expect(getBlock(blocks, LX, 40, LZ)).toBe(blockTypeToIndex('GRANITE'))
  })

  it('surfaceDepth=1 means only surfaceY row receives surface block, y=surfaceY-1 is stone', () => {
    const blocks = makeBlocks()
    const props = { ...FILL_PROPS, surfaceDepth: 1 }
    // subSurfaceFloor = Math.max(1, SURFACE_Y - 1) = SURFACE_Y - 1
    // so y = SURFACE_Y-1 falls into the else branch (< subSurfaceFloor is false but y < surfaceY and not >= subSurfaceFloor)
    // Actually: subSurfaceFloor = SURFACE_Y - 1, so y >= subSurfaceFloor for y = SURFACE_Y - 1 → sub-surface block
    // y = SURFACE_Y - 2 falls to stone branch
    fillColumn(blocks, LX, LZ, WX, WZ, SURFACE_Y, props)
    expect(getBlock(blocks, LX, SURFACE_Y, LZ)).toBe(GRASS)    // surface
    expect(getBlock(blocks, LX, SURFACE_Y - 1, LZ)).toBe(DIRT) // sub-surface (exactly at floor)
    expect(getBlock(blocks, LX, SURFACE_Y - 2, LZ)).toBe(STONE) // stone layer
  })
})
