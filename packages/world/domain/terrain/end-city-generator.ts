import { Effect } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import type { ChunkCoord } from '@ts-minecraft/core'
import type { Chunk } from '../chunk'
import type { ChunkFactory } from './generator-types'
import { chunkBlockIndexUnchecked, mulberry32, seedFromChunk } from './math'

const OUTER_END_MIN_DISTANCE = 64
const END_CITY_CHANCE = 0.15
const CITY_BASE_Y = 66

const BLOCKS = {
  purpur: blockTypeToIndex('PURPUR_BLOCK'),
  pillar: blockTypeToIndex('PURPUR_PILLAR'),
  slab: blockTypeToIndex('PURPUR_SLAB'),
  stairs: blockTypeToIndex('PURPUR_STAIRS'),
  bricks: blockTypeToIndex('END_STONE_BRICKS'),
  rod: blockTypeToIndex('END_ROD'),
  chest: blockTypeToIndex('ENDER_CHEST'),
  shulker: blockTypeToIndex('SHULKER_BOX'),
} as const

export const END_SHIP_ELYTRA_PLACEHOLDER = BLOCKS.chest
export const END_SHIP_BREWING_STAND_PLACEHOLDER = BLOCKS.rod
export const END_CITY_OUTER_MIN_DISTANCE = OUTER_END_MIN_DISTANCE

const chunkCenterDistance = (coord: ChunkCoord): number => {
  const cx = coord.x * CHUNK_SIZE + CHUNK_SIZE / 2
  const cz = coord.z * CHUNK_SIZE + CHUNK_SIZE / 2
  return Math.hypot(cx, cz)
}

export const shouldGenerateEndCity = (coord: ChunkCoord): boolean => {
  if (chunkCenterDistance(coord) <= OUTER_END_MIN_DISTANCE) return false
  const seed = seedFromChunk(coord.x, coord.z, 0x45d, 0xc17)
  return mulberry32(seed).value < END_CITY_CHANCE
}

const setBlock = (blocks: Uint8Array, lx: number, y: number, lz: number, block: number): void => {
  if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return
  blocks[chunkBlockIndexUnchecked(lx, y, lz)] = block
}

const placeTowerStory = (blocks: Uint8Array, ox: number, y: number, oz: number): void => {
  for (let dx = 0; dx < 5; dx++) {
    for (let dz = 0; dz < 5; dz++) {
      const edge = dx === 0 || dx === 4 || dz === 0 || dz === 4
      for (let dy = 0; dy < 3; dy++) {
        const opening = dy === 1 && edge && (dx === 2 || dz === 2)
        if (edge && !opening) setBlock(blocks, ox + dx, y + dy, oz + dz, BLOCKS.purpur)
      }
      setBlock(blocks, ox + dx, y, oz + dz, BLOCKS.bricks)
      setBlock(blocks, ox + dx, y + 3, oz + dz, edge ? BLOCKS.slab : BLOCKS.purpur)
    }
  }
  setBlock(blocks, ox, y, oz, BLOCKS.pillar)
  setBlock(blocks, ox + 4, y, oz, BLOCKS.pillar)
  setBlock(blocks, ox, y, oz + 4, BLOCKS.pillar)
  setBlock(blocks, ox + 4, y, oz + 4, BLOCKS.pillar)
}

const placeTower = (blocks: Uint8Array, ox: number, oz: number, stories: number): void => {
  for (let story = 0; story < stories; story++) {
    placeTowerStory(blocks, ox, CITY_BASE_Y + story * 4, oz)
  }
  const topY = CITY_BASE_Y + stories * 4
  setBlock(blocks, ox + 2, topY, oz + 2, BLOCKS.rod)
}

const placeBridge = (blocks: Uint8Array, x0: number, z0: number, x1: number, z1: number): void => {
  const horizontal = z0 === z1
  const min = Math.min(horizontal ? x0 : z0, horizontal ? x1 : z1)
  const max = Math.max(horizontal ? x0 : z0, horizontal ? x1 : z1)
  for (let i = min; i <= max; i++) {
    for (let w = -1; w <= 1; w++) {
      const lx = horizontal ? i : x0 + w
      const lz = horizontal ? z0 + w : i
      setBlock(blocks, lx, CITY_BASE_Y + 5, lz, BLOCKS.pillar)
      setBlock(blocks, lx, CITY_BASE_Y + 6, lz, BLOCKS.slab)
    }
  }
}

const placeEndShip = (blocks: Uint8Array): void => {
  for (let x = 4; x <= 13; x++) {
    const width = x < 6 || x > 11 ? 1 : 2
    for (let z = 8 - width; z <= 8 + width; z++) {
      setBlock(blocks, x, CITY_BASE_Y + 8, z, BLOCKS.bricks)
      setBlock(blocks, x, CITY_BASE_Y + 9, z, BLOCKS.purpur)
    }
  }
  for (let x = 6; x <= 11; x++) {
    setBlock(blocks, x, CITY_BASE_Y + 10, 6, BLOCKS.purpur)
    setBlock(blocks, x, CITY_BASE_Y + 10, 10, BLOCKS.purpur)
  }
  setBlock(blocks, 9, CITY_BASE_Y + 10, 8, END_SHIP_ELYTRA_PLACEHOLDER)
  setBlock(blocks, 7, CITY_BASE_Y + 10, 8, END_SHIP_BREWING_STAND_PLACEHOLDER)
  setBlock(blocks, 6, CITY_BASE_Y + 10, 6, BLOCKS.shulker)
  setBlock(blocks, 11, CITY_BASE_Y + 10, 10, BLOCKS.shulker)
  setBlock(blocks, 13, CITY_BASE_Y + 10, 8, BLOCKS.rod)
  setBlock(blocks, 3, CITY_BASE_Y + 8, 8, BLOCKS.stairs)
}

const placeCity = (blocks: Uint8Array, stories: number): void => {
  placeTower(blocks, 1, 1, stories)
  placeTower(blocks, 10, 1, Math.max(3, stories - 1))
  placeTower(blocks, 1, 10, 3)
  placeBridge(blocks, 5, 3, 10, 3)
  placeBridge(blocks, 3, 5, 3, 10)
  placeBridge(blocks, 8, 8, 12, 8)
  placeEndShip(blocks)
}

export const applyEndCityStructure = (blocks: Uint8Array, coord: ChunkCoord): void => {
  if (!shouldGenerateEndCity(coord)) return
  const seed = seedFromChunk(coord.x, coord.z, 0x5a17, 0xe1a7)
  const stories = 3 + Math.floor(mulberry32(seed).value * 3)
  placeCity(blocks, stories)
}

export const generateEndCity = (
  chunkService: ChunkFactory,
  coord: ChunkCoord,
): Effect.Effect<Chunk, never> =>
  Effect.gen(function* () {
    const chunk = yield* chunkService.createChunk(coord)
    applyEndCityStructure(chunk.blocks, coord)
    return chunk
  })
