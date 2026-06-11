import { describe, it, expect } from 'vitest'
import { createPerlinNoise2D, createPerlinNoise3D } from './perlin'

const seededRng = (seed: number) => {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

describe('createPerlinNoise2D', () => {
  it('is deterministic: same PRNG seed produces same values', () => {
    const n1 = createPerlinNoise2D(seededRng(42))
    const n2 = createPerlinNoise2D(seededRng(42))
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        expect(n1(x * 0.1, y * 0.1)).toBe(n2(x * 0.1, y * 0.1))
      }
    }
  })

  it('different seeds produce different permutations', () => {
    const n1 = createPerlinNoise2D(seededRng(1))
    const n2 = createPerlinNoise2D(seededRng(2))
    let allSame = true
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        if (n1(x * 0.1, y * 0.1) !== n2(x * 0.1, y * 0.1)) {
          allSame = false
          break
        }
      }
    }
    expect(allSame).toBe(false)
  })

  it('output is in a reasonable range around [-1.5, 1.5]', () => {
    const noise = createPerlinNoise2D(seededRng(99))
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        const val = noise(x * 0.3, y * 0.3)
        expect(val).toBeGreaterThan(-2)
        expect(val).toBeLessThan(2)
      }
    }
  })

  it('is smooth: nearby inputs produce similar outputs', () => {
    const noise = createPerlinNoise2D(seededRng(7))
    const base = noise(1.0, 1.0)
    const near = noise(1.001, 1.001)
    expect(Math.abs(base - near)).toBeLessThan(0.1)
  })

  it('produces non-constant output across a grid', () => {
    const noise = createPerlinNoise2D(seededRng(123))
    const values = new Set<string>()
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        values.add(noise(x * 0.5, y * 0.5).toFixed(6))
      }
    }
    expect(values.size).toBeGreaterThan(10)
  })

  it('works without a custom PRNG (uses Math.random internally)', () => {
    const noise = createPerlinNoise2D()
    const val = noise(0.5, 0.5)
    expect(typeof val).toBe('number')
    expect(Number.isFinite(val)).toBe(true)
  })
})

describe('createPerlinNoise3D', () => {
  it('is deterministic: same PRNG seed produces same values', () => {
    const n1 = createPerlinNoise3D(seededRng(42))
    const n2 = createPerlinNoise3D(seededRng(42))
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          expect(n1(x * 0.2, y * 0.2, z * 0.2)).toBe(n2(x * 0.2, y * 0.2, z * 0.2))
        }
      }
    }
  })

  it('output is in a reasonable range', () => {
    const noise = createPerlinNoise3D(seededRng(55))
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        for (let z = 0; z < 4; z++) {
          const val = noise(x * 0.4, y * 0.4, z * 0.4)
          expect(val).toBeGreaterThan(-3)
          expect(val).toBeLessThan(3)
        }
      }
    }
  })

  it('is smooth in 3D: nearby inputs produce similar outputs', () => {
    const noise = createPerlinNoise3D(seededRng(7))
    const base = noise(1.0, 1.0, 1.0)
    const near = noise(1.001, 1.001, 1.001)
    expect(Math.abs(base - near)).toBeLessThan(0.1)
  })

  it('works without a custom PRNG', () => {
    const noise = createPerlinNoise3D()
    const val = noise(0.3, 0.5, 0.7)
    expect(typeof val).toBe('number')
    expect(Number.isFinite(val)).toBe(true)
  })

  it('produces non-constant output across a 3D grid', () => {
    const noise = createPerlinNoise3D(seededRng(321))
    const values = new Set<string>()
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        for (let z = 0; z < 4; z++) {
          values.add(noise(x * 0.5, y * 0.5, z * 0.5).toFixed(6))
        }
      }
    }
    expect(values.size).toBeGreaterThan(10)
  })
})
