import { describe, it, expect } from 'vitest'
import { ACHIEVEMENT_REGISTRY } from './achievement-registry'
import { evaluateUnlocks } from './achievement'
import {
  INITIAL_STATISTICS,
  recordBlockMined,
  recordItemCrafted,
  recordMobKilled,
  recordDimensionVisited,
} from '../statistics/statistics'

describe('ACHIEVEMENT_REGISTRY', () => {
  it('has unique ids', () => {
    const ids = ACHIEVEMENT_REGISTRY.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every prerequisite references a real registry entry', () => {
    const ids = new Set(ACHIEVEMENT_REGISTRY.map((a) => a.id))
    for (const achievement of ACHIEVEMENT_REGISTRY) {
      if (achievement.prerequisite !== undefined) {
        expect(ids.has(achievement.prerequisite)).toBe(true)
      }
    }
  })

  it('every achievement is reachable from empty statistics via its own hooks', () => {
    let stats = INITIAL_STATISTICS
    stats = recordBlockMined(stats, 'WOOD')
    stats = recordBlockMined(stats, 'DIAMOND_ORE')
    stats = recordItemCrafted(stats, 'CRAFTING_TABLE')
    stats = recordItemCrafted(stats, 'WOODEN_PICKAXE')
    stats = recordItemCrafted(stats, 'WOODEN_SWORD')
    stats = recordItemCrafted(stats, 'FURNACE')
    stats = recordItemCrafted(stats, 'IRON_PICKAXE')
    stats = recordMobKilled(stats, 'Cow')
    stats = recordMobKilled(stats, 'Zombie')
    stats = recordDimensionVisited(stats, 'nether')
    stats = recordDimensionVisited(stats, 'end')

    const unlocked = evaluateUnlocks(ACHIEVEMENT_REGISTRY, stats, new Set())
    expect(unlocked.length).toBe(ACHIEVEMENT_REGISTRY.length)
  })
})
