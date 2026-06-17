import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import {
  createNoisePrimitives,
  noise2DBatch,
  octaveNoise2DBatch,
  noise2DBatchXY,
  noise3DBatchXYZ,
  octaveNoise2DBatchXY,
} from '../infrastructure/primitives'

const readNumber = (values: ReadonlyArray<number>, index: number): number => values[index] ?? Number.NaN

describe('noise2DBatch', () => {
  it('returns one value per input point', () => {
    const prims = createNoisePrimitives(42)
    const points = [[0, 0], [10, 5], [100, 200]] as ReadonlyArray<readonly [number, number]>
    const results = noise2DBatch(prims, points)
    expect(results).toHaveLength(3)
  })

  it('matches scalar noise2D for the same coordinates', () => {
    const prims = createNoisePrimitives(7)
    const points: ReadonlyArray<readonly [number, number]> = [[3, 4], [10, 20], [0, 0]]
    const batch = noise2DBatch(prims, points)
    points.forEach(([x, z], i) => {
      expect(batch[i]).toBeCloseTo(prims.noise2D(x, z), 10)
    })
  })

  it('returns empty array for empty input', () => {
    const prims = createNoisePrimitives(1)
    expect(noise2DBatch(prims, [])).toEqual([])
  })
})

describe('octaveNoise2DBatch', () => {
  it('returns one value per input point', () => {
    const prims = createNoisePrimitives(42)
    const points = [[0, 0], [10, 5], [100, 200]] as ReadonlyArray<readonly [number, number]>
    const results = octaveNoise2DBatch(prims, points, 4, 0.5, 2.0)
    expect(results).toHaveLength(3)
  })

  it('matches scalar octaveNoise2D for the same coordinates', () => {
    const prims = createNoisePrimitives(7)
    const points: ReadonlyArray<readonly [number, number]> = [[3, 4], [10, 20], [0, 0]]
    const batch = octaveNoise2DBatch(prims, points, 4, 0.5, 2.0)
    points.forEach(([x, z], i) => {
      expect(batch[i]).toBeCloseTo(prims.octaveNoise2D(x, z, 4, 0.5, 2.0), 10)
    })
  })

  it('returns empty array for empty input', () => {
    const prims = createNoisePrimitives(1)
    expect(octaveNoise2DBatch(prims, [], 4, 0.5, 2.0)).toEqual([])
  })
})

describe('noise2DBatchXY', () => {
  it('returns one value per input point', () => {
    const prims = createNoisePrimitives(42)
    const xs = [0, 10, 100]
    const zs = [0, 5, 200]
    const results = noise2DBatchXY(prims, xs, zs)
    expect(results).toHaveLength(3)
  })

  it('matches scalar noise2D for the same coordinates', () => {
    const prims = createNoisePrimitives(7)
    const xs = [3, 10, 0]
    const zs = [4, 20, 0]
    const batch = noise2DBatchXY(prims, xs, zs)
    xs.forEach((x, i) => {
      expect(batch[i]).toBeCloseTo(prims.noise2D(x, readNumber(zs, i)), 10)
    })
  })

  it('returns length-1 result for length-1 input', () => {
    const prims = createNoisePrimitives(1)
    const result = noise2DBatchXY(prims, [0], [0])
    expect(result).toHaveLength(1)
  })
})

describe('noise3DBatchXYZ', () => {
  it('returns one value per input point', () => {
    const prims = createNoisePrimitives(42)
    const xs = [0, 10, 100]
    const ys = [0, 5, 50]
    const zs = [0, 15, 200]
    const results = noise3DBatchXYZ(prims, xs, ys, zs)
    expect(results).toHaveLength(3)
  })

  it('matches scalar noise3D for the same coordinates', () => {
    const prims = createNoisePrimitives(7)
    const xs = [3, 10, 0]
    const ys = [1, 20, 5]
    const zs = [4, 30, 0]
    const batch = noise3DBatchXYZ(prims, xs, ys, zs)
    xs.forEach((x, i) => {
      expect(batch[i]).toBeCloseTo(prims.noise3D(x, readNumber(ys, i), readNumber(zs, i)), 10)
    })
  })

  it('returns length-1 result for length-1 input', () => {
    const prims = createNoisePrimitives(1)
    const result = noise3DBatchXYZ(prims, [0], [0], [0])
    expect(result).toHaveLength(1)
  })
})

describe('octaveNoise2DBatchXY', () => {
  it('returns one value per input point', () => {
    const prims = createNoisePrimitives(42)
    const xs = [0, 10, 100]
    const zs = [0, 5, 200]
    const results = octaveNoise2DBatchXY(prims, xs, zs, 4, 0.5, 2.0)
    expect(results).toHaveLength(3)
  })

  it('matches scalar octaveNoise2D for the same coordinates', () => {
    const prims = createNoisePrimitives(7)
    const xs = [3, 10, 0]
    const zs = [4, 20, 0]
    const batch = octaveNoise2DBatchXY(prims, xs, zs, 4, 0.5, 2.0)
    xs.forEach((x, i) => {
      expect(batch[i]).toBeCloseTo(prims.octaveNoise2D(x, readNumber(zs, i), 4, 0.5, 2.0), 10)
    })
  })

  it('returns length-1 result for length-1 input', () => {
    const prims = createNoisePrimitives(1)
    const result = octaveNoise2DBatchXY(prims, [0], [0], 4, 0.5, 2.0)
    expect(result).toHaveLength(1)
  })
})
