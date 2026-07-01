import { describe, expect, it } from 'vitest'
import { dropPasses, type EntityDrop } from '@ts-minecraft/entity/domain/mob/drop'

// ─── dropPasses ───────────────────────────────────────────────────────────────
describe('dropPasses', () => {
  const guaranteed: EntityDrop = { blockType: 'BONE', count: 1 }
  const halfChance: EntityDrop = { blockType: 'BONE', count: 1, chance: 0.5 }

  it('always passes when no chance is set', () => {
    expect(dropPasses(guaranteed, 0)).toBe(true)
    expect(dropPasses(guaranteed, 0.99)).toBe(true)
    expect(dropPasses(guaranteed, 1)).toBe(true)
  })

  it('passes when roll is strictly less than chance', () => {
    expect(dropPasses(halfChance, 0)).toBe(true)
    expect(dropPasses(halfChance, 0.49)).toBe(true)
  })

  it('fails when roll equals chance', () => {
    expect(dropPasses(halfChance, 0.5)).toBe(false)
  })

  it('fails when roll exceeds chance', () => {
    expect(dropPasses(halfChance, 0.99)).toBe(false)
  })

  it('handles chance of 1 (always pass)', () => {
    const always: EntityDrop = { blockType: 'BONE', count: 1, chance: 1 }
    expect(dropPasses(always, 0)).toBe(true)
    expect(dropPasses(always, 0.99)).toBe(true)
  })

  it('handles chance of 0 (never passes)', () => {
    const never: EntityDrop = { blockType: 'BONE', count: 1, chance: 0 }
    expect(dropPasses(never, 0)).toBe(false)
  })
})
