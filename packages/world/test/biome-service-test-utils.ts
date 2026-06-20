import { Array as Arr, Effect, Layer } from 'effect'
import {
  BiomeService,
  BIOME_SCALE,
  CHUNK_COLUMN_SAMPLE_COUNT,
  HUMIDITY_WORLD_OFFSET,
  type NoiseServicePort as NoiseServicePortType,
  NoiseServicePort,
  RIVER_NOISE_SCALE,
  RIVER_WORLD_OFFSET,
} from '@ts-minecraft/world'
import { CHUNK_SIZE } from '@ts-minecraft/core'

type WorldCoordNoiseSampler = {
  temperatureAt: (x: number, z: number) => number
  humidityAt: (x: number, z: number) => number
  continentalnessAt?: (x: number, z: number) => number
  erosionAt?: (x: number, z: number) => number
  weirdnessAt?: (x: number, z: number) => number
  riverNoiseAt?: (x: number, z: number) => number
  pvAt?: (x: number, z: number) => number
  jaggednessAt?: (x: number, z: number) => number
}

const decodeBiomeSampleCoord = (x: number, z: number) => {
  const humidityOffset = HUMIDITY_WORLD_OFFSET * BIOME_SCALE
  const isHumidity = x >= humidityOffset / 2
  return {
    isHumidity,
    worldX: Math.round((x - (isHumidity ? humidityOffset : 0)) / BIOME_SCALE),
    worldZ: Math.round((z - (isHumidity ? humidityOffset : 0)) / BIOME_SCALE),
  }
}

const decodeRiverSampleCoord = (x: number, z: number) => ({
  worldX: Math.round((x - RIVER_WORLD_OFFSET * RIVER_NOISE_SCALE) / RIVER_NOISE_SCALE),
  worldZ: Math.round((z - RIVER_WORLD_OFFSET * RIVER_NOISE_SCALE) / RIVER_NOISE_SCALE),
})

const makeTerrainChannel = (
  xStart: number,
  zStart: number,
  readAt: (x: number, z: number) => number,
): Float64Array =>
  new Float64Array(Arr.makeBy(CHUNK_COLUMN_SAMPLE_COUNT, (i) => {
    const x = xStart + (i % CHUNK_SIZE)
    const z = zStart + Math.floor(i / CHUNK_SIZE)
    return readAt(x, z)
  }))

export const makeWorldCoordNoiseLayer = ({
  temperatureAt,
  humidityAt,
  continentalnessAt = () => 0.35,
  erosionAt = () => 0.6,
  weirdnessAt = () => 0,
  riverNoiseAt = () => 0.9,
  pvAt = () => 0,
  jaggednessAt = () => 0,
}: WorldCoordNoiseSampler) =>
  Layer.succeed(NoiseServicePort, NoiseServicePort.of({
    _tag: '@minecraft/application/noise/NoiseServicePort' as const,
    noise2D: (x: number, z: number) => {
      const { worldX, worldZ } = decodeRiverSampleCoord(x, z)
      return Effect.succeed(riverNoiseAt(worldX, worldZ))
    },
    octaveNoise2D: (x: number, z: number) => {
      const { isHumidity, worldX, worldZ } = decodeBiomeSampleCoord(x, z)
      return Effect.succeed(isHumidity ? humidityAt(worldX, worldZ) : temperatureAt(worldX, worldZ))
    },
    getSeed: Effect.succeed(0),
    octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
      Effect.succeed(Arr.map(points, ([x, z]) => {
        const { isHumidity, worldX, worldZ } = decodeBiomeSampleCoord(x, z)
        return isHumidity ? humidityAt(worldX, worldZ) : temperatureAt(worldX, worldZ)
      })),
    octaveNoise2DBatchXY: (xs: ReadonlyArray<number>, zs: ReadonlyArray<number>) =>
      Effect.succeed(Arr.map(xs, (x, i) => {
        const { isHumidity, worldX, worldZ } = decodeBiomeSampleCoord(x, zs[i] ?? 0)
        return isHumidity ? humidityAt(worldX, worldZ) : temperatureAt(worldX, worldZ)
      })),
    noise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
      Effect.succeed(Arr.map(points, ([x, z]) => {
        const { worldX, worldZ } = decodeRiverSampleCoord(x, z)
        return riverNoiseAt(worldX, worldZ)
      })),
    noise2DBatchXY: (xs: ReadonlyArray<number>, zs: ReadonlyArray<number>) =>
      Effect.succeed(Arr.map(xs, (x, i) => {
        const { worldX, worldZ } = decodeRiverSampleCoord(x, zs[i] ?? 0)
        return riverNoiseAt(worldX, worldZ)
      })),
    noise3D: (_x: number, _y: number, _z: number) => Effect.succeed(0),
    noise3DBatchXYZ: (xs: ReadonlyArray<number>, _ys: ReadonlyArray<number>, _zs: ReadonlyArray<number>) =>
      Effect.succeed(Arr.makeBy(xs.length, () => 0)),
    continentalness: (x: number, z: number) => Effect.succeed(continentalnessAt(x, z)),
    erosion: (x: number, z: number) => Effect.succeed(erosionAt(x, z)),
    weirdness: (x: number, z: number) => Effect.succeed(weirdnessAt(x, z)),
    jaggedness: (x: number, z: number) => Effect.succeed(jaggednessAt(x, z)),
    sampleTerrainChannels: (xStart: number, zStart: number) => Effect.succeed({
      continentalness: makeTerrainChannel(xStart, zStart, continentalnessAt),
      erosion: makeTerrainChannel(xStart, zStart, erosionAt),
      pv: makeTerrainChannel(xStart, zStart, pvAt),
      jaggedness: makeTerrainChannel(xStart, zStart, jaggednessAt),
    }),
    setSeed: (_seed: number) => Effect.void,
  }))

export const withBiomeServiceLayer = <A>(
  noiseLayer: Layer.Layer<NoiseServicePortType, never, never>,
  f: (service: BiomeService) => Effect.Effect<A, never, never>,
): Effect.Effect<A, never, never> =>
  Effect.flatMap(BiomeService, f).pipe(
    Effect.provide(BiomeService.Default.pipe(Layer.provide(noiseLayer))),
  )

export const makeMockNoiseLayer = (tempValue: number, humidityValue: number) =>
  makeWorldCoordNoiseLayer({
    temperatureAt: () => tempValue,
    humidityAt: () => humidityValue,
    riverNoiseAt: () => 0.9,
  })

export const makeTestLayer = (temp: number, hum: number): Layer.Layer<BiomeService, never, never> =>
  BiomeService.Default.pipe(Layer.provide(makeMockNoiseLayer(temp, hum)))

export const withBiomeService = <A>(
  temp: number,
  hum: number,
  f: (service: BiomeService) => Effect.Effect<A, never, never>,
): Effect.Effect<A, never, never> =>
  Effect.flatMap(BiomeService, f).pipe(Effect.provide(makeTestLayer(temp, hum)))
