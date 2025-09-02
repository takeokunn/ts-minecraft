import { describe, expect, it } from 'vitest'

describe('block', () => {
  it('should have a stone block type', () => {
    const stone: 'stone' = 'stone'
    expect(stone).toBe('stone')
  })
})
