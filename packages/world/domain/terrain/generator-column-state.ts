import { MutableHashMap, Option } from 'effect'
import { blockTypeToIndex, CHUNK_SIZE } from '@ts-minecraft/core'
import { VARIANT_THRESHOLD } from './constants'
import { computeLakeBasin, fillWaterForColumn, resolveSurfaceY, shouldFreezeWaterSurface } from './lake-generator'
import { createTreeColumnKey, supportsTreeAtSurface } from './generator-coordinates'
import { DEFAULT_TERRAIN_LEVELS } from './generator-types'
import type { ColumnState, ColumnStateBuildArgs } from './generator-types'
import { computeRuggedness, chunkBlockIndexUnchecked } from './math'
import { fillColumn, resolveSurfaceProfile } from './surface-resolver'
import {
  columnStateIndex,
  isLakeShoreColumn,
  readBiomeColumn,
  readNumber,
  readTerrainChannelValues,
  terrainSampleIndex,
} from './generator-pipeline-model'

const resolveStoneFlags = (
  graniteNoiseVal: number,
  dioriteNoiseVal: number,
  andesiteNoiseVal: number,
): Readonly<{
  readonly graniteFlag: boolean
  readonly dioriteFlag: boolean
  readonly andesiteFlag: boolean
}> => {
  const graniteFlag = graniteNoiseVal > VARIANT_THRESHOLD
  const dioriteFlag = !graniteFlag && dioriteNoiseVal > VARIANT_THRESHOLD
  const andesiteFlag = !graniteFlag && !dioriteFlag && andesiteNoiseVal > VARIANT_THRESHOLD
  return { graniteFlag, dioriteFlag, andesiteFlag }
}

const writeTreeColumnContext = (
  treeColumnContextCache: ColumnStateBuildArgs['treeColumnContextCache'],
  wx: number,
  wz: number,
  columnState: ColumnState,
  surfaceBlock: number,
  blockIndices: ColumnStateBuildArgs['blockIndices'],
): void => {
  MutableHashMap.set(treeColumnContextCache, createTreeColumnKey(wx, wz), {
    biome: columnState.biome,
    props: columnState.props,
    surfaceY: columnState.surfaceY,
    hasLakeBasin: Option.isSome(columnState.lakeBasinY),
    supportsTree: supportsTreeAtSurface(surfaceBlock, columnState.biome, blockIndices),
  })
}

export const buildColumnStates = ({
  blocks,
  baseWorldX,
  baseWorldZ,
  biomeColumns,
  terrainChannels,
  initialSurfaceYs,
  lakeNoiseVals,
  graniteNoiseVals,
  dioriteNoiseVals,
  andesiteNoiseVals,
  treeColumnContextCache,
  blockIndices,
  terrainLevels = DEFAULT_TERRAIN_LEVELS,
}: ColumnStateBuildArgs): ReadonlyArray<ColumnState> => {
  const columnStates: ColumnState[] = []
  columnStates.length = CHUNK_SIZE * CHUNK_SIZE

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const columnIndex = columnStateIndex(lx, lz)
      const terrainIndex = terrainSampleIndex(lx, lz)
      const wx = baseWorldX + lx
      const wz = baseWorldZ + lz
      const { biome, props } = readBiomeColumn(biomeColumns, columnIndex)
      const initialSurfaceY = readNumber(initialSurfaceYs, columnIndex)
      const lakeNoiseVal = biome !== 'OCEAN' ? readNumber(lakeNoiseVals, columnIndex) : 0
      const lakeBasinY = computeLakeBasin(biome, lakeNoiseVal, initialSurfaceY, terrainLevels)
      const surfaceY = resolveSurfaceY(biome, initialSurfaceY, lakeBasinY)
      const terrainValues = readTerrainChannelValues(terrainChannels, terrainIndex)
      const ruggedness = computeRuggedness(
        terrainValues.erosion,
        terrainValues.jaggedness,
        terrainValues.continentalness,
        terrainValues.pv,
      )
      const stoneFlags = resolveStoneFlags(
        readNumber(graniteNoiseVals, columnIndex),
        readNumber(dioriteNoiseVals, columnIndex),
        readNumber(andesiteNoiseVals, columnIndex),
      )
      const surfaceProfile = resolveSurfaceProfile({
        biome,
        defaultSurfaceBlockIndex: blockTypeToIndex(props.surfaceBlock),
        defaultSubSurfaceBlockIndex: blockTypeToIndex(props.subSurfaceBlock),
        surfaceY,
        ruggedness,
        hasLakeBasin: Option.isSome(lakeBasinY),
        isShore: isLakeShoreColumn(lakeBasinY, lakeNoiseVal, surfaceY, terrainLevels),
        sandBlockIndex: blockIndices.sandBlockIndex,
        gravelBlockIndex: blockIndices.gravelBlockIndex,
        stoneBlockIndex: blockIndices.stoneBlockIndex,
        terrainLevels,
      })

      fillColumn(blocks, lx, lz, wx, wz, surfaceY, {
        ...surfaceProfile,
        stoneBlockIndex: blockIndices.stoneBlockIndex,
        bedrockBlockIndex: blockIndices.bedrockBlockIndex,
        deepslateBlockIndex: blockIndices.deepslateBlockIndex,
        graniteBlockIndex: blockIndices.graniteBlockIndex,
        dioriteBlockIndex: blockIndices.dioriteBlockIndex,
        andesiteBlockIndex: blockIndices.andesiteBlockIndex,
        ...stoneFlags,
      })

      fillWaterForColumn(
        blocks,
        lx,
        lz,
        biome,
        surfaceY,
        lakeBasinY,
        blockIndices.waterBlockIndex,
        blockIndices.iceBlockIndex,
        shouldFreezeWaterSurface(biome, props.temperature),
        terrainLevels,
      )

      const columnState: ColumnState = { biome, props, surfaceY, lakeBasinY, ruggedness }
      /* c8 ignore next */
      const surfaceBlock = blocks[chunkBlockIndexUnchecked(lx, surfaceY, lz)] ?? blockIndices.airBlockIndex
      writeTreeColumnContext(treeColumnContextCache, wx, wz, columnState, surfaceBlock, blockIndices)
      columnStates[columnIndex] = columnState
    }
  }

  return columnStates
}
