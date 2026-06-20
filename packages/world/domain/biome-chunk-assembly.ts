import { CHUNK_SIZE } from '@ts-minecraft/core'
import type { BiomeProperties, BiomeType } from './biome'
import {
  buildChunkBaseBiomes,
  collectOutsideChunkNeighborCoords,
  type ChunkBiomeClimateSamples,
  type ChunkBoundaryBiomeCoord,
} from './biome-chunk'
import {
  buildBiomeChunkEntries,
  buildBiomeChunkNoiseBatchInputs,
  type BiomeChunkEntry,
  type BiomeChunkNoiseBatchInputs,
} from './biome-service-helpers'

export type BiomeChunkTerrainChannels = Readonly<{
  readonly continentalness: ArrayLike<number>
  readonly erosion: ArrayLike<number>
  readonly pv: ArrayLike<number>
}>

export type BiomeChunkSamplingPlan = Readonly<{
  readonly batchInputs: BiomeChunkNoiseBatchInputs
  readonly terrainStartX: number
  readonly terrainStartZ: number
  readonly outsideNeighborCoords: ReadonlyArray<ChunkBoundaryBiomeCoord>
}>

export type BuildBiomeChunkSamplingPlanInput = Readonly<{
  chunkX: number
  chunkZ: number
  biomeScale: number
  riverNoiseScale: number
  riverWorldOffset: number
}>

export const buildBiomeChunkSamplingPlan = ({
  chunkX,
  chunkZ,
  biomeScale,
  riverNoiseScale,
  riverWorldOffset,
}: BuildBiomeChunkSamplingPlanInput): BiomeChunkSamplingPlan => ({
  batchInputs: buildBiomeChunkNoiseBatchInputs({
    chunkX,
    chunkZ,
    biomeScale,
    riverNoiseScale,
    riverWorldOffset,
  }),
  terrainStartX: chunkX * CHUNK_SIZE,
  terrainStartZ: chunkZ * CHUNK_SIZE,
  outsideNeighborCoords: collectOutsideChunkNeighborCoords(chunkX, chunkZ),
})

export type BuildOutsideNeighborBiomeMapInput = Readonly<{
  coords: ReadonlyArray<ChunkBoundaryBiomeCoord>
  biomes: ReadonlyArray<BiomeType>
}>

export const buildOutsideNeighborBiomeMap = ({
  coords,
  biomes,
}: BuildOutsideNeighborBiomeMapInput): ReadonlyMap<string, BiomeType> => {
  const entries = new Map<string, BiomeType>()

  for (let i = 0; i < coords.length; i++) {
    const coord = coords[i]
    const biome = biomes[i]
    if (coord && biome) {
      entries.set(coord.key, biome)
    }
  }

  return entries
}

export type AssembleBiomeChunkEntriesInput = Readonly<{
  chunkX: number
  chunkZ: number
  climate: ChunkBiomeClimateSamples
  outsideNeighborBiomesByKey: ReadonlyMap<string, BiomeType>
  propsForBiome: (biome: BiomeType) => BiomeProperties
}>

export const assembleBiomeChunkEntries = ({
  chunkX,
  chunkZ,
  climate,
  outsideNeighborBiomesByKey,
  propsForBiome,
}: AssembleBiomeChunkEntriesInput): ReadonlyArray<BiomeChunkEntry> => {
  const baseBiomes = buildChunkBaseBiomes(climate)

  return buildBiomeChunkEntries({
    chunkX,
    chunkZ,
    baseBiomes,
    continentalness: climate.continentalness,
    outsideNeighborBiomesByKey,
    propsForBiome,
  })
}
