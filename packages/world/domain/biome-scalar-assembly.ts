import type { BiomeType } from './biome'
import { refineBeachBiome } from './biome-classifier'

export type ScalarBiomeNeighborCoord = Readonly<{
  x: number
  z: number
}>

export type BiomeScalarSamplingPlan = Readonly<{
  tempX: number
  tempZ: number
  humX: number
  humZ: number
  riverX: number
  riverZ: number
  neighboringCoords: ReadonlyArray<ScalarBiomeNeighborCoord>
}>

export type BuildBiomeScalarSamplingPlanInput = Readonly<{
  x: number
  z: number
  biomeScale: number
  humidityWorldOffset: number
  riverNoiseScale: number
  riverWorldOffset: number
}>

export const buildBiomeScalarSamplingPlan = ({
  x,
  z,
  biomeScale,
  humidityWorldOffset,
  riverNoiseScale,
  riverWorldOffset,
}: BuildBiomeScalarSamplingPlanInput): BiomeScalarSamplingPlan => ({
  tempX: x * biomeScale,
  tempZ: z * biomeScale,
  humX: (x + humidityWorldOffset) * biomeScale,
  humZ: (z + humidityWorldOffset) * biomeScale,
  riverX: x * riverNoiseScale + riverWorldOffset,
  riverZ: z * riverNoiseScale + riverWorldOffset,
  neighboringCoords: [
    { x: x - 1, z },
    { x: x + 1, z },
    { x, z: z - 1 },
    { x, z: z + 1 },
  ],
})

export type RefineScalarBiomeInput = Readonly<{
  biome: BiomeType
  continentalness: number
  neighboringBiomes: ReadonlyArray<BiomeType>
}>

export const refineScalarBiome = ({
  biome,
  continentalness,
  neighboringBiomes,
}: RefineScalarBiomeInput): BiomeType =>
  refineBeachBiome(biome, neighboringBiomes, continentalness)
