import { describe, it, expect } from 'vitest'
import { getChunkId } from '../world'

describe('getChunkId', () => {
  it('should return a string in the format "x,z"', () => {
    expect(getChunkId(0, 0)).toBe('0,0')
    expect(getChunkId(10, -5)).toBe('10,-5')
    expect(getChunkId(-1, 1)).toBe('-1,1')
  })
})
