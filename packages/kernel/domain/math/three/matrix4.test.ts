import { describe, it, expect } from 'vitest'
import { Array as Arr, HashSet } from 'effect'
import { identity } from './matrix4'

describe('identity', () => {
  it('should be a 4x4 identity matrix with 16 elements', () => {
    expect(identity.elements).toHaveLength(16)
  })

  it('should have 1s on the diagonal (column-major: indices 0, 5, 10, 15)', () => {
    const e = identity.elements
    expect(e[0]).toBe(1)
    expect(e[5]).toBe(1)
    expect(e[10]).toBe(1)
    expect(e[15]).toBe(1)
  })

  it('should have 0s on all off-diagonal elements', () => {
    const e = identity.elements
    const diagonalIndices = HashSet.make(0, 5, 10, 15)
    Arr.forEach(Arr.makeBy(16, i => i), (i) => {
      if (!HashSet.has(diagonalIndices, i)) {
        expect(e[i]).toBe(0)
      }
    })
  })
})
