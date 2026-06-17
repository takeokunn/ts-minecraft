import { Array as Arr, Effect, Layer } from 'effect'
import {
  BiomeService,
  CHUNK_COLUMN_SAMPLE_COUNT,
  NoiseServicePort,
} from '@ts-minecraft/world'

export const makeMockNoiseLayer = (tempValue: number, humidityValue: number) =>
  Layer.succeed(NoiseServicePort, NoiseServicePort.of({
    _tag: '@minecraft/application/noise/NoiseServicePort' as const,
    noise2D: (_x: number, _z: number) => Effect.succeed(0.5),
    octaveNoise2D: (x: number, _z: number) =>
      Effect.succeed(x > 25.0 ? humidityValue : tempValue),
    getSeed: Effect.succeed(0),
    octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
      Effect.succeed(Arr.map(points, ([x]) => (x > 25.0 ? humidityValue : tempValue))),
    octaveNoise2DBatchXY: (xs: ReadonlyArray<number>, _zs: ReadonlyArray<number>) =>
      Effect.succeed(Arr.map(xs, (x) => (x > 25.0 ? humidityValue : tempValue))),
    noise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
      Effect.succeed(Arr.makeBy(points.length, () => 0.9)),
    noise2DBatchXY: (xs: ReadonlyArray<number>, _zs: ReadonlyArray<number>) =>
      Effect.succeed(Arr.makeBy(xs.length, () => 0.9)),
    noise3D: (_x: number, _y: number, _z: number) => Effect.succeed(0),
    noise3DBatchXYZ: (xs: ReadonlyArray<number>, _ys: ReadonlyArray<number>, _zs: ReadonlyArray<number>) =>
      Effect.succeed(Arr.makeBy(xs.length, () => 0)),
    continentalness: (_x: number, _z: number) => Effect.succeed(0.35),
    erosion: (_x: number, _z: number) => Effect.succeed(0.6),
    weirdness: (_x: number, _z: number) => Effect.succeed(0),
    jaggedness: (_x: number, _z: number) => Effect.succeed(0),
    sampleTerrainChannels: (_x: number, _z: number) => Effect.succeed({
      continentalness: new Float64Array(Arr.makeBy(CHUNK_COLUMN_SAMPLE_COUNT, () => 0.35)),
      erosion: new Float64Array(Arr.makeBy(CHUNK_COLUMN_SAMPLE_COUNT, () => 0.6)),
      pv: new Float64Array(Arr.makeBy(CHUNK_COLUMN_SAMPLE_COUNT, () => 0)),
      jaggedness: new Float64Array(Arr.makeBy(CHUNK_COLUMN_SAMPLE_COUNT, () => 0)),
    }),
    setSeed: (_seed: number) => Effect.void,
  }))

export const makeTestLayer = (temp: number, hum: number): Layer.Layer<BiomeService, never, never> =>
  BiomeService.Default.pipe(Layer.provide(makeMockNoiseLayer(temp, hum)))

export const withBiomeService = <A>(
  temp: number,
  hum: number,
  f: (service: BiomeService) => Effect.Effect<A, never, never>,
): Effect.Effect<A, never, never> =>
  Effect.flatMap(BiomeService, f).pipe(Effect.provide(makeTestLayer(temp, hum)))
