import { CHUNK_SIZE } from '@ts-minecraft/core'
import type { BiomeType } from './biome'
import { batchTerrainIndexFor, classifyBiomeFromClimate } from './biome-classifier'
import { CHUNK_COLUMN_SAMPLE_COUNT } from './noise-primitives'
import { refineBeachBiomeFromAdjacent } from './biome-classifier'

export type ChunkBoundaryBiomeCoord = Readonly<{
  readonly key: string
  readonly x: number
  readonly z: number
}>

export type ChunkBiomeRefinementInput = Readonly<{
  readonly chunkX: number
  readonly chunkZ: number
  readonly baseBiomes: ReadonlyArray<BiomeType>
  readonly continentalness: ArrayLike<number>
  readonly outsideNeighborBiomesByKey: ReadonlyMap<string, BiomeType>
}>

export type ChunkBiomeClimateSamples = Readonly<{
  readonly temperature: ArrayLike<number>
  readonly humidity: ArrayLike<number>
  readonly continentalness: ArrayLike<number>
  readonly erosion: ArrayLike<number>
  readonly pv: ArrayLike<number>
  readonly riverNoise: ArrayLike<number>
}>

const coordKey = (x: number, z: number): string => `${x},${z}`

export const collectOutsideChunkNeighborCoords = (
  chunkX: number,
  chunkZ: number,
): ReadonlyArray<ChunkBoundaryBiomeCoord> => {
  const coords: Array<ChunkBoundaryBiomeCoord> = []
  const seen = new Set<string>()
  const baseWorldX = chunkX * CHUNK_SIZE
  const baseWorldZ = chunkZ * CHUNK_SIZE

  const push = (x: number, z: number): void => {
    const key = coordKey(x, z)
    if (seen.has(key)) return
    seen.add(key)
    coords.push({ key, x, z })
  }

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    const worldX = baseWorldX + lx
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const worldZ = baseWorldZ + lz
      if (lx === 0) push(worldX - 1, worldZ)
      if (lx === CHUNK_SIZE - 1) push(worldX + 1, worldZ)
      if (lz === 0) push(worldX, worldZ - 1)
      if (lz === CHUNK_SIZE - 1) push(worldX, worldZ + 1)
    }
  }

  return coords
}

export const buildChunkBaseBiomes = ({
  temperature,
  humidity,
  continentalness,
  erosion,
  pv,
  riverNoise,
}: ChunkBiomeClimateSamples): ReadonlyArray<BiomeType> => {
  const biomes: Array<BiomeType> = []
  biomes.length = CHUNK_COLUMN_SAMPLE_COUNT

  for (let i = 0; i < CHUNK_COLUMN_SAMPLE_COUNT; i++) {
    const terrainIdx = batchTerrainIndexFor(i)
    biomes[i] = classifyBiomeFromClimate({
      temperature: temperature[i] ?? Number.NaN,
      humidity: humidity[i] ?? Number.NaN,
      continentalness: continentalness[terrainIdx] ?? Number.NaN,
      erosion: erosion[terrainIdx] ?? Number.NaN,
      pv: pv[terrainIdx] ?? Number.NaN,
      riverNoise: riverNoise[i] ?? Number.NaN,
    })
  }

  return biomes
}

export const buildRefinedChunkBiomes = ({
  chunkX,
  chunkZ,
  baseBiomes,
  continentalness,
  outsideNeighborBiomesByKey,
}: ChunkBiomeRefinementInput): ReadonlyArray<BiomeType> => {
  const refined: Array<BiomeType> = []
  refined.length = CHUNK_COLUMN_SAMPLE_COUNT

  const baseWorldX = chunkX * CHUNK_SIZE
  const baseWorldZ = chunkZ * CHUNK_SIZE

  for (let i = 0; i < CHUNK_COLUMN_SAMPLE_COUNT; i++) {
    const lx = Math.floor(i / CHUNK_SIZE)
    const lz = i % CHUNK_SIZE
    const worldX = baseWorldX + lx
    const worldZ = baseWorldZ + lz
    const biome = baseBiomes[i] ?? 'PLAINS'

    const getNeighborBiome = (dx: number, dz: number): BiomeType => {
      const nx = lx + dx
      const nz = lz + dz
      if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
        return baseBiomes[nx * CHUNK_SIZE + nz] ?? biome
      }

      return outsideNeighborBiomesByKey.get(coordKey(worldX + dx, worldZ + dz)) ?? biome
    }

    refined[i] = refineBeachBiomeFromAdjacent(
      biome,
      getNeighborBiome(-1, 0),
      getNeighborBiome(1, 0),
      getNeighborBiome(0, -1),
      getNeighborBiome(0, 1),
      continentalness[i] ?? Number.NaN,
    )
  }

  return refined
}
