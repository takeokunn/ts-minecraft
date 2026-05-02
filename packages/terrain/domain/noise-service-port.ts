import { Array as Arr, Effect } from 'effect'

// Application-layer port for noise generation.
// Decouples application services from the infrastructure Perlin-noise implementation.
// Wired to infrastructure/noise/NoiseService via NoisePortLayer in src/layers.ts.
export class NoiseServicePort extends Effect.Service<NoiseServicePort>()(
  '@minecraft/application/noise/NoiseServicePort',
  {
    succeed: {
      noise2D: (_x: number, _z: number): Effect.Effect<number, never> => Effect.succeed(0.5),
      octaveNoise2D: (
        _x: number,
        _z: number,
        _octaves: number,
        _persistence: number,
        _lacunarity: number,
      ): Effect.Effect<number, never> => Effect.succeed(0.5),
      setSeed: (_seed: number): Effect.Effect<void, never> => Effect.void,
      getSeed: Effect.succeed(0),
      octaveNoise2DBatch: (
        points: ReadonlyArray<readonly [number, number]>,
        _octaves: number,
        _persistence: number,
        _lacunarity: number,
      ): Effect.Effect<ReadonlyArray<number>> => Effect.succeed(Arr.makeBy(points.length, () => 0.5)),
      octaveNoise2DBatchXY: (
        xs: ReadonlyArray<number>,
        _zs: ReadonlyArray<number>,
        _octaves: number,
        _persistence: number,
        _lacunarity: number,
      ): Effect.Effect<ReadonlyArray<number>> => Effect.succeed(Arr.makeBy(xs.length, () => 0.5)),
      noise2DBatch: (
        points: ReadonlyArray<readonly [number, number]>,
      ): Effect.Effect<ReadonlyArray<number>> => Effect.succeed(Arr.makeBy(points.length, () => 0.5)),
      noise2DBatchXY: (
        xs: ReadonlyArray<number>,
        _zs: ReadonlyArray<number>,
      ): Effect.Effect<ReadonlyArray<number>> => Effect.succeed(Arr.makeBy(xs.length, () => 0.5)),
      noise3D: (
        _x: number,
        _y: number,
        _z: number,
      ): Effect.Effect<number, never> => Effect.succeed(0),
      noise3DBatchXYZ: (
        xs: ReadonlyArray<number>,
        _ys: ReadonlyArray<number>,
        _zs: ReadonlyArray<number>,
      ): Effect.Effect<ReadonlyArray<number>> => Effect.succeed(Arr.makeBy(xs.length, () => 0)),
      continentalness: (_x: number, _z: number): Effect.Effect<number, never> => Effect.succeed(0),
      erosion: (_x: number, _z: number): Effect.Effect<number, never> => Effect.succeed(0),
      weirdness: (_x: number, _z: number): Effect.Effect<number, never> => Effect.succeed(0),
      jaggedness: (_x: number, _z: number): Effect.Effect<number, never> => Effect.succeed(0),
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
          continentalness: new Float64Array(256),
          erosion: new Float64Array(256),
          pv: new Float64Array(256),
          jaggedness: new Float64Array(256),
        }),
    },
  }
) {}
