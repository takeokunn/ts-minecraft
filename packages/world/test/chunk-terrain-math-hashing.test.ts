import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, HashSet } from 'effect'
import { CHUNK_SIZE } from '@ts-minecraft/core'
import {
  hash3,
  fract,
  clamp01,
  computeRuggedness,
  worldToBlockIndex,
} from '@ts-minecraft/world'

describe('hash3', () => {
  it('is deterministic — same inputs always produce the same value', () => {
    const v1 = hash3(5, 3, 7)
    const v2 = hash3(5, 3, 7)
    expect(v1).toBe(v2)
  })

  it('returns a value in [0, 1)', () => {
    const cases: Array<[number, number, number]> = [
      [0, 0, 0],
      [1, 2, 3],
      [100, 64, -50],
      [-10, 0, 10],
      [999, 1, -999],
    ]
    Arr.forEach(cases, ([wx, y, wz]) => {
      const v = hash3(wx, y, wz)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    })
  })

  it('different inputs produce different values', () => {
    const v1 = hash3(0, 0, 0)
    const v2 = hash3(1, 0, 0)
    const v3 = hash3(0, 1, 0)
    const v4 = hash3(0, 0, 1)
    expect(v1).not.toBeCloseTo(v2, 6)
    expect(v1).not.toBeCloseTo(v3, 6)
    expect(v1).not.toBeCloseTo(v4, 6)
  })

  it('y coordinate affects the hash (bedrock probability depends on altitude)', () => {
    const results = Arr.map([0, 1, 2, 3, 4] as const, (y) => hash3(0, y, 0))
    const unique = HashSet.fromIterable(Arr.map(results, (v) => v.toFixed(10)))
    expect(HashSet.size(unique)).toBe(5)
  })
})

describe('fract', () => {
  it('returns 0 for integers', () => {
    expect(fract(0)).toBeCloseTo(0)
    expect(fract(1)).toBeCloseTo(0)
    expect(fract(-3)).toBeCloseTo(0)
    expect(fract(100)).toBeCloseTo(0)
  })

  it('returns the fractional part for positive non-integers', () => {
    expect(fract(1.5)).toBeCloseTo(0.5)
    expect(fract(2.75)).toBeCloseTo(0.75)
    expect(fract(3.999)).toBeCloseTo(0.999)
  })

  it('returns the fractional part for negative non-integers', () => {
    // fract(-1.5) = -1.5 - floor(-1.5) = -1.5 - (-2) = 0.5
    expect(fract(-1.5)).toBeCloseTo(0.5)
    // fract(-2.25) = -2.25 - (-3) = 0.75
    expect(fract(-2.25)).toBeCloseTo(0.75)
  })

  it('result is always in [0, 1)', () => {
    const values = [-10.3, -1, -0.001, 0, 0.001, 0.999, 1, 5.7, 100.123]
    Arr.forEach(values, v => {
      const result = fract(v)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThan(1)
    })
  })
})

describe('clamp01', () => {
  it('returns exactly 0 for values at or below 0', () => {
    expect(clamp01(0)).toBe(0)
    expect(clamp01(-0.001)).toBe(0)
    expect(clamp01(-100)).toBe(0)
  })

  it('returns exactly 1 for values at or above 1', () => {
    expect(clamp01(1)).toBe(1)
    expect(clamp01(1.001)).toBe(1)
    expect(clamp01(100)).toBe(1)
  })

  it('passes through values strictly between 0 and 1 unchanged', () => {
    Arr.forEach([0.0001, 0.25, 0.5, 0.75, 0.9999] as const, v => {
      expect(clamp01(v)).toBe(v)
    })
  })

  it('output is always in [0, 1]', () => {
    Arr.forEach([-Infinity, -1, 0, 0.5, 1, 2, Infinity] as const, v => {
      const result = clamp01(v)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThanOrEqual(1)
    })
  })
})

describe('computeRuggedness', () => {
  it('output is always in [0, 1] for arbitrary inputs', () => {
    const erosionVals = [-1, -0.5, 0, 0.5, 1]
    const jaggednessVals = [-1, -0.5, 0, 0.5, 1]
    Arr.forEach(erosionVals, e => {
      Arr.forEach(jaggednessVals, j => {
        const result = computeRuggedness(e, j)
        expect(result).toBeGreaterThanOrEqual(0)
        expect(result).toBeLessThanOrEqual(1)
      })
    })
  })

  it('returns 0 when erosion=1 (max erosion) and jaggedness=0', () => {
    expect(computeRuggedness(1, 0)).toBeCloseTo(0, 10)
  })

  it('returns 0.6 when erosion=-1 (no erosion) and jaggedness=0', () => {
    expect(computeRuggedness(-1, 0)).toBeCloseTo(0.6, 10)
  })

  it('returns 1 when erosion=-1 and |jaggedness|=1', () => {
    expect(computeRuggedness(-1, 1)).toBeCloseTo(1, 10)
    expect(computeRuggedness(-1, -1)).toBeCloseTo(1, 10)
  })

  it('is symmetric with respect to the sign of jaggedness (uses |jaggedness|)', () => {
    Arr.forEach([-1, 0, 0.5] as const, e => {
      expect(computeRuggedness(e, 0.7)).toBeCloseTo(computeRuggedness(e, -0.7), 10)
    })
  })

  it('higher absolute jaggedness produces more or equal ruggedness', () => {
    const e = 0
    const r1 = computeRuggedness(e, 0.2)
    const r2 = computeRuggedness(e, 0.8)
    expect(r2).toBeGreaterThanOrEqual(r1)
  })
})

describe('worldToBlockIndex', () => {
  it('origin maps to chunk (0,0) with local coords (0,0,0)', () => {
    const result = worldToBlockIndex({ x: 0, y: 0, z: 0 })
    expect(result.chunkCoord).toEqual({ x: 0, z: 0 })
    expect(result.lx).toBe(0)
    expect(result.ly).toBe(0)
    expect(result.lz).toBe(0)
    expect(result.coordKey).toBe('0,0')
  })

  it('y coordinate is floored into ly', () => {
    const result = worldToBlockIndex({ x: 0, y: 64.9, z: 0 })
    expect(result.ly).toBe(64)
  })

  it('position within first chunk computes correct local offsets', () => {
    const result = worldToBlockIndex({ x: 5, y: 32, z: 11 })
    expect(result.chunkCoord).toEqual({ x: 0, z: 0 })
    expect(result.lx).toBe(5)
    expect(result.ly).toBe(32)
    expect(result.lz).toBe(11)
    expect(result.coordKey).toBe('0,0')
  })

  it('position at exactly CHUNK_SIZE starts the next chunk', () => {
    const result = worldToBlockIndex({ x: CHUNK_SIZE, y: 0, z: CHUNK_SIZE })
    expect(result.chunkCoord).toEqual({ x: 1, z: 1 })
    expect(result.lx).toBe(0)
    expect(result.lz).toBe(0)
    expect(result.coordKey).toBe('1,1')
  })

  it('negative world coords resolve via double-modulo to positive local coords', () => {
    // x=-1 → bx=-1, cx=floor(-1/16)=-1, lx=(((-1%16)+16)%16)=15
    const result = worldToBlockIndex({ x: -1, y: 0, z: -1 })
    expect(result.chunkCoord).toEqual({ x: -1, z: -1 })
    expect(result.lx).toBe(15)
    expect(result.lz).toBe(15)
    expect(result.coordKey).toBe('-1,-1')
  })

  it('negative x exactly at -CHUNK_SIZE starts chunk (-1, 0)', () => {
    const result = worldToBlockIndex({ x: -CHUNK_SIZE, y: 0, z: 0 })
    expect(result.chunkCoord).toEqual({ x: -1, z: 0 })
    expect(result.lx).toBe(0)
  })

  it('coordKey matches chunkCoord serialization', () => {
    Arr.forEach([
      { x: 0, y: 0, z: 0 },
      { x: CHUNK_SIZE + 3, y: 10, z: -CHUNK_SIZE - 5 },
      { x: -1, y: 64, z: 100 },
    ], pos => {
      const result = worldToBlockIndex(pos)
      expect(result.coordKey).toBe(`${result.chunkCoord.x},${result.chunkCoord.z}`)
    })
  })

  it('flatIdx is non-negative for valid in-bounds positions', () => {
    Arr.forEach([
      { x: 0, y: 0, z: 0 },
      { x: 7, y: 64, z: 3 },
      { x: -5, y: 100, z: 20 },
    ], pos => {
      const result = worldToBlockIndex(pos)
      expect(result.flatIdx).toBeGreaterThanOrEqual(0)
    })
  })
})
