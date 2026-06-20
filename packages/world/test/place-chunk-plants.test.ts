import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { placeChunkPlants } from '../domain/terrain/plant-placer'
import { makeChunkBlockBuffer } from './chunk-buffer-test-utils'
import {
  AIR,
  CACTUS,
  GROUND_PLANT_BLOCKS,
  LILY_PAD,
  MUSHROOM_BLOCKS,
  SUGAR_CANE,
  SURFACE_Y,
  blockAt,
  findCactusCandidate,
  findGroundPlantCandidate,
  findLilyPadCandidate,
  findMushroomCandidate,
  findSugarCaneCandidate,
  makeColumnStates,
  setBlock,
} from './place-chunk-plants-test-kit'

describe('placeChunkPlants', () => {
  it('places sugar cane above supported shore blocks with adjacent water', () => {
    const blocks = makeChunkBlockBuffer()
    const columnStates = makeColumnStates('BEACH')
    const { lx, lz } = findSugarCaneCandidate()

    setBlock(blocks, lx, SURFACE_Y, lz, 'GRASS')
    setBlock(blocks, lx + 1, SURFACE_Y, lz, 'WATER')

    placeChunkPlants(blocks, 0, 0, columnStates)

    expect(blockAt(blocks, lx, SURFACE_Y + 1, lz)).toBe(SUGAR_CANE)
  })

  it('does not place sugar cane without adjacent support-level water', () => {
    const blocks = makeChunkBlockBuffer()
    const columnStates = makeColumnStates('BEACH')
    const { lx, lz } = findSugarCaneCandidate()

    setBlock(blocks, lx, SURFACE_Y, lz, 'SAND')

    placeChunkPlants(blocks, 0, 0, columnStates)

    expect(blockAt(blocks, lx, SURFACE_Y + 1, lz)).toBe(AIR)
  })

  it('places cactus on desert sand with empty horizontal sides', () => {
    const blocks = makeChunkBlockBuffer()
    const columnStates = makeColumnStates('DESERT')
    const { lx, lz } = findCactusCandidate()

    setBlock(blocks, lx, SURFACE_Y, lz, 'SAND')

    placeChunkPlants(blocks, 0, 0, columnStates)

    expect(blockAt(blocks, lx, SURFACE_Y + 1, lz)).toBe(CACTUS)
  })

  it('does not place cactus when a horizontal side is blocked', () => {
    const blocks = makeChunkBlockBuffer()
    const columnStates = makeColumnStates('DESERT')
    const { lx, lz } = findCactusCandidate()

    setBlock(blocks, lx, SURFACE_Y, lz, 'SAND')
    setBlock(blocks, lx + 1, SURFACE_Y + 1, lz, 'STONE')

    placeChunkPlants(blocks, 0, 0, columnStates)

    expect(blockAt(blocks, lx, SURFACE_Y + 1, lz)).toBe(AIR)
  })

  it('places grass or flowers above supported vegetated biome ground', () => {
    const blocks = makeChunkBlockBuffer()
    const columnStates = makeColumnStates('PLAINS')
    const { lx, lz } = findGroundPlantCandidate()

    setBlock(blocks, lx, SURFACE_Y, lz, 'GRASS')

    placeChunkPlants(blocks, 0, 0, columnStates)

    expect(GROUND_PLANT_BLOCKS.has(blockAt(blocks, lx, SURFACE_Y + 1, lz))).toBe(true)
  })

  it('does not place ground plants on unsupported terrain', () => {
    const blocks = makeChunkBlockBuffer()
    const columnStates = makeColumnStates('PLAINS')
    const { lx, lz } = findGroundPlantCandidate()

    setBlock(blocks, lx, SURFACE_Y, lz, 'SAND')

    placeChunkPlants(blocks, 0, 0, columnStates)

    expect(blockAt(blocks, lx, SURFACE_Y + 1, lz)).toBe(AIR)
  })

  it('places lily pads above supported swamp water', () => {
    const blocks = makeChunkBlockBuffer()
    const columnStates = makeColumnStates('SWAMP')
    const { lx, lz } = findLilyPadCandidate()

    setBlock(blocks, lx, SURFACE_Y, lz, 'WATER')

    placeChunkPlants(blocks, 0, 0, columnStates)

    expect(blockAt(blocks, lx, SURFACE_Y + 1, lz)).toBe(LILY_PAD)
  })

  it('does not place lily pads without water support', () => {
    const blocks = makeChunkBlockBuffer()
    const columnStates = makeColumnStates('SWAMP')
    const { lx, lz } = findLilyPadCandidate()

    setBlock(blocks, lx, SURFACE_Y, lz, 'SAND')

    placeChunkPlants(blocks, 0, 0, columnStates)

    expect(blockAt(blocks, lx, SURFACE_Y + 1, lz)).toBe(AIR)
  })

  it('places mushrooms on shaded forest ground', () => {
    const blocks = makeChunkBlockBuffer()
    const columnStates = makeColumnStates('FOREST')
    const { lx, lz } = findMushroomCandidate()

    setBlock(blocks, lx, SURFACE_Y, lz, 'GRASS')
    setBlock(blocks, lx, SURFACE_Y + 3, lz, 'LEAVES')

    placeChunkPlants(blocks, 0, 0, columnStates)

    expect(MUSHROOM_BLOCKS.has(blockAt(blocks, lx, SURFACE_Y + 1, lz))).toBe(true)
  })

  it('does not place mushrooms on open bright ground', () => {
    const blocks = makeChunkBlockBuffer()
    const columnStates = makeColumnStates('FOREST')
    const { lx, lz } = findMushroomCandidate()

    setBlock(blocks, lx, SURFACE_Y, lz, 'GRASS')

    placeChunkPlants(blocks, 0, 0, columnStates)

    expect(blockAt(blocks, lx, SURFACE_Y + 1, lz)).toBe(AIR)
  })

  it('uses deterministic placement for identical chunk inputs', () => {
    const first = makeChunkBlockBuffer()
    const second = makeChunkBlockBuffer()
    const columnStates = makeColumnStates('BEACH')
    const { lx, lz } = findSugarCaneCandidate()

    setBlock(first, lx, SURFACE_Y, lz, 'SAND')
    setBlock(first, lx + 1, SURFACE_Y, lz, 'WATER')
    setBlock(second, lx, SURFACE_Y, lz, 'SAND')
    setBlock(second, lx + 1, SURFACE_Y, lz, 'WATER')

    placeChunkPlants(first, 0, 0, columnStates)
    placeChunkPlants(second, 0, 0, columnStates)

    expect([...second]).toEqual([...first])
  })
})
