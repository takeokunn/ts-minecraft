import { createPerlinNoise2D, type RandFn } from '@/infrastructure/noise/perlin'
import {
  BIOME_NOISE_PARAMS,
  TERRAIN_NOISE_PARAMS,
  createTerrainNoiseCoordinates,
  type TerrainNoiseSamples,
} from '@/domain/terrain/terrain-generation'
import type { ChunkCoord } from '@/domain/chunk'

const mulberry32 = (seed: number): RandFn => {
  let s = seed >>> 0
  return () => {
    let t = (s += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const sampleTerrainNoise = (coord: ChunkCoord, seed: number): TerrainNoiseSamples => {
  const coordinates = createTerrainNoiseCoordinates(coord)
  const noiseFn = createPerlinNoise2D(mulberry32(seed))

  const sampleOctaveNoise = (
    xs: ReadonlyArray<number>,
    zs: ReadonlyArray<number>,
    octaves: number,
    persistence: number,
    lacunarity: number,
  ): ReadonlyArray<number> => {
    const values: number[] = []
    values.length = xs.length

    for (let i = 0; i < xs.length; i++) {
      let total = 0
      let frequency = 1
      let amplitude = 1
      let maxValue = 0

      for (let octave = 0; octave < octaves; octave++) {
        total += noiseFn(xs[i]! * frequency, zs[i]! * frequency) * amplitude
        maxValue += amplitude
        amplitude *= persistence
        frequency *= lacunarity
      }

      values[i] = (total / maxValue + 1) / 2
    }

    return values
  }

  const sampleNoise = (xs: ReadonlyArray<number>, zs: ReadonlyArray<number>): ReadonlyArray<number> => {
    const values: number[] = []
    values.length = xs.length
    for (let i = 0; i < xs.length; i++) {
      values[i] = (noiseFn(xs[i]!, zs[i]!) + 1) / 2
    }
    return values
  }

  return {
    terrainNoise: sampleOctaveNoise(
      coordinates.terrainXs,
      coordinates.terrainZs,
      TERRAIN_NOISE_PARAMS.octaves,
      TERRAIN_NOISE_PARAMS.persistence,
      TERRAIN_NOISE_PARAMS.lacunarity,
    ),
    lakeNoise: sampleNoise(coordinates.lakeXs, coordinates.lakeZs),
    temperatureNoise: sampleOctaveNoise(
      coordinates.temperatureXs,
      coordinates.temperatureZs,
      BIOME_NOISE_PARAMS.octaves,
      BIOME_NOISE_PARAMS.persistence,
      BIOME_NOISE_PARAMS.lacunarity,
    ),
    humidityNoise: sampleOctaveNoise(
      coordinates.humidityXs,
      coordinates.humidityZs,
      BIOME_NOISE_PARAMS.octaves,
      BIOME_NOISE_PARAMS.persistence,
      BIOME_NOISE_PARAMS.lacunarity,
    ),
  }
}
