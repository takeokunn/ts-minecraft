import { Array as Arr, Effect, Layer } from 'effect'
import { BiomeService, BiomeServiceLive, NoiseServicePort } from '@ts-minecraft/terrain'
import { CHUNK_SIZE } from '@ts-minecraft/kernel'

export const makeMockNoiseLayer = (tempValue: number, humidityValue: number) =>
  Layer.succeed(NoiseServicePort, {
    noise2D: (_x: number, _z: number) => Effect.succeed(0.5),
    octaveNoise2D: (x: number, _z: number) =>
      Effect.succeed(x > 25.0 ? humidityValue : tempValue),
    octaveNoise2DBatchXY: (xs: ReadonlyArray<number>, _zs: ReadonlyArray<number>) =>
      Effect.succeed(Arr.map(xs, (x) => (x > 25.0 ? humidityValue : tempValue))),
    noise2DBatchXY: (xs: ReadonlyArray<number>, _zs: ReadonlyArray<number>) =>
      Effect.succeed(Arr.makeBy(xs.length, () => 0.9)),
    continentalness: (_x: number, _z: number) => Effect.succeed(0.35),
    erosion: (_x: number, _z: number) => Effect.succeed(0.6),
    weirdness: (_x: number, _z: number) => Effect.succeed(0),
    jaggedness: (_x: number, _z: number) => Effect.succeed(0),
    sampleTerrainChannels: (_x: number, _z: number) => Effect.succeed({
      continentalness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0.35)),
      erosion: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0.6)),
      pv: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0)),
      jaggedness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0)),
    }),
    setSeed: (_seed: number) => Effect.void,
  } as unknown as NoiseServicePort)

export const makeTestLayer = (temp: number, hum: number) =>
  BiomeServiceLive.pipe(Layer.provide(makeMockNoiseLayer(temp, hum)))

export const withBiomeService = <A>(
  temp: number,
  hum: number,
  f: (service: BiomeService) => Effect.Effect<A, never>,
): Effect.Effect<A, never> =>
  Effect.flatMap(BiomeService, f).pipe(Effect.provide(makeTestLayer(temp, hum)))
