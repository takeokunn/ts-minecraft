import { describe, it, expect } from 'vitest'
import { mulberry32, normalizeNoise, toPV, computeOctaveNoise } from './noise-primitives'

describe('normalizeNoise', () => {
  it('maps -1 to 0', () => {
    expect(normalizeNoise(-1)).toBe(0)
  })
  it('maps 0 to 0.5', () => {
    expect(normalizeNoise(0)).toBe(0.5)
  })
  it('maps 1 to 1', () => {
    expect(normalizeNoise(1)).toBe(1)
  })
  it('is linear: (value + 1) / 2', () => {
    for (const v of [-0.5, 0.25, 0.75]) {
      expect(normalizeNoise(v)).toBeCloseTo((v + 1) / 2)
    }
  })
})

describe('toPV (peaks and valleys)', () => {
  it('toPV(2/3) = 1 (peak: |3 * |2/3| - 2| = 0)', () => {
    expect(toPV(2 / 3)).toBeCloseTo(1)
  })
  it('toPV(0) = -1 (valley: |3*0 - 2| = 2, 1 - 2 = -1)', () => {
    expect(toPV(0)).toBeCloseTo(-1)
  })
  it('toPV(-2/3) = 1 (symmetric around 0)', () => {
    expect(toPV(-2 / 3)).toBeCloseTo(toPV(2 / 3))
  })
  it('is symmetric: toPV(w) == toPV(-w)', () => {
    for (const w of [0.1, 0.3, 0.5, 0.7]) {
      expect(toPV(w)).toBeCloseTo(toPV(-w))
    }
  })
})

describe('mulberry32', () => {
  it('produces values in [0, 1)', () => {
    const rng = mulberry32(42)
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is deterministic: same seed produces same sequence', () => {
    const rng1 = mulberry32(1234)
    const rng2 = mulberry32(1234)
    for (let i = 0; i < 10; i++) {
      expect(rng1()).toBe(rng2())
    }
  })

  it('different seeds produce different sequences', () => {
    const rng1 = mulberry32(1)
    const rng2 = mulberry32(2)
    const seq1 = Array.from({ length: 5 }, () => rng1())
    const seq2 = Array.from({ length: 5 }, () => rng2())
    expect(seq1).not.toEqual(seq2)
  })

  it('successive calls advance the internal state', () => {
    const rng = mulberry32(999)
    const v1 = rng()
    const v2 = rng()
    expect(v1).not.toBe(v2)
  })
})

describe('computeOctaveNoise', () => {
  const constantNoise = (_x: number, _z: number): number => 0
  const identityNoise = (x: number, z: number): number => (x + z) / 100

  it('returns 0 when octaves < 1', () => {
    expect(computeOctaveNoise(constantNoise, 0, 0, 0, 0.5, 2)).toBe(0)
  })

  it('with 1 octave and constant noise returns normalizeNoise(0) = 0.5', () => {
    expect(computeOctaveNoise(constantNoise, 10, 10, 1, 0.5, 2)).toBeCloseTo(0.5)
  })

  it('output is always in [0, 1] range for bounded input noise [-1,1]', () => {
    const boundedNoise = (_x: number, _z: number): number => Math.sin(_x) * Math.cos(_z)
    for (let x = 0; x < 10; x++) {
      for (let z = 0; z < 10; z++) {
        const v = computeOctaveNoise(boundedNoise, x * 10, z * 10, 4, 0.5, 2)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })

  it('more octaves produce different results than fewer octaves', () => {
    const v1 = computeOctaveNoise(identityNoise, 5, 5, 1, 0.5, 2)
    const v4 = computeOctaveNoise(identityNoise, 5, 5, 4, 0.5, 2)
    expect(v1).not.toBeCloseTo(v4)
  })
})
