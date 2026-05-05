import { Array as Arr, Effect } from 'effect'
import {
  createNoisePrimitives,
  computeTerrainChannels,
  type NoisePrimitives,
  type TerrainChannelSamples,
} from '../infrastructure/primitives'

// All deterministic noise math now lives in `shared/noise/primitives.ts` so the
// off-thread terrain worker can use the exact same primitives without going
// through the Effect runtime. NoiseService is a thin Effect-wrapper around a
// mutable `NoisePrimitives` reference that gets swapped on `setSeed`.

export class NoiseService extends Effect.Service<NoiseService>()(
  '@minecraft/infrastructure/noise/NoiseService',
  {
    effect: Effect.sync(() => {
      // `let` here, not `Ref`: the surrounding methods are all `Effect.sync`
      // closures over this binding. Identical structure to the previous
      // implementation — preserves the read-modify-write semantics on
      // `setSeed` without introducing scheduling fences.
      let primitives: NoisePrimitives = createNoisePrimitives(0)
      let currentSeed = 0

      return {
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

        getSeed: Effect.sync(() => currentSeed),

        setSeed: (seed: number): Effect.Effect<void, never, never> =>
          Effect.sync(() => {
            currentSeed = seed
            primitives = createNoisePrimitives(seed)
          }),

        noise3D: (x: number, y: number, z: number): Effect.Effect<number, never> =>
          Effect.sync(() => primitives.noise3D(x, y, z)),

        noise3DBatchXYZ: (
          xs: ReadonlyArray<number>,
          ys: ReadonlyArray<number>,
          zs: ReadonlyArray<number>,
        ): Effect.Effect<ReadonlyArray<number>, never> =>
          Effect.sync(() => {
            const length = xs.length
            const values: number[] = []
            values.length = length
            // Hot loop: kept as `for` to match the previous performance
            // boundary in `chunk-manager-service.ts`. `Arr.makeBy` would
            // allocate a callback closure once per call site — fine — but
            // the loop body itself stays imperative for throughput.
            for (let i = 0; i < length; i++) {
              values[i] = primitives.noise3D(xs[i]!, ys[i]!, zs[i]!)
            }
            return values
          }),

        octaveNoise2DBatch: (
          points: ReadonlyArray<readonly [number, number]>,
          octaves: number,
          persistence: number,
          lacunarity: number,
        ): Effect.Effect<ReadonlyArray<number>, never> =>
          Effect.sync(() =>
            Arr.map(points, ([x, z]) =>
              primitives.octaveNoise2D(x, z, octaves, persistence, lacunarity),
            ),
          ),

        noise2DBatch: (
          points: ReadonlyArray<readonly [number, number]>,
        ): Effect.Effect<ReadonlyArray<number>, never> =>
          Effect.sync(() => Arr.map(points, ([x, z]) => primitives.noise2D(x, z))),

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
              values[i] = primitives.octaveNoise2D(xs[i]!, zs[i]!, octaves, persistence, lacunarity)
            }
            return values
          }),

        noise2DBatchXY: (
          xs: ReadonlyArray<number>,
          zs: ReadonlyArray<number>,
        ): Effect.Effect<ReadonlyArray<number>, never> =>
          Effect.sync(() => {
            const length = xs.length
            const values: number[] = []
            values.length = length
            for (let i = 0; i < length; i++) {
              values[i] = primitives.noise2D(xs[i]!, zs[i]!)
            }
            return values
          }),

        continentalness: (x: number, z: number): Effect.Effect<number, never> =>
          Effect.sync(() => primitives.continentalnessAt(x, z)),

        erosion: (x: number, z: number): Effect.Effect<number, never> =>
          Effect.sync(() => primitives.erosionAt(x, z)),

        weirdness: (x: number, z: number): Effect.Effect<number, never> =>
          Effect.sync(() => primitives.weirdnessAt(x, z)),

        jaggedness: (x: number, z: number): Effect.Effect<number, never> =>
          Effect.sync(() => primitives.jaggednessAt(x, z)),

        sampleTerrainChannels: (
          xStart: number,
          zStart: number,
        ): Effect.Effect<TerrainChannelSamples, never> =>
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
      }
    }),
  }
) {}
export const NoiseServiceLive = NoiseService.Default
