import { describe, it } from '@effect/vitest'
import { Array as Arr } from 'effect'
import { expect } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import {
  chunkBlockIndexUnchecked,
  clamp01,
  computeRuggedness,
  fract,
  hash3,
  seedFromChunk,
  smoothstep,
} from '@ts-minecraft/world'
import { mulberry32 } from '../domain/terrain/math'

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

// ---------------------------------------------------------------------------
// smoothstep
// ---------------------------------------------------------------------------

describe('smoothstep', () => {
  it('returns 0 at edge0', () => {
    expect(smoothstep(0, 1, 0)).toBe(0)
  })

  it('returns 1 at edge1', () => {
    expect(smoothstep(0, 1, 1)).toBe(1)
  })

  it('returns 0.5 at the midpoint', () => {
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5)
  })

  it('clamps below edge0 to 0', () => {
    expect(smoothstep(0.2, 0.8, 0.0)).toBe(0)
  })

  it('clamps above edge1 to 1', () => {
    expect(smoothstep(0.2, 0.8, 1.0)).toBe(1)
  })

  it('output is in [0, 1] for arbitrary in-range input', () => {
    Arr.forEach(Arr.makeBy(11, (i) => i / 10), (x) => {
      const result = smoothstep(0, 1, x)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThanOrEqual(1)
    })
  })
})

// ---------------------------------------------------------------------------
// fract
// ---------------------------------------------------------------------------

describe('fract', () => {
  it('returns fractional part of positive number', () => {
    expect(fract(3.75)).toBeCloseTo(0.75)
  })

  it('returns 0 for integer values', () => {
    expect(fract(5)).toBe(0)
  })

  it('returns fractional part of negative number', () => {
    // fract(-1.25) = -1.25 - floor(-1.25) = -1.25 - (-2) = 0.75
    expect(fract(-1.25)).toBeCloseTo(0.75)
  })

  it('result is always in [0, 1)', () => {
    const cases = [0.0, 0.5, 1.0, 1.9, -0.3, -1.7, 100.99]
    Arr.forEach(cases, (v) => {
      const r = fract(v)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(1)
    })
  })
})

// ---------------------------------------------------------------------------
// clamp01
// ---------------------------------------------------------------------------

describe('clamp01', () => {
  it('returns value unchanged when in [0, 1]', () => {
    expect(clamp01(0.5)).toBe(0.5)
  })

  it('clamps negative values to 0', () => {
    expect(clamp01(-5)).toBe(0)
  })

  it('clamps values > 1 to 1', () => {
    expect(clamp01(3.14)).toBe(1)
  })

  it('returns 0 at boundary', () => {
    expect(clamp01(0)).toBe(0)
  })

  it('returns 1 at boundary', () => {
    expect(clamp01(1)).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// hash3
// ---------------------------------------------------------------------------

describe('hash3', () => {
  it('returns a value in [0, 1)', () => {
    const cases = [[0, 0, 0], [1, 5, 3], [100, 64, 200], [-5, 10, 7]] as const
    Arr.forEach(cases, ([wx, y, wz]) => {
      const h = hash3(wx, y, wz)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(1)
    })
  })

  it('is deterministic for same inputs', () => {
    expect(hash3(42, 7, 13)).toBe(hash3(42, 7, 13))
  })

  it('produces different values for different inputs', () => {
    const a = hash3(0, 0, 0)
    const b = hash3(1, 0, 0)
    const c = hash3(0, 1, 0)
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
  })
})

// ---------------------------------------------------------------------------
// mulberry32
// ---------------------------------------------------------------------------

describe('mulberry32', () => {
  it('returns value in [0, 1)', () => {
    const { value } = mulberry32(12345)
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThan(1)
  })

  it('is deterministic: same state produces same output', () => {
    const a = mulberry32(99999)
    const b = mulberry32(99999)
    expect(a.value).toBe(b.value)
    expect(a.state).toBe(b.state)
  })

  it('advances state on each call', () => {
    const step1 = mulberry32(0)
    const step2 = mulberry32(step1.state)
    expect(step2.state).not.toBe(step1.state)
    expect(step2.value).not.toBe(step1.value)
  })

  it('produces a uniform-looking sequence over many steps', () => {
    let state = 1
    const values: number[] = []
    Arr.forEach(Arr.makeBy(100, () => undefined), () => {
      const result = mulberry32(state)
      state = result.state
      values.push(result.value)
    })
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    expect(avg).toBeGreaterThan(0.3)
    expect(avg).toBeLessThan(0.7)
  })
})

// ---------------------------------------------------------------------------
// seedFromChunk
// ---------------------------------------------------------------------------

describe('seedFromChunk', () => {
  it('is deterministic for same inputs', () => {
    expect(seedFromChunk(10, 20, 1, 2)).toBe(seedFromChunk(10, 20, 1, 2))
  })

  it('returns a non-negative 32-bit integer', () => {
    const seed = seedFromChunk(5, 10, 3, 7)
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThan(2 ** 32)
    expect(Number.isInteger(seed)).toBe(true)
  })

  it('different chunk coords produce different seeds', () => {
    const a = seedFromChunk(0, 0, 0, 0)
    const b = seedFromChunk(1, 0, 0, 0)
    const c = seedFromChunk(0, 1, 0, 0)
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
  })

  it('different salt values produce different seeds for same chunk', () => {
    const a = seedFromChunk(5, 5, 1, 1)
    const b = seedFromChunk(5, 5, 2, 1)
    expect(a).not.toBe(b)
  })
})

// ---------------------------------------------------------------------------
// computeRuggedness
// ---------------------------------------------------------------------------

describe('computeRuggedness', () => {
  it('returns a value in [0, 1]', () => {
    const cases = [
      [0, 0], [1, 0], [-1, 0], [0.5, 0.5], [-0.5, -0.5], [0, 1],
    ] as const
    Arr.forEach(cases, ([erosion, jaggedness]) => {
      const r = computeRuggedness(erosion, jaggedness)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(1)
    })
  })

  it('low erosion (smooth terrain) with zero jaggedness → higher ruggedness', () => {
    // erosion=-1 → normalizedErosion=0 → (1-0)*0.6 = 0.6; jaggedness=0 → 0.6 total
    expect(computeRuggedness(-1, 0)).toBeCloseTo(0.6)
  })

  it('high erosion with zero jaggedness → lower ruggedness', () => {
    // erosion=1 → normalizedErosion=1 → (1-1)*0.6 = 0; jaggedness=0 → 0 total
    expect(computeRuggedness(1, 0)).toBeCloseTo(0)
  })

  it('jaggedness adds to ruggedness', () => {
    const withoutJag = computeRuggedness(0, 0)
    const withJag = computeRuggedness(0, 1)
    expect(withJag).toBeGreaterThan(withoutJag)
  })
})
