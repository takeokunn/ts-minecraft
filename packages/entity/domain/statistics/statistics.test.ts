import { describe, it, expect } from 'vitest'
import {
  INITIAL_STATISTICS,
  recordDeath,
  recordBlockMined,
  recordMobKilled,
  recordItemCrafted,
  recordDimensionVisited,
} from './statistics'

describe('recordBlockMined', () => {
  it('increments total and per-type count', () => {
    const s1 = recordBlockMined(INITIAL_STATISTICS, 'WOOD')
    expect(s1.blocksMinedTotal).toBe(1)
    expect(s1.blocksMinedByType.WOOD).toBe(1)
    const s2 = recordBlockMined(s1, 'WOOD')
    expect(s2.blocksMinedTotal).toBe(2)
    expect(s2.blocksMinedByType.WOOD).toBe(2)
  })

  it('tracks distinct block types independently', () => {
    const s = recordBlockMined(recordBlockMined(INITIAL_STATISTICS, 'WOOD'), 'STONE')
    expect(s.blocksMinedByType.WOOD).toBe(1)
    expect(s.blocksMinedByType.STONE).toBe(1)
    expect(s.blocksMinedTotal).toBe(2)
  })

  it('does not mutate the input', () => {
    const before = INITIAL_STATISTICS
    recordBlockMined(before, 'WOOD')
    expect(before).toBe(INITIAL_STATISTICS)
    expect(before.blocksMinedTotal).toBe(0)
  })
})

describe('recordMobKilled', () => {
  it('increments total and per-type count', () => {
    const s = recordMobKilled(recordMobKilled(INITIAL_STATISTICS, 'Cow'), 'Cow')
    expect(s.mobsKilledTotal).toBe(2)
    expect(s.mobsKilledByType.Cow).toBe(2)
  })
})

describe('recordItemCrafted', () => {
  it('increments total and per-type count', () => {
    const s = recordItemCrafted(INITIAL_STATISTICS, 'WOODEN_PICKAXE')
    expect(s.itemsCraftedTotal).toBe(1)
    expect(s.itemsCraftedByType.WOODEN_PICKAXE).toBe(1)
  })
})

describe('recordDeath', () => {
  it('increments the death total', () => {
    const s = recordDeath(recordDeath(INITIAL_STATISTICS))
    expect(s.deathsTotal).toBe(2)
  })
})

describe('recordDimensionVisited', () => {
  it('adds a new dimension', () => {
    const s = recordDimensionVisited(INITIAL_STATISTICS, 'nether')
    expect(s.dimensionsVisited).toEqual(['nether'])
  })

  it('does not duplicate an already-visited dimension', () => {
    const s = recordDimensionVisited(recordDimensionVisited(INITIAL_STATISTICS, 'nether'), 'nether')
    expect(s.dimensionsVisited).toEqual(['nether'])
  })

  it('accumulates distinct dimensions', () => {
    const s = recordDimensionVisited(recordDimensionVisited(INITIAL_STATISTICS, 'nether'), 'end')
    expect(s.dimensionsVisited).toEqual(['nether', 'end'])
  })
})
