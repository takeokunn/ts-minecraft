import { Array as Arr } from 'effect'
import { blockTypeToIndex, CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/kernel'
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
} from './constants'
import { AIR_BLOCK_INDEX } from './surface-resolver'
import type { ColumnNoiseCoordinates, CaveGridPoint, BlockIndices } from './generator-types'
import type { BiomeType } from '../biome'

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

export const createCaveGridPoints = (baseWorldX: number, baseWorldZ: number): ReadonlyArray<CaveGridPoint> => {
  const caveSX = Math.floor(CHUNK_SIZE / CAVE_SAMPLE_STRIDE) + 1
  const caveSZ = Math.floor(CHUNK_SIZE / CAVE_SAMPLE_STRIDE) + 1
  const caveSY = Math.floor(CHUNK_HEIGHT / CAVE_SAMPLE_STRIDE) + 1

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
