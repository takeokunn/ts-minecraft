import { describe, expect, it } from 'vitest'
import { BlockType, createPlacedBlock } from '../block'
import { Vector3Int } from '../common'

describe('createPlacedBlock', () => {
  it('should create a PlacedBlock object', () => {
    const position: Vector3Int = [1, 2, 3]
    const blockType: BlockType = 'grass'
    const placedBlock = createPlacedBlock(position, blockType)
    expect(placedBlock).toEqual({ position, blockType })
  })
})