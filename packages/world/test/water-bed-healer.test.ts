import { describe, expect, it } from 'vitest'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { healHollowWaterBeds } from '../domain/terrain/water-bed-healer'
import { chunkBlockIndexUnchecked } from '../domain/terrain/math'

const AIR = blockTypeToIndex('AIR')
const WATER = blockTypeToIndex('WATER')
const ICE = blockTypeToIndex('ICE')
const STONE = blockTypeToIndex('STONE')

const makeBlocks = (): Uint8Array => new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)

const set = (blocks: Uint8Array, lx: number, y: number, lz: number, val: number): void => {
  blocks[chunkBlockIndexUnchecked(lx, y, lz)] = val
}

const get = (blocks: Uint8Array, lx: number, y: number, lz: number): number =>
  blocks[chunkBlockIndexUnchecked(lx, y, lz)]!

describe('healHollowWaterBeds', () => {
  it('floods the air cavity beneath a floating water sheet down to the first solid block', () => {
    // The saved-world black-void signature: water 62-63, AIR 51-61, stone floor 50.
    const blocks = makeBlocks()
    set(blocks, 4, 50, 7, STONE)
    set(blocks, 4, 62, 7, WATER)
    set(blocks, 4, 63, 7, WATER)

    expect(healHollowWaterBeds(blocks, AIR, WATER, ICE)).toBe(true)
    for (let y = 51; y <= 63; y++) {
      expect(get(blocks, 4, y, 7), `y=${y}`).toBe(WATER)
    }
    expect(get(blocks, 4, 50, 7)).toBe(STONE)
    expect(get(blocks, 4, 64, 7)).toBe(AIR)
  })

  it('floods beneath a frozen (ICE) surface with water, keeping the ice', () => {
    const blocks = makeBlocks()
    set(blocks, 2, 58, 2, STONE)
    set(blocks, 2, 63, 2, ICE)

    expect(healHollowWaterBeds(blocks, AIR, WATER, ICE)).toBe(true)
    expect(get(blocks, 2, 63, 2)).toBe(ICE)
    for (let y = 59; y <= 62; y++) {
      expect(get(blocks, 2, y, 2), `y=${y}`).toBe(WATER)
    }
  })

  it('leaves properly-bedded water and dry caves untouched', () => {
    const blocks = makeBlocks()
    // Healthy lake: solid bed directly under the water column.
    set(blocks, 1, 60, 1, STONE)
    set(blocks, 1, 61, 1, WATER)
    set(blocks, 1, 62, 1, WATER)
    // Dry cave far from any water: AIR between stone — must stay a cave.
    set(blocks, 8, 40, 8, STONE)
    set(blocks, 8, 30, 8, STONE)

    expect(healHollowWaterBeds(blocks, AIR, WATER, ICE)).toBe(false)
    for (let y = 31; y <= 39; y++) {
      expect(get(blocks, 8, y, 8), `cave y=${y}`).toBe(AIR)
    }
  })

  it('handles a cavity that bottoms out at bedrock depth without underflowing', () => {
    const blocks = makeBlocks()
    // Water sheet with nothing but AIR all the way down to y=1.
    set(blocks, 0, 63, 0, WATER)

    expect(healHollowWaterBeds(blocks, AIR, WATER, ICE)).toBe(true)
    expect(get(blocks, 0, 1, 0)).toBe(WATER)
    expect(get(blocks, 0, 0, 0)).toBe(AIR) // y=0 untouched
  })
})
