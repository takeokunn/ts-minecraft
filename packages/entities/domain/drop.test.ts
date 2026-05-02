import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import type { EntityDrop } from './drop'

describe('EntityDrop', () => {
  it('can construct a valid EntityDrop object', () => {
    const drop: EntityDrop = { blockType: 'GRASS', count: 1 }
    expect(drop.blockType).toBe('GRASS')
    expect(drop.count).toBe(1)
  })

  it('count can be greater than 1', () => {
    const drop: EntityDrop = { blockType: 'STONE', count: 3 }
    expect(drop.count).toBe(3)
  })

  it('blockType is preserved exactly', () => {
    const drop: EntityDrop = { blockType: 'DIRT', count: 2 }
    expect(drop.blockType).toBe('DIRT')
  })
})
