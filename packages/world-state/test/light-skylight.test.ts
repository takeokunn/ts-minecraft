import { describe, it, expect } from 'vitest'
import { Array as Arr } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex, blockIndexUnsafe } from '@ts-minecraft/kernel'
import {
  LIGHT_LEVEL_MAX,
  createLightBuffer,
  getLightAt,
  computeSkyLight,
} from '../domain/light'

const makeAirBlocks = (): Uint8Array =>
  new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)

const placeBlock = (blocks: Uint8Array, x: number, y: number, z: number, type: string): void => {
  blocks[blockIndexUnsafe(x, y, z)] = blockTypeToIndex(type as Parameters<typeof blockTypeToIndex>[0])
}

describe('computeSkyLight', () => {
  it('all-AIR chunk: every voxel in every column receives level 15', () => {
    const blocks = makeAirBlocks()
    const lightGrid = createLightBuffer()
    computeSkyLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 0, CHUNK_HEIGHT - 1, 0)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 0, 0, 0)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 15, 0, 15)).toBe(LIGHT_LEVEL_MAX)
  })

  it('single STONE at y=128 in column (8,z=8): above is lit, stone itself is 0', () => {
    const blocks = makeAirBlocks()
    placeBlock(blocks, 8, 128, 8, 'STONE')
    const lightGrid = createLightBuffer()
    computeSkyLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 8, 255, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 8, 129, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
    expect(getLightAt(lightGrid, 8, 127, 8)).toBeGreaterThan(0)
    expect(getLightAt(lightGrid, 8, 127, 8)).toBeLessThanOrEqual(LIGHT_LEVEL_MAX - 1)
  })

  it('full stone column spanning all y in (8,z=8): below-stone cells receive 0 sky light', () => {
    const blocks = makeAirBlocks()
    Arr.forEach(Arr.makeBy(CHUNK_HEIGHT, (y) => y), (y) => placeBlock(blocks, 8, y, 8, 'STONE'))
    const lightGrid = createLightBuffer()
    computeSkyLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 8, 255, 8)).toBe(0)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
    expect(getLightAt(lightGrid, 8, 0, 8)).toBe(0)
    expect(getLightAt(lightGrid, 9, 255, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 9, 0, 8)).toBe(LIGHT_LEVEL_MAX)
  })

  it('adjacent column is unaffected by a stone block in a different column', () => {
    const blocks = makeAirBlocks()
    placeBlock(blocks, 8, 128, 8, 'STONE')
    const lightGrid = createLightBuffer()
    computeSkyLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 9, 255, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 9, 128, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 9, 0, 8)).toBe(LIGHT_LEVEL_MAX)
  })

  it('all-STONE chunk: all sky light stays 0', () => {
    const blocks = makeAirBlocks()
    blocks.fill(blockTypeToIndex('STONE'))
    const lightGrid = createLightBuffer()
    computeSkyLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 0, 255, 0)).toBe(0)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
    expect(getLightAt(lightGrid, 15, 0, 15)).toBe(0)
  })

  it('computeSkyLight zeroes the grid before computing (stale buffer is reset)', () => {
    const blocks = makeAirBlocks()
    blocks.fill(blockTypeToIndex('STONE'))
    const lightGrid = createLightBuffer()
    lightGrid.fill(0xff)
    computeSkyLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 0, 0, 0)).toBe(0)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
  })
})
