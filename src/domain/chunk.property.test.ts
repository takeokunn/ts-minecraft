import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { blockIndex, CHUNK_SIZE, CHUNK_HEIGHT } from './chunk'

/**
 * Recovers (x, y, z) coordinates from a flat block index.
 * Inverse of: index = y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE
 */
function indexToCoords(index: number): { x: number; y: number; z: number } {
  const y = index % CHUNK_HEIGHT
  const z = Math.floor(index / CHUNK_HEIGHT) % CHUNK_SIZE
  const x = Math.floor(index / (CHUNK_HEIGHT * CHUNK_SIZE))
  return { x, y, z }
}

const validX = fc.integer({ min: 0, max: CHUNK_SIZE - 1 })
const validY = fc.integer({ min: 0, max: CHUNK_HEIGHT - 1 })
const validZ = fc.integer({ min: 0, max: CHUNK_SIZE - 1 })

describe('blockIndex (property-based)', () => {
  it('returns a non-null index for every in-bounds coordinate', () => {
    fc.assert(
      fc.property(validX, validY, validZ, (x, y, z) => {
        expect(blockIndex(x, y, z)).not.toBeNull()
      })
    )
  })

  it('returns null for out-of-bounds x', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: CHUNK_SIZE, max: CHUNK_SIZE + 100 }),
        validY,
        validZ,
        (x, y, z) => {
          expect(blockIndex(x, y, z)).toBeNull()
        }
      )
    )
  })

  it('returns null for out-of-bounds y', () => {
    fc.assert(
      fc.property(
        validX,
        fc.integer({ min: CHUNK_HEIGHT, max: CHUNK_HEIGHT + 100 }),
        validZ,
        (x, y, z) => {
          expect(blockIndex(x, y, z)).toBeNull()
        }
      )
    )
  })

  it('returns null for out-of-bounds z', () => {
    fc.assert(
      fc.property(
        validX,
        validY,
        fc.integer({ min: CHUNK_SIZE, max: CHUNK_SIZE + 100 }),
        (x, y, z) => {
          expect(blockIndex(x, y, z)).toBeNull()
        }
      )
    )
  })

  it('returns null for negative coordinates', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: -1 }),
        fc.integer({ min: -100, max: -1 }),
        fc.integer({ min: -100, max: -1 }),
        (x, y, z) => {
          expect(blockIndex(x, y, z)).toBeNull()
        }
      )
    )
  })

  it('produces a unique index for every distinct in-bounds coordinate (injectivity)', () => {
    // Sample a subset of the space: collect 200 random (x,y,z) → index pairs
    // and verify no two distinct inputs produce the same index.
    const seen = new Map<number, { x: number; y: number; z: number }>()
    fc.assert(
      fc.property(validX, validY, validZ, (x, y, z) => {
        const idx = blockIndex(x, y, z)
        if (idx === null) return
        const prev = seen.get(idx)
        if (prev !== undefined) {
          expect(prev).toEqual({ x, y, z })
        } else {
          seen.set(idx, { x, y, z })
        }
      }),
      { numRuns: 200 }
    )
  })

  it('round-trips: indexToCoords(blockIndex(x,y,z)) === (x,y,z) for all in-bounds inputs', () => {
    fc.assert(
      fc.property(validX, validY, validZ, (x, y, z) => {
        const idx = blockIndex(x, y, z)
        expect(idx).not.toBeNull()
        const recovered = indexToCoords(idx!)
        expect(recovered).toEqual({ x, y, z })
      })
    )
  })

  it('index is always within the valid flat-array range [0, CHUNK_SIZE*CHUNK_SIZE*CHUNK_HEIGHT)', () => {
    const totalBlocks = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
    fc.assert(
      fc.property(validX, validY, validZ, (x, y, z) => {
        const idx = blockIndex(x, y, z)
        expect(idx).not.toBeNull()
        expect(idx!).toBeGreaterThanOrEqual(0)
        expect(idx!).toBeLessThan(totalBlocks)
      })
    )
  })
})
