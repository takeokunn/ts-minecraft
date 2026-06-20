import { CHUNK_SIZE, type BlockType } from '@ts-minecraft/core'

export type LocalColumn = {
  readonly lx: number
  readonly lz: number
}

const HORIZONTAL_OFFSETS: ReadonlyArray<LocalColumn> = [
  { lx: -1, lz: 0 },
  { lx: 1, lz: 0 },
  { lx: 0, lz: -1 },
  { lx: 0, lz: 1 },
]

const MUSHROOM_BLOCK_TYPES = new Set<BlockType>(['BROWN_MUSHROOM', 'RED_MUSHROOM'])

export const MAX_MUSHROOM_PLACEMENT_LIGHT = 12

const isLocalColumnInChunk = (lx: number, lz: number): boolean =>
  lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE

export const localHorizontalNeighbors = (lx: number, lz: number): Array<LocalColumn> =>
  HORIZONTAL_OFFSETS
    .map((offset) => ({ lx: lx + offset.lx, lz: lz + offset.lz }))
    .filter((column) => isLocalColumnInChunk(column.lx, column.lz))

export const isMushroomPlacementLightAllowed = (
  blockType: BlockType,
  lightLevel: number,
): boolean => !MUSHROOM_BLOCK_TYPES.has(blockType) || lightLevel <= MAX_MUSHROOM_PLACEMENT_LIGHT

export const hasRequiredSugarCaneAdjacentWater = (
  blockBelow: BlockType,
  horizontalSupportTypes: ReadonlyArray<BlockType>,
): boolean =>
  blockBelow === 'SUGAR_CANE' ||
  horizontalSupportTypes.some((neighborType) => neighborType === 'WATER')

export const hasClearCactusHorizontalSides = (
  horizontalNeighborTypes: ReadonlyArray<BlockType>,
): boolean => horizontalNeighborTypes.every((neighborType) => neighborType === 'AIR')
