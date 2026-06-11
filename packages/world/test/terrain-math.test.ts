import { describe, it, expect } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import {
  smoothstep,
  mulberry32,
  seedFromChunk,
  hash3,
  chunkBlockIndexUnchecked,
  fract,
  clamp01,
  computeRuggedness,
} from '../domain/terrain/math'

describe('smoothstep', () => {
  it('returns 0 at x=edge0', () => {
    expect(smoothstep(0, 1, 0)).toBe(0)
  })

  it('returns 1 at x=edge1', () => {
    expect(smoothstep(0, 1, 1)).toBe(1)
  })

  it('returns 0.5 at x midpoint', () => {
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 5)
  })

  it('clamps to 0 for x < edge0', () => {
    expect(smoothstep(0, 1, -0.5)).toBe(0)
  })

  it('clamps to 1 for x > edge1', () => {
    expect(smoothstep(0, 1, 2)).toBe(1)
  })

  it('S-curve is monotonically increasing', () => {
    let prev = 0
    for (let i = 1; i <= 10; i++) {
      const val = smoothstep(0, 10, i)
      expect(val).toBeGreaterThan(prev)
      prev = val
    }
  })

  it('derivative at midpoint is steeper than at edges (S-curve shape)', () => {
    const dx = 0.01
    const gradEdge = smoothstep(0, 1, dx) - smoothstep(0, 1, 0)
    const gradMid = smoothstep(0, 1, 0.5 + dx) - smoothstep(0, 1, 0.5)
    expect(gradMid).toBeGreaterThan(gradEdge)
  })
})

describe('mulberry32', () => {
  it('returns value in [0, 1)', () => {
    const { value } = mulberry32(12345)
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThan(1)
  })

  it('is deterministic: same state → same output', () => {
    const r1 = mulberry32(42)
    const r2 = mulberry32(42)
    expect(r1.value).toBe(r2.value)
    expect(r1.state).toBe(r2.state)
  })

  it('different states produce different values', () => {
    const r1 = mulberry32(1)
    const r2 = mulberry32(2)
    expect(r1.value).not.toBe(r2.value)
  })

  it('produces a sequence when state is chained', () => {
    const first = mulberry32(0)
    const second = mulberry32(first.state)
    expect(second.value).not.toBe(first.value)
  })

  it('generates uniformly distributed values over many steps', () => {
    let state = 999
    let sum = 0
    const N = 1000
    for (let i = 0; i < N; i++) {
      const r = mulberry32(state)
      sum += r.value
      state = r.state
    }
    expect(sum / N).toBeCloseTo(0.5, 1)
  })
})

describe('seedFromChunk', () => {
  it('returns a non-negative integer', () => {
    const seed = seedFromChunk(3, -7, 100, 200)
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(seed)).toBe(true)
  })

  it('is deterministic', () => {
    expect(seedFromChunk(0, 0, 1, 2)).toBe(seedFromChunk(0, 0, 1, 2))
  })

  it('different chunk coords produce different seeds', () => {
    expect(seedFromChunk(0, 0, 0, 0)).not.toBe(seedFromChunk(1, 0, 0, 0))
    expect(seedFromChunk(0, 0, 0, 0)).not.toBe(seedFromChunk(0, 1, 0, 0))
  })

  it('different salts produce different seeds', () => {
    expect(seedFromChunk(0, 0, 1, 0)).not.toBe(seedFromChunk(0, 0, 2, 0))
  })
})

describe('hash3', () => {
  it('returns a value in [0, 1)', () => {
    const v = hash3(10, 64, -5)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThan(1)
  })

  it('is deterministic', () => {
    expect(hash3(1, 2, 3)).toBe(hash3(1, 2, 3))
  })

  it('different inputs produce different outputs', () => {
    expect(hash3(0, 0, 0)).not.toBe(hash3(1, 0, 0))
    expect(hash3(0, 0, 0)).not.toBe(hash3(0, 1, 0))
  })
})

describe('chunkBlockIndexUnchecked', () => {
  it('returns 0 for the origin (0,0,0)', () => {
    expect(chunkBlockIndexUnchecked(0, 0, 0)).toBe(0)
  })

  it('y varies fastest (column-major in y)', () => {
    expect(chunkBlockIndexUnchecked(0, 1, 0)).toBe(1)
    expect(chunkBlockIndexUnchecked(0, 2, 0)).toBe(2)
  })

  it('z stride is CHUNK_HEIGHT', () => {
    expect(chunkBlockIndexUnchecked(0, 0, 1)).toBe(CHUNK_HEIGHT)
  })

  it('x stride is CHUNK_HEIGHT × CHUNK_SIZE', () => {
    expect(chunkBlockIndexUnchecked(1, 0, 0)).toBe(CHUNK_HEIGHT * CHUNK_SIZE)
  })

  it('is consistent with the formula y + z*H + x*H*S', () => {
    const x = 3, y = 50, z = 7
    expect(chunkBlockIndexUnchecked(x, y, z)).toBe(y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE)
  })
})

describe('fract', () => {
  it('returns 0 for integers', () => {
    expect(fract(3)).toBe(0)
    expect(fract(-2)).toBe(0)
  })

  it('returns fractional part for positive numbers', () => {
    expect(fract(3.7)).toBeCloseTo(0.7, 5)
  })

  it('returns fractional part for negative numbers (floor-based)', () => {
    // floor(-0.3) = -1, so fract(-0.3) = -0.3 - (-1) = 0.7
    expect(fract(-0.3)).toBeCloseTo(0.7, 5)
  })

  it('result is always in [0, 1)', () => {
    const values = [0, 0.5, 1.5, -0.5, -1.5, 100.99]
    for (const v of values) {
      const r = fract(v)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(1)
    }
  })
})

describe('clamp01', () => {
  it('returns 0 for values < 0', () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(-0.001)).toBe(0)
  })

  it('returns 1 for values > 1', () => {
    expect(clamp01(2)).toBe(1)
    expect(clamp01(1.001)).toBe(1)
  })

  it('passes through values in [0, 1]', () => {
    expect(clamp01(0)).toBe(0)
    expect(clamp01(0.5)).toBe(0.5)
    expect(clamp01(1)).toBe(1)
  })
})

describe('computeRuggedness', () => {
  it('returns value in [0, 1]', () => {
    for (const erosion of [-1, -0.5, 0, 0.5, 1]) {
      for (const jaggedness of [-1, 0, 1]) {
        const v = computeRuggedness(erosion, jaggedness)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })

  it('increases with jaggedness magnitude', () => {
    const atZeroJag = computeRuggedness(0, 0)
    const atHighJag = computeRuggedness(0, 1)
    expect(atHighJag).toBeGreaterThan(atZeroJag)
  })

  it('decreases with increasing erosion (high erosion → lower ruggedness)', () => {
    const lowErosion = computeRuggedness(-1, 0)
    const highErosion = computeRuggedness(1, 0)
    expect(highErosion).toBeLessThan(lowErosion)
  })
})
