import { Effect, Ref } from 'effect'
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
    effect: Ref.make<NoiseFn2D>(createPerlinNoise2D()).pipe(Effect.map((noiseRef) => ({
        noise2D: (x: number, z: number): Effect.Effect<number, never> =>
          Ref.get(noiseRef).pipe(Effect.map((noiseFn) => normalizeNoise(noiseFn(x, z)))),

        octaveNoise2D: (x: number, z: number, octaves: number, persistence: number, lacunarity: number): Effect.Effect<number, never> =>
          Ref.get(noiseRef).pipe(Effect.map((noiseFn) => {
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
          })),

        setSeed: (seed: number): Effect.Effect<void, never, never> =>
          Ref.set(noiseRef, createPerlinNoise2D(mulberry32(seed))),

        octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>, octaves: number, persistence: number, lacunarity: number): Effect.Effect<ReadonlyArray<number>, never> =>
          Ref.get(noiseRef).pipe(Effect.map((noiseFn) =>
            points.map(([x, z]) => {
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
            })
          )),

        noise2DBatch: (points: ReadonlyArray<readonly [number, number]>): Effect.Effect<ReadonlyArray<number>, never> =>
          Ref.get(noiseRef).pipe(Effect.map((noiseFn) =>
            points.map(([x, z]) => normalizeNoise(noiseFn(x, z)))
          )),
    })))
  }
) {}
export const NoiseServiceLive = NoiseService.Default
