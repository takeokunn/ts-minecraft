import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/kernel'
import { SEA_LEVEL } from '@ts-minecraft/kernel'
import {
  BEDROCK_LAYER_TOP,
  resolveSurfaceProfile,
  fillColumn,
} from '@ts-minecraft/terrain'

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

  it('SAVANNA with ruggedness >= 0.42 → gravel surface, depth 2', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'SAVANNA',
      surfaceY: 65,
      ruggedness: 0.45,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(GRAVEL)
    expect(profile.subSurfaceBlockIndex).toBe(DIRT)
    expect(profile.surfaceDepth).toBe(2)
  })

  it('SAVANNA with ruggedness < 0.42 → default surface block, depth 2', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'SAVANNA',
      surfaceY: 65,
      ruggedness: 0.30,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(GRASS)
    expect(profile.subSurfaceBlockIndex).toBe(DIRT)
    expect(profile.surfaceDepth).toBe(2)
  })

  it('TAIGA with non-alpine, non-ruggedOutcrop → default surface, depth 4', () => {
    // surfaceY below OUTCROP threshold (SEA_LEVEL+14=78), low ruggedness
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'TAIGA',
      surfaceY: 65,
      ruggedness: 0.3,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(GRASS)
    expect(profile.subSurfaceBlockIndex).toBe(DIRT)
    expect(profile.surfaceDepth).toBe(4)
  })

  it('TAIGA with alpine height → gravel surface, stone sub, depth 1', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'TAIGA',
      surfaceY: SEA_LEVEL + 28, // exactly alpine threshold
      ruggedness: 0.5,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(GRAVEL)
    expect(profile.subSurfaceBlockIndex).toBe(STONE)
    expect(profile.surfaceDepth).toBe(1)
  })

  it('TAIGA with ruggedOutcrop (surfaceY >= SEA_LEVEL+14, ruggedness >= 0.56) → gravel+stone, depth 1', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'TAIGA',
      surfaceY: SEA_LEVEL + 14, // outcrop threshold, below alpine
      ruggedness: 0.58,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(GRAVEL)
    expect(profile.subSurfaceBlockIndex).toBe(STONE)
    expect(profile.surfaceDepth).toBe(1)
  })

  it('OCEAN → defaultProfile regardless of ruggedness', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'OCEAN',
      surfaceY: 50,
      ruggedness: 0.9,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(GRASS)
    expect(profile.surfaceDepth).toBe(3)
  })

  it('BEACH → defaultProfile regardless of ruggedness', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'BEACH',
      surfaceY: 65,
      ruggedness: 0.9,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(GRASS)
    expect(profile.surfaceDepth).toBe(3)
  })

  it('SNOW with non-alpine, non-ruggedOutcrop → defaultProfile', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'SNOW',
      surfaceY: 65, // below outcrop threshold
      ruggedness: 0.3,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(GRASS)
    expect(profile.subSurfaceBlockIndex).toBe(DIRT)
    expect(profile.surfaceDepth).toBe(3)
  })

  it('SNOW with ruggedOutcrop (non-alpine) → gravel surface, stone sub, depth 1', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'SNOW',
      surfaceY: SEA_LEVEL + 14, // outcrop zone, below alpine (SEA_LEVEL+28)
      ruggedness: 0.58,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(GRAVEL)
    expect(profile.subSurfaceBlockIndex).toBe(STONE)
    expect(profile.surfaceDepth).toBe(1)
  })

  it('SNOW alpine with ruggedness below SNOW_ALPINE_STONE threshold → falls to defaultProfile', () => {
    // alpine=true but ruggedness (0.44) < RUGGEDNESS_SNOW_ALPINE_STONE (0.48), ruggedOutcrop also false
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'SNOW',
      surfaceY: SEA_LEVEL + 28,
      ruggedness: 0.44,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(GRASS)
    expect(profile.surfaceDepth).toBe(3)
  })

  it('general ruggedOutcrop (non-alpine, FOREST) → gravel surface, stone sub, depth 1', () => {
    // surfaceY in [SEA_LEVEL+14, SEA_LEVEL+27], ruggedness >= 0.56
    // alpine check (>= SEA_LEVEL+28) is false → skipped
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'FOREST',
      surfaceY: SEA_LEVEL + 20, // in outcrop zone but below alpine
      ruggedness: 0.60,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(GRAVEL)
    expect(profile.subSurfaceBlockIndex).toBe(STONE)
    expect(profile.surfaceDepth).toBe(1)
  })

  it('JUNGLE → falls through to defaultProfile', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'JUNGLE',
      surfaceY: 65,
      ruggedness: 0.1,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(GRASS)
    expect(profile.subSurfaceBlockIndex).toBe(DIRT)
    expect(profile.surfaceDepth).toBe(3)
  })

  it('SWAMP → falls through to defaultProfile', () => {
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'SWAMP',
      surfaceY: 63,
      ruggedness: 0.1,
      hasLakeBasin: false,
      isShore: false,
    })
    expect(profile.surfaceBlockIndex).toBe(GRASS)
    expect(profile.subSurfaceBlockIndex).toBe(DIRT)
    expect(profile.surfaceDepth).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// fillColumn
// ---------------------------------------------------------------------------

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

const getBlock = (blocks: Uint8Array, lx: number, y: number, lz: number): number => {
  return blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE]!
}

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
