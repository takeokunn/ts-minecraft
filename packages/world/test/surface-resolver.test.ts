import { describe, it } from '@effect/vitest'
import { blockTypeToIndex, SEA_LEVEL } from '@ts-minecraft/core'
import { resolveSurfaceProfile } from '@ts-minecraft/world'
import { expect } from 'vitest'

// ---------------------------------------------------------------------------
// Shared block indices
// ---------------------------------------------------------------------------

const SAND    = blockTypeToIndex('SAND')
const STONE   = blockTypeToIndex('STONE')
const GRAVEL  = blockTypeToIndex('GRAVEL')
const GRASS   = blockTypeToIndex('GRASS')
const DIRT    = blockTypeToIndex('DIRT')

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

  it('respects a custom seaLevel when evaluating alpine and outcrop thresholds', () => {
    const terrainLevels = { seaLevel: 40, lakeLevel: 52 }
    const profile = resolveSurfaceProfile({
      ...BASE_PARAMS,
      biome: 'FOREST',
      surfaceY: terrainLevels.seaLevel + 28,
      ruggedness: 0.6,
      hasLakeBasin: false,
      isShore: false,
      terrainLevels,
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
})
