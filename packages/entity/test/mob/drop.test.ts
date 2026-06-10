import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import type { EntityDrop } from '../../domain/mob/drop'
import { dropPasses } from '../../domain/mob/drop'

describe('EntityDrop', () => {
  it('can construct a valid EntityDrop object with a BlockType', () => {
    const drop: EntityDrop = { blockType: 'STONE', count: 1 }
    expect(drop.blockType).toBe('STONE')
    expect(drop.count).toBe(1)
  })

  it('count can be greater than 1', () => {
    const drop: EntityDrop = { blockType: 'STONE', count: 3 }
    expect(drop.count).toBe(3)
  })

  it('blockType is preserved exactly', () => {
    const drop: EntityDrop = { blockType: 'COBBLESTONE', count: 2 }
    expect(drop.blockType).toBe('COBBLESTONE')
  })

  it('accepts an ItemType (ROTTEN_FLESH) as blockType', () => {
    const drop: EntityDrop = { blockType: 'ROTTEN_FLESH', count: 1 }
    expect(drop.blockType).toBe('ROTTEN_FLESH')
  })

  it('accepts an ItemType (COAL) as blockType', () => {
    const drop: EntityDrop = { blockType: 'COAL', count: 1 }
    expect(drop.blockType).toBe('COAL')
  })

  it('accepts a BlockType (PLANKS) as blockType', () => {
    const drop: EntityDrop = { blockType: 'PLANKS', count: 1 }
    expect(drop.blockType).toBe('PLANKS')
  })

  it('accepts an optional chance field for rare drops (R71)', () => {
    const drop: EntityDrop = { blockType: 'CARROT', count: 1, chance: 0.025 }
    expect(drop.chance).toBe(0.025)
  })
})

// R71: pure drop-chance predicate used by the kill handler.
describe('dropPasses', () => {
  it('un-gated drops (no chance) always pass, regardless of roll', () => {
    const drop: EntityDrop = { blockType: 'ROTTEN_FLESH', count: 1 }
    expect(dropPasses(drop, 0)).toBe(true)
    expect(dropPasses(drop, 0.99)).toBe(true)
    expect(dropPasses(drop, 1)).toBe(true)
  })

  it('chance-gated drop passes when roll is below chance', () => {
    const drop: EntityDrop = { blockType: 'CARROT', count: 1, chance: 0.025 }
    expect(dropPasses(drop, 0)).toBe(true)
    expect(dropPasses(drop, 0.024)).toBe(true)
  })

  it('chance-gated drop fails when roll is at or above chance', () => {
    const drop: EntityDrop = { blockType: 'CARROT', count: 1, chance: 0.025 }
    expect(dropPasses(drop, 0.025)).toBe(false)
    expect(dropPasses(drop, 0.5)).toBe(false)
  })
})
