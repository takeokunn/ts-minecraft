import { describe, it, expect } from 'vitest'
import { getInventoryDropForBlock } from '../application/block-service.config'

describe('getInventoryDropForBlock — vanilla drop correctness', () => {
  it('GRASS drops DIRT (not GRASS)', () => {
    expect(getInventoryDropForBlock('GRASS')).toBe('DIRT')
  })

  it('STONE drops COBBLESTONE', () => {
    expect(getInventoryDropForBlock('STONE')).toBe('COBBLESTONE')
  })

  it('FARMLAND drops DIRT', () => {
    expect(getInventoryDropForBlock('FARMLAND')).toBe('DIRT')
  })

  it('DIAMOND_ORE drops DIAMOND', () => {
    expect(getInventoryDropForBlock('DIAMOND_ORE')).toBe('DIAMOND')
  })

  it('REDSTONE_WIRE drops REDSTONE_DUST', () => {
    expect(getInventoryDropForBlock('REDSTONE_WIRE')).toBe('REDSTONE_DUST')
  })

  it('REDSTONE_TORCH drops itself (REDSTONE_TORCH, not REDSTONE_DUST)', () => {
    expect(getInventoryDropForBlock('REDSTONE_TORCH')).toBe('REDSTONE_TORCH')
  })

  it('COBBLESTONE drops itself (no override)', () => {
    expect(getInventoryDropForBlock('COBBLESTONE')).toBe('COBBLESTONE')
  })

  it('DIRT drops itself', () => {
    expect(getInventoryDropForBlock('DIRT')).toBe('DIRT')
  })
})
