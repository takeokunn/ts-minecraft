import { Array as Arr } from 'effect'
import { blockTypeToIndex, CHUNK_SIZE } from '@ts-minecraft/core'
import {
  LAKE_NOISE_SCALE,
  VARIANT_NOISE_SCALE,
  GRANITE_OFFSET_X,
  GRANITE_OFFSET_Z,
  DIORITE_OFFSET_X,
  DIORITE_OFFSET_Z,
  ANDESITE_OFFSET_X,
  ANDESITE_OFFSET_Z,
  CAVE_NOISE_SCALE,
  CAVE_SAMPLE_STRIDE,
  CAVE_SAMPLE_SY_COUNT,
} from './constants'
import { AIR_BLOCK_INDEX } from './surface-resolver'
import type { ColumnNoiseCoordinates, CaveGridPoint, BlockIndices } from './generator-types'
import type { BiomeType } from '../biome'

const createNumberArray = (length: number): number[] => {
  const values: number[] = []
  values.length = length
  return values
}

export const createTreeColumnKey = (wx: number, wz: number): string => `${wx},${wz}`

export const createColumnNoiseCoordinates = (baseWorldX: number, baseWorldZ: number): ReadonlyArray<ColumnNoiseCoordinates> =>
  Arr.flatMap(Arr.makeBy(CHUNK_SIZE, (lx) => lx), (lx) =>
    Arr.makeBy(CHUNK_SIZE, (lz) => {
      const x = baseWorldX + lx
      const z = baseWorldZ + lz
      return {
        lakeX: x * LAKE_NOISE_SCALE + 5000,
        lakeZ: z * LAKE_NOISE_SCALE + 5000,
        graniteX: x * VARIANT_NOISE_SCALE + GRANITE_OFFSET_X,
        graniteZ: z * VARIANT_NOISE_SCALE + GRANITE_OFFSET_Z,
        dioriteX: x * VARIANT_NOISE_SCALE + DIORITE_OFFSET_X,
        dioriteZ: z * VARIANT_NOISE_SCALE + DIORITE_OFFSET_Z,
        andesiteX: x * VARIANT_NOISE_SCALE + ANDESITE_OFFSET_X,
        andesiteZ: z * VARIANT_NOISE_SCALE + ANDESITE_OFFSET_Z,
      }
    })
  )

export type ColumnNoiseCoordinateArrays = Readonly<{
  readonly lakeXs: ReadonlyArray<number>
  readonly lakeZs: ReadonlyArray<number>
  readonly graniteXs: ReadonlyArray<number>
  readonly graniteZs: ReadonlyArray<number>
  readonly dioriteXs: ReadonlyArray<number>
  readonly dioriteZs: ReadonlyArray<number>
  readonly andesiteXs: ReadonlyArray<number>
  readonly andesiteZs: ReadonlyArray<number>
}>

export const createColumnNoiseCoordinateArrays = (
  baseWorldX: number,
  baseWorldZ: number,
): ColumnNoiseCoordinateArrays => {
  const columnCount = CHUNK_SIZE * CHUNK_SIZE
  const lakeXs = createNumberArray(columnCount)
  const lakeZs = createNumberArray(columnCount)
  const graniteXs = createNumberArray(columnCount)
  const graniteZs = createNumberArray(columnCount)
  const dioriteXs = createNumberArray(columnCount)
  const dioriteZs = createNumberArray(columnCount)
  const andesiteXs = createNumberArray(columnCount)
  const andesiteZs = createNumberArray(columnCount)

  let index = 0
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    const x = baseWorldX + lx
    const lakeX = x * LAKE_NOISE_SCALE + 5000
    const graniteX = x * VARIANT_NOISE_SCALE + GRANITE_OFFSET_X
    const dioriteX = x * VARIANT_NOISE_SCALE + DIORITE_OFFSET_X
    const andesiteX = x * VARIANT_NOISE_SCALE + ANDESITE_OFFSET_X
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const z = baseWorldZ + lz
      lakeXs[index] = lakeX
      lakeZs[index] = z * LAKE_NOISE_SCALE + 5000
      graniteXs[index] = graniteX
      graniteZs[index] = z * VARIANT_NOISE_SCALE + GRANITE_OFFSET_Z
      dioriteXs[index] = dioriteX
      dioriteZs[index] = z * VARIANT_NOISE_SCALE + DIORITE_OFFSET_Z
      andesiteXs[index] = andesiteX
      andesiteZs[index] = z * VARIANT_NOISE_SCALE + ANDESITE_OFFSET_Z
      index++
    }
  }

  return { lakeXs, lakeZs, graniteXs, graniteZs, dioriteXs, dioriteZs, andesiteXs, andesiteZs }
}

export const createCaveGridPoints = (baseWorldX: number, baseWorldZ: number): ReadonlyArray<CaveGridPoint> => {
  const caveSX = Math.floor(CHUNK_SIZE / CAVE_SAMPLE_STRIDE) + 1
  const caveSZ = Math.floor(CHUNK_SIZE / CAVE_SAMPLE_STRIDE) + 1
  const caveSY = CAVE_SAMPLE_SY_COUNT

  return Arr.flatMap(Arr.makeBy(caveSY, (sy) => sy), (sy) =>
    Arr.flatMap(Arr.makeBy(caveSZ, (sz) => sz), (sz) =>
      Arr.makeBy(caveSX, (sx) => ({
        x: (baseWorldX + sx * CAVE_SAMPLE_STRIDE) * CAVE_NOISE_SCALE,
        y: sy * CAVE_SAMPLE_STRIDE * CAVE_NOISE_SCALE,
        z: (baseWorldZ + sz * CAVE_SAMPLE_STRIDE) * CAVE_NOISE_SCALE,
      }))
    )
  )
}

export type CaveGridCoordinateArrays = Readonly<{
  readonly caveXs: ReadonlyArray<number>
  readonly caveYs: ReadonlyArray<number>
  readonly caveZs: ReadonlyArray<number>
}>

export const createCaveGridCoordinateArrays = (
  baseWorldX: number,
  baseWorldZ: number,
): CaveGridCoordinateArrays => {
  const caveSX = Math.floor(CHUNK_SIZE / CAVE_SAMPLE_STRIDE) + 1
  const caveSZ = Math.floor(CHUNK_SIZE / CAVE_SAMPLE_STRIDE) + 1
  const caveSY = CAVE_SAMPLE_SY_COUNT
  const pointCount = caveSX * caveSZ * caveSY
  const caveXs = createNumberArray(pointCount)
  const caveYs = createNumberArray(pointCount)
  const caveZs = createNumberArray(pointCount)

  let index = 0
  for (let sy = 0; sy < caveSY; sy++) {
    const y = sy * CAVE_SAMPLE_STRIDE * CAVE_NOISE_SCALE
    for (let sz = 0; sz < caveSZ; sz++) {
      const z = (baseWorldZ + sz * CAVE_SAMPLE_STRIDE) * CAVE_NOISE_SCALE
      for (let sx = 0; sx < caveSX; sx++) {
        caveXs[index] = (baseWorldX + sx * CAVE_SAMPLE_STRIDE) * CAVE_NOISE_SCALE
        caveYs[index] = y
        caveZs[index] = z
        index++
      }
    }
  }

  return { caveXs, caveYs, caveZs }
}

export const createBlockIndices = (): BlockIndices => ({
  stoneBlockIndex: blockTypeToIndex('STONE'),
  waterBlockIndex: blockTypeToIndex('WATER'),
  lavaBlockIndex: blockTypeToIndex('LAVA'),
  sandBlockIndex: blockTypeToIndex('SAND'),
  gravelBlockIndex: blockTypeToIndex('GRAVEL'),
  bedrockBlockIndex: blockTypeToIndex('BEDROCK'),
  deepslateBlockIndex: blockTypeToIndex('DEEPSLATE'),
  graniteBlockIndex: blockTypeToIndex('GRANITE'),
  dioriteBlockIndex: blockTypeToIndex('DIORITE'),
  andesiteBlockIndex: blockTypeToIndex('ANDESITE'),
  airBlockIndex: AIR_BLOCK_INDEX,
})

export const supportsTreeAtSurface = (
  surfaceBlock: number,
  biome: BiomeType,
  blockIndices: BlockIndices,
): boolean =>
  surfaceBlock !== blockIndices.airBlockIndex
  && surfaceBlock !== blockIndices.waterBlockIndex
  && surfaceBlock !== blockIndices.sandBlockIndex
  && surfaceBlock !== blockIndices.gravelBlockIndex
  && (surfaceBlock !== blockIndices.stoneBlockIndex || biome === 'MOUNTAINS' || biome === 'SNOW')
