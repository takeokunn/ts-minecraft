import { Effect } from 'effect'
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise'

type RandomFn = () => number

const mulberry32 = (seed: number): RandomFn => {
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
    effect: Effect.gen(function* () {
      let currentNoise2D: NoiseFunction2D = createNoise2D()

      return {
        noise2D: (x: number, z: number): number => normalizeNoise(currentNoise2D(x, z)),

        octaveNoise2D: (x: number, z: number, octaves: number, persistence: number, lacunarity: number): number => {
          let total = 0
          let frequency = 1
          let amplitude = 1
          let maxValue = 0

          for (let i = 0; i < octaves; i++) {
            total += currentNoise2D(x * frequency, z * frequency) * amplitude
            maxValue += amplitude
            amplitude *= persistence
            frequency *= lacunarity
          }

          return normalizeNoise(total / maxValue)
        },

        setSeed: (seed: number): Effect.Effect<void, never> =>
          Effect.sync(() => {
            currentNoise2D = createNoise2D(mulberry32(seed))
          }),
      }
    }),
  }
) {}
export { NoiseService as NoiseServiceLive }
