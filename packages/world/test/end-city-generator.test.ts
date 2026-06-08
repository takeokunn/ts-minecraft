import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Option } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import {
  END_SHIP_ELYTRA_PLACEHOLDER,
  buildEndProgram,
  buildTerrainLayer,
  generateEndCity,
  shouldGenerateEndCity,
} from '@ts-minecraft/world'
import type { ChunkFactory } from '../domain/terrain/generator-types'

const CITY_COORD = { x: -5, z: -1 }
const MAIN_COORD = { x: 0, z: 0 }
const PURPUR_BLOCK = blockTypeToIndex('PURPUR_BLOCK')
const END_STONE_BRICKS = blockTypeToIndex('END_STONE_BRICKS')
const END_ROD = blockTypeToIndex('END_ROD')
const AIR = blockTypeToIndex('AIR')
const END_PORTAL = blockTypeToIndex('END_PORTAL')

const mockChunkService: ChunkFactory = {
  createChunk: (coord) => Effect.succeed({
    coord,
    blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
    fluid: Option.some(new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)),
  }),
}

const blockAt = (blocks: Uint8Array, lx: number, y: number, lz: number): number =>
  blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE]!

const countBlock = (blocks: Uint8Array, block: number): number => {
  let count = 0
  for (const value of blocks) if (value === block) count++
  return count
}

const buildCityChunk = (coord = CITY_COORD) =>
  Effect.runSync(generateEndCity(mockChunkService, coord))

const buildIntegratedEndChunk = (coord = CITY_COORD) =>
  Effect.runSync(buildEndProgram(coord).pipe(Effect.provide(buildTerrainLayer(0))))

describe('end city generator', () => {
  it('generates End Cities on deterministic outer-island chunks', () => {
    expect(shouldGenerateEndCity(CITY_COORD)).toBe(true)
    const chunk = buildCityChunk()
    expect(countBlock(chunk.blocks, PURPUR_BLOCK)).toBeGreaterThan(0)
  })

  it('does not generate End Cities on the main island', () => {
    expect(shouldGenerateEndCity(MAIN_COORD)).toBe(false)
    const chunk = buildIntegratedEndChunk(MAIN_COORD)
    expect(countBlock(chunk.blocks, PURPUR_BLOCK)).toBe(0)
    expect(blockAt(chunk.blocks, 8, 66, 8)).toBe(AIR)
    expect(blockAt(chunk.blocks, 0, 64, 0)).toBe(END_PORTAL)
  })

  it('uses End City and End Ship structure block composition', () => {
    const chunk = buildCityChunk()
    expect(countBlock(chunk.blocks, PURPUR_BLOCK)).toBeGreaterThan(60)
    expect(countBlock(chunk.blocks, END_STONE_BRICKS)).toBeGreaterThan(10)
    expect(countBlock(chunk.blocks, END_ROD)).toBeGreaterThan(0)
  })

  it('places the Elytra placeholder inside the End Ship', () => {
    const chunk = buildCityChunk()
    expect(blockAt(chunk.blocks, 9, 76, 8)).toBe(END_SHIP_ELYTRA_PLACEHOLDER)
  })

  it('integrates End City generation into the End terrain program', () => {
    const chunk = buildIntegratedEndChunk()
    expect(countBlock(chunk.blocks, PURPUR_BLOCK)).toBeGreaterThan(0)
    expect(blockAt(chunk.blocks, 9, 76, 8)).toBe(END_SHIP_ELYTRA_PLACEHOLDER)
  })
})
