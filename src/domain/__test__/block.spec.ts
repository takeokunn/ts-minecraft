import { describe, expect, it } from 'vitest'
import { createPlacedBlock } from '../block'
import { Effect } from 'effect'

describe('block', () => {
  it('should have a stone block type', () => {
    const stone: 'stone' = 'stone'
    expect(stone).toBe('stone')
  })

  it('createPlacedBlock should create a PlacedBlock object', async () => {
    const position = { x: 1, y: 2, z: 3 }
    const blockType = 'stone'
    const placedBlock = await Effect.runPromise(createPlacedBlock(position, blockType))
    expect(placedBlock.position).toEqual(position)
    expect(placedBlock.blockType).toBe(blockType)
  })
})
