import type { BiomeProperties, BiomeType } from './biome'
import { buildRefinedChunkBiomes } from './biome-chunk'
import {
  buildChunkNoiseInputs,
  classifyBiomeFromClimate,
  peaksAndValleysFromWeirdness,
  type ChunkNoiseCoord,
} from './biome-classifier'

export type ChunkNoiseInput = ChunkNoiseCoord

export type BiomeChunkEntry = Readonly<{
  readonly biome: BiomeType
  readonly props: BiomeProperties
}>

export type SampledBiomeDataInput = Readonly<{
  temperature: number
  humidity: number
  continentalness: number
  erosion: number
  weirdness: number
  riverNoise: number
}>

export type SampledBiomeData = Readonly<{
  biome: BiomeType
  continentalness: number
}>

const MISSING_CHUNK_NOISE_INPUT: ChunkNoiseInput = {
  tempX: Number.NaN,
  tempZ: Number.NaN,
  humX: Number.NaN,
  humZ: Number.NaN,
}

export const readChunkNoiseInput = (
  coords: ReadonlyArray<ChunkNoiseInput>,
  index: number,
): ChunkNoiseInput => coords[index] ?? MISSING_CHUNK_NOISE_INPUT

export const makeBiomeChunkEntry = (
  biome: BiomeType,
  props: BiomeProperties,
): BiomeChunkEntry => ({
  biome,
  props,
})

export const buildSampledBiomeData = ({
  temperature,
  humidity,
  continentalness,
  erosion,
  weirdness,
  riverNoise,
}: SampledBiomeDataInput): SampledBiomeData => ({
  biome: classifyBiomeFromClimate({
    temperature,
    humidity,
    continentalness,
    erosion,
    pv: peaksAndValleysFromWeirdness(weirdness),
    riverNoise,
  }),
  continentalness,
})

export type BiomeChunkNoiseBatchInputs = Readonly<{
  tempXs: Array<number>
  tempZs: Array<number>
  humXs: Array<number>
  humZs: Array<number>
  riverXs: Array<number>
  riverZs: Array<number>
}>

export type BuildBiomeChunkNoiseBatchInputsFromCoordsInput = Readonly<{
  coords: ReadonlyArray<ChunkNoiseInput>
  riverScale: number
  riverWorldOffset: number
}>

export const buildChunkNoiseBatchInputsFromCoords = ({
  coords,
  riverScale,
  riverWorldOffset,
}: BuildBiomeChunkNoiseBatchInputsFromCoordsInput): BiomeChunkNoiseBatchInputs => {
  const tempXs: Array<number> = []
  const tempZs: Array<number> = []
  const humXs: Array<number> = []
  const humZs: Array<number> = []
  const riverXs: Array<number> = []
  const riverZs: Array<number> = []
  tempXs.length = coords.length
  tempZs.length = coords.length
  humXs.length = coords.length
  humZs.length = coords.length
  riverXs.length = coords.length
  riverZs.length = coords.length

  for (let i = 0; i < coords.length; i++) {
    const coord = readChunkNoiseInput(coords, i)
    tempXs[i] = coord.tempX
    tempZs[i] = coord.tempZ
    humXs[i] = coord.humX
    humZs[i] = coord.humZ
    riverXs[i] = coord.tempX * riverScale + riverWorldOffset
    riverZs[i] = coord.tempZ * riverScale + riverWorldOffset
  }

  return { tempXs, tempZs, humXs, humZs, riverXs, riverZs }
}

export type BuildBiomeChunkNoiseBatchInputsInput = Readonly<{
  chunkX: number
  chunkZ: number
  biomeScale: number
  riverNoiseScale: number
  riverWorldOffset: number
}>

export const buildBiomeChunkNoiseBatchInputs = ({
  chunkX,
  chunkZ,
  biomeScale,
  riverNoiseScale,
  riverWorldOffset,
}: BuildBiomeChunkNoiseBatchInputsInput): BiomeChunkNoiseBatchInputs =>
  buildChunkNoiseBatchInputsFromCoords({
    coords: buildChunkNoiseInputs(chunkX, chunkZ),
    riverScale: riverNoiseScale / biomeScale,
    riverWorldOffset,
  })

export type BuildBiomeChunkEntriesInput = Readonly<{
  chunkX: number
  chunkZ: number
  baseBiomes: ReadonlyArray<BiomeType>
  continentalness: ArrayLike<number>
  outsideNeighborBiomesByKey: ReadonlyMap<string, BiomeType>
  propsForBiome: (biome: BiomeType) => BiomeProperties
}>

export const buildBiomeChunkEntries = ({
  chunkX,
  chunkZ,
  baseBiomes,
  continentalness,
  outsideNeighborBiomesByKey,
  propsForBiome,
}: BuildBiomeChunkEntriesInput): ReadonlyArray<BiomeChunkEntry> => {
  const refinedBiomes = buildRefinedChunkBiomes({
    chunkX,
    chunkZ,
    baseBiomes,
    continentalness,
    outsideNeighborBiomesByKey,
  })

  const entries: Array<BiomeChunkEntry> = []
  for (const biome of refinedBiomes) {
    entries.push(makeBiomeChunkEntry(biome, propsForBiome(biome)))
  }

  return entries
}
