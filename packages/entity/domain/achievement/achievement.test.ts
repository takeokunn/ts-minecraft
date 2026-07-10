import { describe, it, expect } from 'vitest'
import { evaluateUnlocks, AchievementId, type Achievement } from './achievement'
import { INITIAL_STATISTICS, recordBlockMined, recordItemCrafted } from '../statistics/statistics'

const a = AchievementId.make('a')
const b = AchievementId.make('b')
const c = AchievementId.make('c')

const registry: ReadonlyArray<Achievement> = [
  { id: a, name: 'A', description: 'mine wood', isUnlocked: (s) => (s.blocksMinedByType.WOOD ?? 0) > 0 },
  { id: b, name: 'B', description: 'craft pickaxe', isUnlocked: (s) => (s.itemsCraftedByType.WOODEN_PICKAXE ?? 0) > 0, prerequisite: a },
  { id: c, name: 'C', description: 'craft pickaxe, gated on b', isUnlocked: (s) => (s.itemsCraftedByType.WOODEN_PICKAXE ?? 0) > 0, prerequisite: b },
]

describe('evaluateUnlocks', () => {
  it('unlocks nothing when no condition is met', () => {
    expect(evaluateUnlocks(registry, INITIAL_STATISTICS, new Set())).toEqual([])
  })

  it('unlocks an achievement with no prerequisite once its condition is met', () => {
    const stats = recordBlockMined(INITIAL_STATISTICS, 'WOOD')
    const unlocked = evaluateUnlocks(registry, stats, new Set())
    expect(unlocked.map((x) => x.id)).toEqual([a])
  })

  it('does not unlock a gated achievement until its prerequisite is already satisfied', () => {
    const stats = recordItemCrafted(INITIAL_STATISTICS, 'WOODEN_PICKAXE')
    // b's condition is met but its prerequisite (a) is not unlocked yet.
    const unlocked = evaluateUnlocks(registry, stats, new Set())
    expect(unlocked).toEqual([])
  })

  it('unlocks a gated achievement once its prerequisite is already unlocked (and cascades to the next link in the chain within the same call)', () => {
    const stats = recordItemCrafted(INITIAL_STATISTICS, 'WOODEN_PICKAXE')
    const unlocked = evaluateUnlocks(registry, stats, new Set([a]))
    expect(unlocked.map((x) => x.id)).toEqual([b, c])
  })

  it('resolves a whole prerequisite chain in a single call (fixed-point sweep)', () => {
    const stats = recordItemCrafted(recordBlockMined(INITIAL_STATISTICS, 'WOOD'), 'WOODEN_PICKAXE')
    const unlocked = evaluateUnlocks(registry, stats, new Set())
    expect(unlocked.map((x) => x.id).sort()).toEqual([a, b, c].sort())
  })

  it('does not re-unlock an already-unlocked achievement', () => {
    const stats = recordBlockMined(INITIAL_STATISTICS, 'WOOD')
    const unlocked = evaluateUnlocks(registry, stats, new Set([a]))
    expect(unlocked).toEqual([])
  })
})
