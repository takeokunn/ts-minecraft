import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import {
  smoothstep,
  seedFromChunk,
} from '@ts-minecraft/world'
import { mulberry32, hash3, fract, clamp01, computeRuggedness } from '../domain/terrain/math'

describe('smoothstep', () => {
  it('returns 0 when x <= edge0', () => {
    expect(smoothstep(0, 1, 0)).toBe(0)
    expect(smoothstep(0, 1, -1)).toBe(0)
    expect(smoothstep(10, 40, 10)).toBe(0)
    expect(smoothstep(10, 40, 5)).toBe(0)
  })

  it('returns 1 when x >= edge1', () => {
    expect(smoothstep(0, 1, 1)).toBe(1)
    expect(smoothstep(0, 1, 2)).toBe(1)
    expect(smoothstep(10, 40, 40)).toBe(1)
    expect(smoothstep(10, 40, 100)).toBe(1)
  })

  it('returns 0.5 at the midpoint between edge0 and edge1', () => {
    // t=0.5 → 0.5*0.5*(3-2*0.5) = 0.25*2 = 0.5
    expect(smoothstep(0, 1, 0.5)).toBe(0.5)
    expect(smoothstep(0, 2, 1)).toBe(0.5)
    expect(smoothstep(10, 40, 25)).toBe(0.5)
  })

  it('output is strictly between 0 and 1 for x strictly between edge0 and edge1', () => {
    Arr.forEach([0.1, 0.25, 0.75, 0.9] as const, x => {
      const result = smoothstep(0, 1, x)
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(1)
    })
  })

  it('is monotonically increasing within the input range', () => {
    Arr.reduce([0.1, 0.2, 0.5, 0.8, 0.9, 1] as const, smoothstep(0, 1, 0), (prev, x) => {
      const cur = smoothstep(0, 1, x)
      expect(cur).toBeGreaterThanOrEqual(prev)
      return cur
    })
  })

  it('matches the canonical formula t*t*(3-2*t) for t in [0,1]', () => {
    Arr.forEach([0, 0.25, 0.5, 0.75, 1] as const, t => {
      const expected = t * t * (3 - 2 * t)
      expect(smoothstep(0, 1, t)).toBeCloseTo(expected, 10)
    })
  })
})

describe('mulberry32', () => {
  it('is deterministic — same input always produces the same output', () => {
    const r1 = mulberry32(12345)
    const r2 = mulberry32(12345)
    expect(r1.state).toBe(r2.state)
    expect(r1.value).toBe(r2.value)
  })

  it('value is in [0, 1)', () => {
    Arr.forEach([0, 1, 42, 0xdeadbeef, 0xffffffff] as const, seed => {
      const { value } = mulberry32(seed)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    })
  })

  it('advances state on each call (chained output differs from input)', () => {
    const r1 = mulberry32(0)
    const r2 = mulberry32(r1.state)
    expect(r2.state).not.toBe(r1.state)
    expect(r2.value).not.toBe(r1.value)
  })

  it('produces a deterministic sequence when chained', () => {
    const seq1 = [mulberry32(100)]
    seq1.push(mulberry32(seq1[0]!.state))
    seq1.push(mulberry32(seq1[1]!.state))

    const seq2 = [mulberry32(100)]
    seq2.push(mulberry32(seq2[0]!.state))
    seq2.push(mulberry32(seq2[1]!.state))

    Arr.forEach(Arr.zip(seq1, seq2), ([s1, s2]) => expect(s1.value).toBe(s2.value))
  })

  it('different seeds produce different values', () => {
    const v1 = mulberry32(1).value
    const v2 = mulberry32(2).value
    expect(v1).not.toBe(v2)
  })
})

describe('seedFromChunk', () => {
  it('is deterministic — same inputs always produce the same seed', () => {
    const s1 = seedFromChunk(10, 20, 100, 200)
    const s2 = seedFromChunk(10, 20, 100, 200)
    expect(s1).toBe(s2)
  })

  it('returns a non-negative 32-bit unsigned integer (0 ≤ result < 2^32)', () => {
    const cases: Array<[number, number, number, number]> = [
      [0, 0, 0, 0],
      [1, 1, 10007, 20011],
      [-16, 32, 30013, 40013],
      [1000, -500, 70037, 80039],
    ]
    Arr.forEach(cases, ([wx, wz, sx, sz]) => {
      const seed = seedFromChunk(wx, wz, sx, sz)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(seed).toBeLessThan(4294967296) // 2^32
      expect(Number.isInteger(seed)).toBe(true)
    })
  })

  it('different world coordinates produce different seeds (with the same salt)', () => {
    const salt = [10007, 20011] as const
    const s1 = seedFromChunk(0, 0, ...salt)
    const s2 = seedFromChunk(1, 0, ...salt)
    const s3 = seedFromChunk(0, 1, ...salt)
    expect(s1).not.toBe(s2)
    expect(s1).not.toBe(s3)
    expect(s2).not.toBe(s3)
  })

  it('different salts produce different seeds (with the same world coordinate)', () => {
    const s1 = seedFromChunk(0, 0, 10007, 20011)
    const s2 = seedFromChunk(0, 0, 30013, 40013)
    expect(s1).not.toBe(s2)
  })
})

describe('fract', () => {
  it('returns the fractional part (value - floor)', () => {
    expect(fract(1.7)).toBeCloseTo(0.7)
    expect(fract(2.0)).toBeCloseTo(0)
    expect(fract(0.3)).toBeCloseTo(0.3)
  })

  it('always returns a value in [0, 1)', () => {
    for (const v of [0, 0.5, 1, 1.999, -0.1, -1.5, 100.7]) {
      const r = fract(v)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(1)
    }
  })

  it('for negative inputs, result is the complement to the next integer above', () => {
    // fract(-0.3) = -0.3 - floor(-0.3) = -0.3 - (-1) = 0.7
    expect(fract(-0.3)).toBeCloseTo(0.7)
  })
})

describe('clamp01', () => {
  it('passes through values already in [0, 1]', () => {
    expect(clamp01(0)).toBe(0)
    expect(clamp01(0.5)).toBe(0.5)
    expect(clamp01(1)).toBe(1)
  })

  it('clamps negative values to 0', () => {
    expect(clamp01(-0.001)).toBe(0)
    expect(clamp01(-100)).toBe(0)
  })

  it('clamps values above 1 to 1', () => {
    expect(clamp01(1.001)).toBe(1)
    expect(clamp01(100)).toBe(1)
  })
})

describe('hash3', () => {
  it('returns a value in [0, 1) for any integer inputs', () => {
    for (const [x, y, z] of [[0, 0, 0], [1, 2, 3], [100, 64, -50], [-10, 0, 200]] as const) {
      const h = hash3(x, y, z)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(1)
    }
  })

  it('is deterministic — same inputs always produce the same value', () => {
    expect(hash3(10, 64, 20)).toBe(hash3(10, 64, 20))
    expect(hash3(-5, 1, 7)).toBe(hash3(-5, 1, 7))
  })

  it('produces different values for different inputs', () => {
    const a = hash3(0, 0, 0)
    const b = hash3(1, 0, 0)
    const c = hash3(0, 1, 0)
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
  })
})

describe('computeRuggedness', () => {
  it('returns values in [0, 1]', () => {
    for (const [e, j] of [[-1, 0], [0, 0], [1, 0], [0, -1], [0, 1], [0.5, 0.3]] as const) {
      const r = computeRuggedness(e, j)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(1)
    }
  })

  it('high erosion and low jaggedness → low ruggedness', () => {
    // normalizedErosion≈1 → (1-1)*0.6=0, abs(0)*0.4=0 → ruggedness≈0
    expect(computeRuggedness(1, 0)).toBeCloseTo(0)
  })

  it('low erosion and high jaggedness → higher ruggedness', () => {
    // normalizedErosion≈0 → (1-0)*0.6=0.6, abs(1)*0.4=0.4 → ruggedness≈1
    expect(computeRuggedness(-1, 1)).toBeCloseTo(1)
  })
})
