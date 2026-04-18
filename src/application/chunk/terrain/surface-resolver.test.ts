import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE } from '@/domain/chunk'
import { SEA_LEVEL } from '@/application/constants'
import { BEDROCK_LAYER_TOP } from './constants'
import { resolveSurfaceProfile, fillColumn } from './surface-resolver'

// ---------------------------------------------------------------------------
// Shared block indices
// ---------------------------------------------------------------------------

const SAND    = blockTypeToIndex('SAND')
const STONE   = blockTypeToIndex('STONE')
const GRAVEL  = blockTypeToIndex('GRAVEL')
const GRASS   = blockTypeToIndex('GRASS')
const DIRT    = blockTypeToIndex('DIRT')
const BEDROCK = blockTypeToIndex('BEDROCK')
const DEEPSLATE = blockTypeToIndex('DEEPSLATE')

/** Base params shared across most resolveSurfaceProfile tests */
const BASE_PARAMS = {
  defaultSurfaceBlockIndex: GRASS,
  defaultSubSurfaceBlockIndex: DIRT,
  sandBlockIndex: SAND,
  gravelBlockIndex: GRAVEL,
  stoneBlockIndex: STONE,
  // surfaceY, ruggedness, biome, hasLakeBasin, isShore filled per-test
}

// ---------------------------------------------------------------------------
// resolveSurfaceProfile
// ---------------------------------------------------------------------------

describe('resolveSurfaceProfile', () => {
  it('returns sand surface and depth 2 when hasLakeBasin is true', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'PLAINS',
      surfaceY: 60,
      ruggedness: 0.3,
      hasLakeBasin: true,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(SAND)
    expect(profile.subSurfaceBlockIndex).toBe(SAND)
    expect(profile.surfaceDepth).toBe(2)
  })

  it('returns sand surface when isShore is true', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'PLAINS',
      surfaceY: 62,
      ruggedness: 0.2,
      hasLakeBasin: false,
      isShore: true,
    })
    expect(profile.surfaceBlockIndex).toBe(SAND)
    expect(profile.subSurfaceBlockIndex).toBe(DIRT)
    expect(profile.surfaceDepth).toBe(2)
  })

  it('returns default profile for biome DESERT', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'DESERT',
      surfaceY: 65,
      ruggedness: 0.8,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(GRASS)
    expect(profile.subSurfaceBlockIndex).toBe(DIRT)
    expect(profile.surfaceDepth).toBe(3)
  })

  it('returns gravel surface and stone sub for MOUNTAINS with ruggedness >= 0.52', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'MOUNTAINS',
      surfaceY: 70,
      ruggedness: 0.55,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(GRAVEL)
    expect(profile.subSurfaceBlockIndex).toBe(STONE)
    expect(profile.surfaceDepth).toBe(2)
  })

  it('returns default profile for MOUNTAINS with ruggedness < 0.52', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'MOUNTAINS',
      surfaceY: 70,
      ruggedness: 0.40,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(GRASS)
    expect(profile.subSurfaceBlockIndex).toBe(DIRT)
    expect(profile.surfaceDepth).toBe(3)
  })

  it('returns stone surface and depth 1 for SNOW alpine (surfaceY >= SEA_LEVEL+28) with ruggedness >= 0.48', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'SNOW',
      surfaceY: SEA_LEVEL + 28, // exactly at the alpine threshold
      ruggedness: 0.50,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(STONE)
    expect(profile.subSurfaceBlockIndex).toBe(STONE)
    expect(profile.surfaceDepth).toBe(1)
  })

  it('returns default profile for PLAINS', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'PLAINS',
      surfaceY: 65,
      ruggedness: 0.1,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(GRASS)
    expect(profile.subSurfaceBlockIndex).toBe(DIRT)
    expect(profile.surfaceDepth).toBe(3)
  })

  it('returns stone surface and depth 1 for general alpine + ruggedness >= 0.52', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'FOREST',
      surfaceY: SEA_LEVEL + 28, // alpine
      ruggedness: 0.60,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(STONE)
    expect(profile.subSurfaceBlockIndex).toBe(STONE)
    expect(profile.surfaceDepth).toBe(1)
  })

  it('hasLakeBasin takes priority over isShore', () => {
    // Both flags set — lake basin branch fires first
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'PLAINS',
      surfaceY: 60,
      ruggedness: 0.1,
      hasLakeBasin: true,
      isShore: true,
    })
    // Lake basin → sand surface AND sand sub
    expect(profile.subSurfaceBlockIndex).toBe(SAND)
  })
})

// ---------------------------------------------------------------------------
// fillColumn
// ---------------------------------------------------------------------------

/** Minimal fillColumn props; caller overrides what's needed */
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

/** Read the block at local (lx, y, lz) from a Uint8Array */
const getBlock = (blocks: Uint8Array, lx: number, y: number, lz: number): number => {
  return blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE]!
}

/** Return a zeroed chunk block array (65536 bytes) */
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
})
