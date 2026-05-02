import { describe, it } from '@effect/vitest'
import { Array as Arr } from 'effect'
import { expect } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/domain'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/terrain-generator'

// ---------------------------------------------------------------------------
// chunkBlockIndexUnchecked
// ---------------------------------------------------------------------------

describe('chunkBlockIndexUnchecked', () => {
  it('returns 0 for the origin (0, 0, 0)', () => {
    expect(chunkBlockIndexUnchecked(0, 0, 0)).toBe(0)
  })

  it('(1, 0, 0) → CHUNK_HEIGHT * CHUNK_SIZE (x stride)', () => {
    expect(chunkBlockIndexUnchecked(1, 0, 0)).toBe(CHUNK_HEIGHT * CHUNK_SIZE)
  })

  it('(0, 1, 0) → 1 (y stride is 1)', () => {
    expect(chunkBlockIndexUnchecked(0, 1, 0)).toBe(1)
  })

  it('(0, 0, 1) → CHUNK_HEIGHT (z stride)', () => {
    expect(chunkBlockIndexUnchecked(0, 0, 1)).toBe(CHUNK_HEIGHT)
  })

  it('is consistent with the formula y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE', () => {
    const cases: Array<[number, number, number]> = [
      [0, 0, 0],
      [1, 5, 3],
      [15, 255, 15],
      [7, 64, 8],
      [0, 100, 15],
    ]
    Arr.forEach(cases, ([x, y, z]) => {
      const expected = y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE
      expect(chunkBlockIndexUnchecked(x, y, z)).toBe(expected)
    })
  })

  it('returns the maximum valid index for (CHUNK_SIZE-1, CHUNK_HEIGHT-1, CHUNK_SIZE-1)', () => {
    const x = CHUNK_SIZE - 1
    const y = CHUNK_HEIGHT - 1
    const z = CHUNK_SIZE - 1
    const expected = y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE
    expect(chunkBlockIndexUnchecked(x, y, z)).toBe(expected)
  })
})
