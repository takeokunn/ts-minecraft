import { CHUNK_SIZE } from '@ts-minecraft/core'
import { LAKE_SHORE_WIDTH, LAKE_THRESHOLD } from './constants'
import type {
  ColumnState,
  ColumnStateBuildArgs,
  OverhangTarget,
  TerrainLevels,
} from './generator-types'

export type BiomeColumn = ColumnStateBuildArgs['biomeColumns'][number]

export type TerrainChannelValues = Readonly<{
  readonly erosion: number
  readonly jaggedness: number
  readonly continentalness: number
  readonly pv: number
}>

export const columnStateIndex = (lx: number, lz: number): number => lx * CHUNK_SIZE + lz

export const terrainSampleIndex = (lx: number, lz: number): number => lz * CHUNK_SIZE + lx

export const readNumber = (values: ArrayLike<number>, index: number): number => values[index] as number

export const readBiomeColumn = (
  biomeColumns: ReadonlyArray<BiomeColumn>,
  index: number,
): BiomeColumn => biomeColumns[index] as BiomeColumn

export const readColumnState = (
  columnStates: ReadonlyArray<ColumnState>,
  index: number,
): ColumnState => columnStates[index] as ColumnState

export const readOverhangTarget = (
  overhangTargets: ReadonlyArray<OverhangTarget>,
  index: number,
): OverhangTarget => overhangTargets[index] as OverhangTarget

export const readTerrainChannelValues = (
  terrainChannels: ColumnStateBuildArgs['terrainChannels'],
  index: number,
): TerrainChannelValues => ({
  erosion: readNumber(terrainChannels.erosion, index),
  jaggedness: readNumber(terrainChannels.jaggedness, index),
  continentalness: readNumber(terrainChannels.continentalness, index),
  pv: readNumber(terrainChannels.pv, index),
})

export const isLakeShoreColumn = (
  lakeBasinY: ColumnState['lakeBasinY'],
  lakeNoiseVal: number,
  surfaceY: number,
  terrainLevels: TerrainLevels,
): boolean =>
  lakeBasinY._tag === 'None'
  && lakeNoiseVal > LAKE_THRESHOLD - LAKE_SHORE_WIDTH
  && surfaceY < terrainLevels.lakeLevel + 4
