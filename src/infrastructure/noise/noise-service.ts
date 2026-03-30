import { Effect } from 'effect'
import { createPerlinNoise2D, type NoiseFn2D, type RandFn } from './perlin'

const mulberry32 = (seed: number): RandFn => {
  let s = seed >>> 0
  return () => {
    let t = (s += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const normalizeNoise = (value: number): number => (value + 1) / 2

export class NoiseService extends Effect.Service<NoiseService>()(
  '@minecraft/infrastructure/noise/NoiseService',
  {
    effect: Effect.sync(() => {
      let noiseFn: NoiseFn2D = createPerlinNoise2D()

      const computeOctaveNoise = (
        x: number,
        z: number,
        octaves: number,
        persistence: number,
        lacunarity: number,
      ): number => {
        let total = 0
        let frequency = 1
        let amplitude = 1
        let maxValue = 0

        for (let i = 0; i < octaves; i++) {
          total += noiseFn(x * frequency, z * frequency) * amplitude
          maxValue += amplitude
          amplitude *= persistence
          frequency *= lacunarity
        }

        return normalizeNoise(total / maxValue)
      }

      return {
        noise2D: (x: number, z: number): Effect.Effect<number, never> =>
          Effect.sync(() => normalizeNoise(noiseFn(x, z))),

        octaveNoise2D: (x: number, z: number, octaves: number, persistence: number, lacunarity: number): Effect.Effect<number, never> =>
          Effect.sync(() => computeOctaveNoise(x, z, octaves, persistence, lacunarity)),

        setSeed: (seed: number): Effect.Effect<void, never, never> =>
          Effect.sync(() => {
            noiseFn = createPerlinNoise2D(mulberry32(seed))
          }),

        octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>, octaves: number, persistence: number, lacunarity: number): Effect.Effect<ReadonlyArray<number>, never> =>
          Effect.sync(() => points.map(([x, z]) => computeOctaveNoise(x, z, octaves, persistence, lacunarity))),

        noise2DBatch: (points: ReadonlyArray<readonly [number, number]>): Effect.Effect<ReadonlyArray<number>, never> =>
          Effect.sync(() => points.map(([x, z]) => normalizeNoise(noiseFn(x, z)))),

        octaveNoise2DBatchXY: (
          xs: ReadonlyArray<number>,
          zs: ReadonlyArray<number>,
          octaves: number,
          persistence: number,
          lacunarity: number,
        ): Effect.Effect<ReadonlyArray<number>, never> =>
          Effect.sync(() => {
            const length = xs.length
            const values: number[] = []
            values.length = length
            for (let i = 0; i < length; i++) {
              values[i] = computeOctaveNoise(xs[i]!, zs[i]!, octaves, persistence, lacunarity)
            }
            return values
          }),

        noise2DBatchXY: (xs: ReadonlyArray<number>, zs: ReadonlyArray<number>): Effect.Effect<ReadonlyArray<number>, never> =>
          Effect.sync(() => {
            const length = xs.length
            const values: number[] = []
            values.length = length
            for (let i = 0; i < length; i++) {
              values[i] = normalizeNoise(noiseFn(xs[i]!, zs[i]!))
            }
            return values
          }),
      }
    })
  }
) {}
export const NoiseServiceLive = NoiseService.Default
