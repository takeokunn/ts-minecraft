import { CHUNK_SIZE } from '@ts-minecraft/core'
import { Effect } from 'effect'

const TERRAIN_CHANNEL_SAMPLE_COUNT = CHUNK_SIZE * CHUNK_SIZE

const makeDefaultBatch = (length: number, value: number): ReadonlyArray<number> =>
  Array.from({ length }, () => value)

const makeDefaultTerrainChannel = (): Float64Array => new Float64Array(TERRAIN_CHANNEL_SAMPLE_COUNT)

// Application-layer port for noise generation.
// Decouples application services from the infrastructure Perlin-noise implementation.
// Wired to infrastructure/noise/NoiseService via NoisePortLayer in src/layers.ts.
export class NoiseServicePort extends Effect.Service<NoiseServicePort>()(
  '@minecraft/application/noise/NoiseServicePort',
  {
    succeed: {
      /* c8 ignore next 2 */
      noise2D: (_x: number, _z: number): Effect.Effect<number, never> => Effect.succeed(0.5),
      /* c8 ignore next 7 */
      octaveNoise2D: (
        _x: number,
        _z: number,
        _octaves: number,
        _persistence: number,
        _lacunarity: number,
      ): Effect.Effect<number, never> => Effect.succeed(0.5),
      /* c8 ignore next */
      setSeed: (_seed: number): Effect.Effect<void, never> => Effect.void,
      getSeed: Effect.succeed(0),
      /* c8 ignore next 6 */
      octaveNoise2DBatch: (
        points: ReadonlyArray<readonly [number, number]>,
        _octaves: number,
        _persistence: number,
        _lacunarity: number,
      ): Effect.Effect<ReadonlyArray<number>> => Effect.succeed(makeDefaultBatch(points.length, 0.5)),
      /* c8 ignore next 7 */
      octaveNoise2DBatchXY: (
        xs: ReadonlyArray<number>,
        _zs: ReadonlyArray<number>,
        _octaves: number,
        _persistence: number,
        _lacunarity: number,
      ): Effect.Effect<ReadonlyArray<number>> => Effect.succeed(makeDefaultBatch(xs.length, 0.5)),
      /* c8 ignore next 3 */
      noise2DBatch: (
        points: ReadonlyArray<readonly [number, number]>,
      ): Effect.Effect<ReadonlyArray<number>> => Effect.succeed(makeDefaultBatch(points.length, 0.5)),
      /* c8 ignore next 4 */
      noise2DBatchXY: (
        xs: ReadonlyArray<number>,
        _zs: ReadonlyArray<number>,
      ): Effect.Effect<ReadonlyArray<number>> => Effect.succeed(makeDefaultBatch(xs.length, 0.5)),
      /* c8 ignore next 5 */
      noise3D: (
        _x: number,
        _y: number,
        _z: number,
      ): Effect.Effect<number, never> => Effect.succeed(0),
      /* c8 ignore next 5 */
      noise3DBatchXYZ: (
        xs: ReadonlyArray<number>,
        _ys: ReadonlyArray<number>,
        _zs: ReadonlyArray<number>,
      ): Effect.Effect<ReadonlyArray<number>> => Effect.succeed(makeDefaultBatch(xs.length, 0)),
      /* c8 ignore next 4 */
      continentalness: (_x: number, _z: number): Effect.Effect<number, never> => Effect.succeed(0),
      erosion: (_x: number, _z: number): Effect.Effect<number, never> => Effect.succeed(0),
      weirdness: (_x: number, _z: number): Effect.Effect<number, never> => Effect.succeed(0),
      jaggedness: (_x: number, _z: number): Effect.Effect<number, never> => Effect.succeed(0),
      /* c8 ignore next 18 */
      sampleTerrainChannels: (
        _xStart: number,
        _zStart: number,
      ): Effect.Effect<
        {
          readonly continentalness: Float64Array
          readonly erosion: Float64Array
          readonly pv: Float64Array
          readonly jaggedness: Float64Array
        },
        never
      > =>
        Effect.succeed({
          continentalness: makeDefaultTerrainChannel(),
          erosion: makeDefaultTerrainChannel(),
          pv: makeDefaultTerrainChannel(),
          jaggedness: makeDefaultTerrainChannel(),
        }),
    },
  }
) {}
