import { Option } from 'effect'
import { blockTypeToIndex, CHUNK_SIZE } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import type { BiomeProperties, BiomeType } from '../domain/biome'
import type { ColumnState } from '../domain/terrain/generator-types'
import {
  shouldPlaceCactus,
  shouldPlaceGroundPlant,
  shouldPlaceLilyPad,
  shouldPlaceMushroom,
  shouldPlaceSugarCane,
} from '../domain/terrain/plant-placer'
import { chunkBlockIndexUnchecked } from '../domain/terrain/math'

export const AIR = blockTypeToIndex('AIR')
export const SUGAR_CANE = blockTypeToIndex('SUGAR_CANE')
export const CACTUS = blockTypeToIndex('CACTUS')
export const DANDELION = blockTypeToIndex('DANDELION')
export const POPPY = blockTypeToIndex('POPPY')
export const TALL_GRASS = blockTypeToIndex('TALL_GRASS')
export const FERN = blockTypeToIndex('FERN')
export const LILY_PAD = blockTypeToIndex('LILY_PAD')
export const BROWN_MUSHROOM = blockTypeToIndex('BROWN_MUSHROOM')
export const RED_MUSHROOM = blockTypeToIndex('RED_MUSHROOM')

export const GROUND_PLANT_BLOCKS = new Set([DANDELION, POPPY, TALL_GRASS, FERN])
export const MUSHROOM_BLOCKS = new Set([BROWN_MUSHROOM, RED_MUSHROOM])
export const SURFACE_Y = 12

const MINIMAL_PROPS: BiomeProperties = {
  surfaceBlock: 'GRASS',
  subSurfaceBlock: 'DIRT',
  treeDensity: 0,
  temperature: 0.5,
  humidity: 0.5,
}

export const makeColumnStates = (
  biome: BiomeType,
  surfaceY = SURFACE_Y,
): ReadonlyArray<ColumnState> =>
  Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => ({
    biome,
    props: MINIMAL_PROPS,
    surfaceY,
    lakeBasinY: Option.none(),
    ruggedness: 0,
  }))

export const setBlock = (
  blocks: Uint8Array,
  lx: number,
  y: number,
  lz: number,
  blockType: BlockType,
): void => {
  blocks[chunkBlockIndexUnchecked(lx, y, lz)] = blockTypeToIndex(blockType)
}

export const blockAt = (blocks: Uint8Array, lx: number, y: number, lz: number): number =>
  blocks[chunkBlockIndexUnchecked(lx, y, lz)] ?? AIR

type Candidate = Readonly<{ lx: number; lz: number }>

const findCandidate = (
  matches: (lx: number, lz: number) => boolean,
  errorMessage: string,
): Candidate => {
  for (let lx = 1; lx < CHUNK_SIZE - 1; lx++) {
    for (let lz = 1; lz < CHUNK_SIZE - 1; lz++) {
      if (matches(lx, lz)) return { lx, lz }
    }
  }
  throw new Error(errorMessage)
}

export const findSugarCaneCandidate = (biome: BiomeType = 'BEACH'): Candidate =>
  findCandidate(
    (lx, lz) => shouldPlaceSugarCane(biome, SURFACE_Y, lx, lz),
    'expected deterministic sugar cane candidate in chunk',
  )

export const findCactusCandidate = (): Candidate =>
  findCandidate(
    (lx, lz) => shouldPlaceCactus('DESERT', SURFACE_Y, lx, lz),
    'expected deterministic cactus candidate in chunk',
  )

export const findGroundPlantCandidate = (biome: BiomeType = 'PLAINS'): Candidate =>
  findCandidate(
    (lx, lz) => shouldPlaceGroundPlant(biome, SURFACE_Y, lx, lz),
    'expected deterministic ground plant candidate in chunk',
  )

export const findLilyPadCandidate = (biome: BiomeType = 'SWAMP'): Candidate =>
  findCandidate(
    (lx, lz) => shouldPlaceLilyPad(biome, SURFACE_Y, lx, lz),
    'expected deterministic lily pad candidate in chunk',
  )

export const findMushroomCandidate = (biome: BiomeType = 'FOREST'): Candidate =>
  findCandidate(
    (lx, lz) =>
      shouldPlaceMushroom(biome, SURFACE_Y, lx, lz)
      && !shouldPlaceGroundPlant(biome, SURFACE_Y, lx, lz),
    'expected deterministic mushroom candidate in chunk',
  )
