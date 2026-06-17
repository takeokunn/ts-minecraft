import { describe, it, expect } from 'vitest'
import { CHUNK_SIZE } from '@ts-minecraft/core'
import {
  CHUNK_COLUMN_SAMPLE_COUNT,
  computeTerrainChannels,
  createNoisePrimitives,
  noise2DBatchXY,
  noise3DBatchXYZ,
  octaveNoise2DBatchXY,
  noise2DBatch,
  octaveNoise2DBatch,
  toPV,
  SCALE_C,
  type NoiseFn2D,
} from '../domain/noise-primitives'

const constant = (k: number): NoiseFn2D => () => k
// Returns its first (world-x) argument — affine, so bilinear interpolation is exact.
const firstArg: NoiseFn2D = (x) => x
const readNumber = (values: ReadonlyArray<number>, index: number): number => values[index] ?? Number.NaN
const denseIdx = (z: number, x: number): number => z * CHUNK_SIZE + x

describe('computeTerrainChannels', () => {
  it('produces four chunk-column channel arrays', () => {
    const ch = computeTerrainChannels(constant(0), constant(0), constant(0), constant(0), 0, 0)
    for (const arr of [ch.continentalness, ch.erosion, ch.pv, ch.jaggedness]) {
      expect(arr.length).toBe(CHUNK_COLUMN_SAMPLE_COUNT)
    }
  })

  it('fills each channel with its constant when the noise functions are constant', () => {
    const ch = computeTerrainChannels(constant(0.1), constant(0.2), constant(0.3), constant(0.4), 0, 0)
    // every output cell equals the (interpolated) constant — weights sum to 1
    expect([...ch.continentalness].every((v) => Math.abs(v - 0.1) < 1e-12)).toBe(true)
    expect([...ch.erosion].every((v) => Math.abs(v - 0.2) < 1e-12)).toBe(true)
    expect([...ch.jaggedness].every((v) => Math.abs(v - 0.4) < 1e-12)).toBe(true)
  })

  it('applies toPV to the weirdness channel to derive pv', () => {
    const weird = 0.3
    const ch = computeTerrainChannels(constant(0), constant(0), constant(weird), constant(0), 0, 0)
    expect([...ch.pv].every((v) => Math.abs(v - toPV(weird)) < 1e-12)).toBe(true)
  })

  it('reproduces an affine field exactly at every cell (bilinear interpolation is exact)', () => {
    // continentalness fn returns world-x (scaled), so cell (x,z) must equal (xStart + x) * SCALE_C
    const ch = computeTerrainChannels(firstArg, constant(0), constant(0), constant(0), 0, 0)
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const expected = (0 + x) * SCALE_C
        expect(ch.continentalness[denseIdx(z, x)]).toBeCloseTo(expected, 12)
      }
    }
  })

  it('honours the world-space origin offset', () => {
    const ch = computeTerrainChannels(firstArg, constant(0), constant(0), constant(0), 32, 0)
    // cell (0,0) samples world-x = xStart = 32
    expect(ch.continentalness[0]).toBeCloseTo(32 * SCALE_C, 12)
  })
})

describe('createNoisePrimitives', () => {
  it('is deterministic: the same seed yields identical samples', () => {
    const a = createNoisePrimitives(1234)
    const b = createNoisePrimitives(1234)
    expect(a.noise2D(3.5, 7.25)).toBe(b.noise2D(3.5, 7.25))
    expect(a.noise3D(1, 2, 3)).toBe(b.noise3D(1, 2, 3))
    expect(a.continentalnessAt(10, 20)).toBe(b.continentalnessAt(10, 20))
  })

  it('decorrelates channels: different seeds give different continentalness', () => {
    const a = createNoisePrimitives(1)
    const b = createNoisePrimitives(2)
    expect(a.continentalnessAt(5, 5)).not.toBe(b.continentalnessAt(5, 5))
  })

  it('normalizes noise2D into [0, 1]', () => {
    const p = createNoisePrimitives(7)
    for (let i = 0; i < 50; i++) {
      const v = p.noise2D(i * 1.3, i * 0.7)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('sampleTerrainChannels matches a direct computeTerrainChannels call', () => {
    const p = createNoisePrimitives(99)
    const viaPrimitive = p.sampleTerrainChannels(0, 0)
    expect(viaPrimitive.continentalness.length).toBe(CHUNK_COLUMN_SAMPLE_COUNT)
    // pv is bounded by toPV's range [-1, 1]
    expect([...viaPrimitive.pv].every((v) => v >= -1 - 1e-9 && v <= 1 + 1e-9)).toBe(true)
  })
})

describe('batch helpers', () => {
  const p = createNoisePrimitives(2024)

  it('noise2DBatchXY maps parallel coordinate arrays element-wise', () => {
    const xs = [1, 2, 3]
    const zs = [4, 5, 6]
    const out = noise2DBatchXY(p, xs, zs)
    expect(out).toEqual(xs.map((x, i) => p.noise2D(x, readNumber(zs, i))))
  })

  it('noise3DBatchXYZ maps three parallel arrays element-wise', () => {
    const xs = [0, 1]
    const ys = [10, 11]
    const zs = [20, 21]
    const out = noise3DBatchXYZ(p, xs, ys, zs)
    expect(out).toEqual(xs.map((x, i) => p.noise3D(x, readNumber(ys, i), readNumber(zs, i))))
  })

  it('octaveNoise2DBatchXY threads octave params to every point', () => {
    const xs = [1, 2]
    const zs = [3, 4]
    const out = octaveNoise2DBatchXY(p, xs, zs, 4, 0.5, 2)
    expect(out).toEqual(xs.map((x, i) => p.octaveNoise2D(x, readNumber(zs, i), 4, 0.5, 2)))
  })

  it('noise2DBatch consumes [x, z] tuples', () => {
    const points: ReadonlyArray<readonly [number, number]> = [[1, 2], [3, 4]]
    expect(noise2DBatch(p, points)).toEqual(points.map(([x, z]) => p.noise2D(x, z)))
  })

  it('octaveNoise2DBatch consumes [x, z] tuples with octave params', () => {
    const points: ReadonlyArray<readonly [number, number]> = [[5, 6]]
    expect(octaveNoise2DBatch(p, points, 3, 0.6, 2)).toEqual(
      points.map(([x, z]) => p.octaveNoise2D(x, z, 3, 0.6, 2)),
    )
  })

  it('returns an array matching the input length', () => {
    expect(noise2DBatchXY(p, [1, 2, 3, 4], [1, 2, 3, 4])).toHaveLength(4)
    expect(noise2DBatch(p, [])).toHaveLength(0)
  })
})
