import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import {
  hasClearCactusHorizontalSides,
  hasRequiredSugarCaneAdjacentWater,
  isMushroomPlacementLightAllowed,
  localHorizontalNeighbors,
} from './block-placement-rules'

describe('block-placement-rules', () => {
  it('builds only in-chunk horizontal neighbors', () => {
    expect(localHorizontalNeighbors(0, 0)).toEqual([
      { lx: 1, lz: 0 },
      { lx: 0, lz: 1 },
    ])
  })

  it('allows mushroom placement only in low light', () => {
    expect(isMushroomPlacementLightAllowed('BROWN_MUSHROOM', 12)).toBe(true)
    expect(isMushroomPlacementLightAllowed('RED_MUSHROOM', 13)).toBe(false)
    expect(isMushroomPlacementLightAllowed('STONE', 15)).toBe(true)
  })

  it('requires adjacent water for sugar cane unless stacked on sugar cane', () => {
    expect(hasRequiredSugarCaneAdjacentWater('SUGAR_CANE', ['AIR', 'AIR'])).toBe(true)
    expect(hasRequiredSugarCaneAdjacentWater('SAND', ['AIR', 'WATER', 'AIR'])).toBe(true)
    expect(hasRequiredSugarCaneAdjacentWater('SAND', ['AIR', 'AIR', 'AIR'])).toBe(false)
  })

  it('requires every cactus side to be air', () => {
    expect(hasClearCactusHorizontalSides(['AIR', 'AIR', 'AIR'])).toBe(true)
    expect(hasClearCactusHorizontalSides(['AIR', 'STONE', 'AIR'])).toBe(false)
  })
})
