import { describe, it } from 'vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import {
  mulberry32,
  normalizeNoise,
  toPV,
  computeOctaveNoise,
  WEYL_C, WEYL_E, WEYL_W, WEYL_J, WEYL_3D,
  SCALE_C, SCALE_E, SCALE_W, SCALE_J,
  createNoisePrimitives,
  noise2DBatch,
  octaveNoise2DBatch,
  noise2DBatchXY,
  noise3DBatchXYZ,
  octaveNoise2DBatchXY,
} from '../infrastructure/primitives'

describe('mulberry32', () => {
  it('produces values in [0, 1)', () => {
    const rand = mulberry32(42)
    Arr.forEach(Arr.makeBy(100, (i) => i), () => {
      const v = rand()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    })
  })

  it('is deterministic for the same seed', () => {
    const r1 = mulberry32(12345)
    const r2 = mulberry32(12345)
    expect(r1()).toBe(r2())
    expect(r1()).toBe(r2())
  })

  it('produces different sequences for different seeds', () => {
    const r1 = mulberry32(1)
    const r2 = mulberry32(2)
    expect(r1()).not.toBe(r2())
  })

  it('seed 0 produces valid output', () => {
    const rand = mulberry32(0)
    const v = rand()
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThan(1)
  })
})

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

  it('maps 0.5 to 0.75', () => {
    expect(normalizeNoise(0.5)).toBeCloseTo(0.75)
  })
})

describe('toPV (peaks-and-valleys transform)', () => {
  it('toPV(0) = 1 - |3*0 - 2| = 1 - 2 = -1', () => {
    expect(toPV(0)).toBeCloseTo(-1)
  })

  it('toPV(2/3) ≈ 1 (valley of the transform)', () => {
    expect(toPV(2 / 3)).toBeCloseTo(1, 5)
  })

  it('toPV(-0.5) equals toPV(0.5) (symmetric around 0)', () => {
    expect(toPV(-0.5)).toBeCloseTo(toPV(0.5))
  })

  it('output range: [-1, 1] for typical weirdness inputs [-1, 1]', () => {
    for (let w = -1; w <= 1; w += 0.1) {
      const pv = toPV(w)
      expect(pv).toBeGreaterThanOrEqual(-1.01)
      expect(pv).toBeLessThanOrEqual(1.01)
    }
  })
})

describe('WEYL constants', () => {
  it('WEYL_C is 0x9e3779b1', () => {
    expect(WEYL_C).toBe(0x9e3779b1)
  })

  it('WEYL_E is 0xbb67ae85', () => {
    expect(WEYL_E).toBe(0xbb67ae85)
  })

  it('WEYL_W is 0x3c6ef372', () => {
    expect(WEYL_W).toBe(0x3c6ef372)
  })

  it('WEYL_J is 0xa54ff53a', () => {
    expect(WEYL_J).toBe(0xa54ff53a)
  })

  it('WEYL_3D is 0x9e3779b9', () => {
    expect(WEYL_3D).toBe(0x9e3779b9)
  })
})

describe('SCALE constants', () => {
  it('SCALE_C is 0.0005', () => {
    expect(SCALE_C).toBe(0.0005)
  })

  it('SCALE_E is 0.001', () => {
    expect(SCALE_E).toBe(0.001)
  })

  it('SCALE_W is 0.002', () => {
    expect(SCALE_W).toBe(0.002)
  })

  it('SCALE_J is 0.02', () => {
    expect(SCALE_J).toBe(0.02)
  })
})

describe('computeOctaveNoise', () => {
  it('returns 0 immediately when octaves < 1', () => {
    const prims = createNoisePrimitives(42)
    expect(computeOctaveNoise(prims.raw2D, 5, 7, 0, 0.5, 2.0)).toBe(0)
  })

  it('with 1 octave matches the base noise function at the same coords', () => {
    const prims = createNoisePrimitives(42)
    // computeOctaveNoise(noiseFn, x, z, 1, ...) = normalizeNoise(noiseFn(x,z))
    // Pass raw2D so that result equals normalizeNoise(raw2D(x,z)) = noise2D(x,z)
    const baseVal = prims.noise2D(5, 7)
    const octaveVal = computeOctaveNoise(prims.raw2D, 5, 7, 1, 0.5, 2.0)
    expect(octaveVal).toBeCloseTo(baseVal, 5)
  })

  it('produces value in [0, 1] for typical terrain parameters', () => {
    const prims = createNoisePrimitives(99)
    const val = computeOctaveNoise(prims.raw2D, 10, 20, 4, 0.5, 2.0)
    expect(val).toBeGreaterThanOrEqual(0)
    expect(val).toBeLessThanOrEqual(1)
  })

  it('is deterministic: same inputs produce the same output', () => {
    const prims = createNoisePrimitives(7)
    const v1 = computeOctaveNoise(prims.raw2D, 3, 9, 3, 0.5, 2.0)
    const v2 = computeOctaveNoise(prims.raw2D, 3, 9, 3, 0.5, 2.0)
    expect(v1).toBe(v2)
  })
})

describe('createNoisePrimitives — sampleTerrainChannels', () => {
  it('sampleTerrainChannels returns four Float64Array each of length 256', () => {
    const prims = createNoisePrimitives(42)
    const channels = prims.sampleTerrainChannels(0, 0)
    expect(channels.continentalness).toBeInstanceOf(Float64Array)
    expect(channels.erosion).toBeInstanceOf(Float64Array)
    expect(channels.pv).toBeInstanceOf(Float64Array)
    expect(channels.jaggedness).toBeInstanceOf(Float64Array)
    expect(channels.continentalness.length).toBe(256)
    expect(channels.erosion.length).toBe(256)
    expect(channels.pv.length).toBe(256)
    expect(channels.jaggedness.length).toBe(256)
  })

  it('sampleTerrainChannels is deterministic for the same seed and origin', () => {
    const p1 = createNoisePrimitives(7)
    const p2 = createNoisePrimitives(7)
    const c1 = p1.sampleTerrainChannels(16, 32)
    const c2 = p2.sampleTerrainChannels(16, 32)
    expect(Array.from(c1.continentalness)).toEqual(Array.from(c2.continentalness))
    expect(Array.from(c1.erosion)).toEqual(Array.from(c2.erosion))
    expect(Array.from(c1.pv)).toEqual(Array.from(c2.pv))
    expect(Array.from(c1.jaggedness)).toEqual(Array.from(c2.jaggedness))
  })

  it('sampleTerrainChannels produces different output for different origins', () => {
    const prims = createNoisePrimitives(99)
    const c1 = prims.sampleTerrainChannels(0, 0)
    const c2 = prims.sampleTerrainChannels(1000, 2000)
    // At least one channel value should differ between distant chunks
    const anyDiff = Array.from(c1.continentalness).some((v, i) => v !== c2.continentalness[i])
    expect(anyDiff).toBe(true)
  })
})

describe('createNoisePrimitives', () => {
  it('noise2D returns value in [0, 1]', () => {
    const prims = createNoisePrimitives(1)
    const v = prims.noise2D(5, 10)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(1.01)
  })

  it('is deterministic for the same seed', () => {
    const p1 = createNoisePrimitives(42)
    const p2 = createNoisePrimitives(42)
    expect(p1.noise2D(3, 7)).toBe(p2.noise2D(3, 7))
  })

  it('produces different values for different seeds', () => {
    const p1 = createNoisePrimitives(1)
    const p2 = createNoisePrimitives(2)
    expect(p1.noise2D(5, 5)).not.toBe(p2.noise2D(5, 5))
  })

  it('continentalness returns value in [-1, 1]', () => {
    const prims = createNoisePrimitives(10)
    const v = prims.continentalnessAt(100, 200)
    expect(v).toBeGreaterThanOrEqual(-1.01)
    expect(v).toBeLessThanOrEqual(1.01)
  })

  it('erosionAt returns value in [-1, 1]', () => {
    const prims = createNoisePrimitives(10)
    const v = prims.erosionAt(100, 200)
    expect(v).toBeGreaterThanOrEqual(-1.01)
    expect(v).toBeLessThanOrEqual(1.01)
  })

  it('weirdnessAt returns value in [-1, 1]', () => {
    const prims = createNoisePrimitives(10)
    const v = prims.weirdnessAt(100, 200)
    expect(v).toBeGreaterThanOrEqual(-1.01)
    expect(v).toBeLessThanOrEqual(1.01)
  })

  it('jaggednessAt returns value in [-1, 1]', () => {
    const prims = createNoisePrimitives(10)
    const v = prims.jaggednessAt(100, 200)
    expect(v).toBeGreaterThanOrEqual(-1.01)
    expect(v).toBeLessThanOrEqual(1.01)
  })

  it('noise3D returns a numeric value', () => {
    const prims = createNoisePrimitives(42)
    const v = prims.noise3D(1, 2, 3)
    expect(typeof v).toBe('number')
    expect(isNaN(v)).toBe(false)
  })
})
