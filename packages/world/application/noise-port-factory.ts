import { Effect } from 'effect'
import { NoiseServicePort } from '../domain/noise-service-port'
import type { NoisePrimitives } from '../domain/noise-primitives'
import {
  computeTerrainChannels,
  noise3DBatchXYZ,
  octaveNoise2DBatch,
  noise2DBatch,
  octaveNoise2DBatchXY,
  noise2DBatchXY,
} from '../domain/noise-primitives'

// Effect-wrapped port factory — converts a fixed-seed NoisePrimitives bundle
// into a NoiseServicePort implementation. Used by the terrain worker (fixed
// seed per chunk batch) and for test layers.
export const buildNoisePortFromPrimitives = (primitives: NoisePrimitives, seed: number): NoiseServicePort =>
  NoiseServicePort.of({
    _tag: '@minecraft/application/noise/NoiseServicePort' as const,
    noise2D: (x: number, z: number): Effect.Effect<number, never> =>
      Effect.sync(() => primitives.noise2D(x, z)),
    octaveNoise2D: (
      x: number,
      z: number,
      octaves: number,
      persistence: number,
      lacunarity: number,
    ): Effect.Effect<number, never> =>
      Effect.sync(() => primitives.octaveNoise2D(x, z, octaves, persistence, lacunarity)),
    setSeed: (_seed: number): Effect.Effect<void, never> => Effect.void,
    getSeed: Effect.succeed(seed),
    noise3D: (x: number, y: number, z: number): Effect.Effect<number, never> =>
      Effect.sync(() => primitives.noise3D(x, y, z)),
    noise3DBatchXYZ: (
      xs: ReadonlyArray<number>,
      ys: ReadonlyArray<number>,
      zs: ReadonlyArray<number>,
    ): Effect.Effect<ReadonlyArray<number>, never> =>
      Effect.sync(() => noise3DBatchXYZ(primitives, xs, ys, zs)),
    octaveNoise2DBatch: (
      points: ReadonlyArray<readonly [number, number]>,
      octaves: number,
      persistence: number,
      lacunarity: number,
    ): Effect.Effect<ReadonlyArray<number>, never> =>
      Effect.sync(() => octaveNoise2DBatch(primitives, points, octaves, persistence, lacunarity)),
    noise2DBatch: (
      points: ReadonlyArray<readonly [number, number]>,
    ): Effect.Effect<ReadonlyArray<number>, never> =>
      Effect.sync(() => noise2DBatch(primitives, points)),
    octaveNoise2DBatchXY: (
      xs: ReadonlyArray<number>,
      zs: ReadonlyArray<number>,
      octaves: number,
      persistence: number,
      lacunarity: number,
    ): Effect.Effect<ReadonlyArray<number>, never> =>
      Effect.sync(() => octaveNoise2DBatchXY(primitives, xs, zs, octaves, persistence, lacunarity)),
    noise2DBatchXY: (
      xs: ReadonlyArray<number>,
      zs: ReadonlyArray<number>,
    ): Effect.Effect<ReadonlyArray<number>, never> =>
      Effect.sync(() => noise2DBatchXY(primitives, xs, zs)),
    continentalness: (x: number, z: number): Effect.Effect<number, never> =>
      Effect.sync(() => primitives.continentalnessAt(x, z)),
    erosion: (x: number, z: number): Effect.Effect<number, never> =>
      Effect.sync(() => primitives.erosionAt(x, z)),
    weirdness: (x: number, z: number): Effect.Effect<number, never> =>
      Effect.sync(() => primitives.weirdnessAt(x, z)),
    jaggedness: (x: number, z: number): Effect.Effect<number, never> =>
      Effect.sync(() => primitives.jaggednessAt(x, z)),
    sampleTerrainChannels: (xStart: number, zStart: number) =>
      Effect.sync(() =>
        computeTerrainChannels(
          primitives.continentalness,
          primitives.erosion,
          primitives.weirdness,
          primitives.jaggedness,
          xStart,
          zStart,
        ),
      ),
  })
