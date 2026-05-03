import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { blockTypeToIndex, SEA_LEVEL } from '@ts-minecraft/kernel'
import { resolveSurfaceProfile } from '@ts-minecraft/terrain'

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
}

describe('resolveSurfaceProfile — biome edge cases', () => {
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
