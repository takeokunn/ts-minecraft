import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import {
  RAVINE_CENTER,
  RAVINE_HALF_WIDTH,
  RAVINE_MAX_DEPTH,
  carveRavines,
} from '../domain/terrain/ravine-carver'
import { chunkBlockIndexUnchecked } from '../domain/terrain/math'
import type { ColumnState } from '../domain/terrain/generator-types'

const AIR = 0
const STONE = 2
const LAVA = 9
const BEDROCK = 8
const WATER = 7

const makeColumnStates = (biome: ColumnState['biome'], surfaceY: number): ColumnState[] =>
  Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => ({
    biome,
    props: {} as never,
    surfaceY,
    lakeBasinY: Option.none(),
    ruggedness: 0,
  }))

const makeStoneChunk = (surfaceY: number): Uint8Array => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      blocks[chunkBlockIndexUnchecked(lx, 0, lz)] = BEDROCK
      for (let y = 1; y <= surfaceY; y++) blocks[chunkBlockIndexUnchecked(lx, y, lz)] = STONE
    }
  }
  return blocks
}

const noiseWithBandColumn = (bandLx: number, bandLz: number): number[] =>
  Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, (_, i) =>
    i === bandLx * CHUNK_SIZE + bandLz ? RAVINE_CENTER : RAVINE_CENTER + 0.4,
  )

describe('ravine carver', () => {
  it('carves a full-depth shaft at the band center', () => {
    const surfaceY = 70
    const blocks = makeStoneChunk(surfaceY)
    const carved = carveRavines(blocks, noiseWithBandColumn(4, 7), makeColumnStates('PLAINS', surfaceY), AIR, LAVA, BEDROCK, WATER)
    expect(carved).toBe(1)
    expect(blocks[chunkBlockIndexUnchecked(4, surfaceY, 7)]).toBe(AIR)
    expect(blocks[chunkBlockIndexUnchecked(4, surfaceY - RAVINE_MAX_DEPTH + 1, 7)]).toBe(AIR)
    // Below the floor the stone remains.
    expect(blocks[chunkBlockIndexUnchecked(4, surfaceY - RAVINE_MAX_DEPTH - 1, 7)]).toBe(STONE)
    // Neighbouring columns untouched.
    expect(blocks[chunkBlockIndexUnchecked(5, surfaceY, 7)]).toBe(STONE)
  })

  it('exposes a lava bed when the cut reaches the lava table', () => {
    const surfaceY = 40 // floor = 40 - 28 = 12 ≤ 16 → lava
    const blocks = makeStoneChunk(surfaceY)
    carveRavines(blocks, noiseWithBandColumn(2, 2), makeColumnStates('PLAINS', surfaceY), AIR, LAVA, BEDROCK, WATER)
    expect(blocks[chunkBlockIndexUnchecked(2, surfaceY - RAVINE_MAX_DEPTH, 2)]).toBe(LAVA)
  })

  it('never slices water-body beds and never breaks bedrock', () => {
    const surfaceY = 70
    const oceanBlocks = makeStoneChunk(surfaceY)
    expect(carveRavines(oceanBlocks, noiseWithBandColumn(4, 7), makeColumnStates('OCEAN', surfaceY), AIR, LAVA, BEDROCK, WATER)).toBe(0)

    const lowBlocks = makeStoneChunk(20)
    carveRavines(lowBlocks, noiseWithBandColumn(3, 3), makeColumnStates('PLAINS', 20), AIR, LAVA, BEDROCK, WATER)
    expect(lowBlocks[chunkBlockIndexUnchecked(3, 0, 3)]).toBe(BEDROCK)
  })

  it('keeps lake beds intact: a submerged column on the band is never carved', () => {
    // Regression (hollow-lake black void): ravines skipped only OCEAN/RIVER biomes,
    // so a PLAINS lake column got its bed carved from under its water.
    const bedY = 60
    const blocks = makeStoneChunk(bedY)
    // Lake water sits directly above the column's surface.
    for (let y = bedY + 1; y <= 63; y++) blocks[chunkBlockIndexUnchecked(4, y, 7)] = WATER
    const carved = carveRavines(blocks, noiseWithBandColumn(4, 7), makeColumnStates('PLAINS', bedY), AIR, LAVA, BEDROCK, WATER)
    expect(carved).toBe(0)
    expect(blocks[chunkBlockIndexUnchecked(4, bedY, 7)]).toBe(STONE)
  })

  it('band edges taper to no carve', () => {
    const surfaceY = 70
    const blocks = makeStoneChunk(surfaceY)
    const edgeNoise = Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, (_, i) =>
      i === 0 ? RAVINE_CENTER + RAVINE_HALF_WIDTH * 0.99 : RAVINE_CENTER + 0.4,
    )
    expect(carveRavines(blocks, edgeNoise, makeColumnStates('PLAINS', surfaceY), AIR, LAVA, BEDROCK, WATER)).toBe(0)
  })
})
