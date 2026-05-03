import { describe, it, expect } from 'vitest'
import { Array as Arr } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex, blockIndexUnsafe } from '@ts-minecraft/kernel'
import {
  createLightBuffer,
  getLightAt,
  computeBlockLight,
} from '../domain/light'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeAirBlocks = (): Uint8Array =>
  new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)

const placeBlock = (blocks: Uint8Array, x: number, y: number, z: number, type: string): void => {
  blocks[blockIndexUnsafe(x, y, z)] = blockTypeToIndex(type as Parameters<typeof blockTypeToIndex>[0])
}

// ---------------------------------------------------------------------------
// computeBlockLight
// ---------------------------------------------------------------------------

describe('computeBlockLight', () => {
  it('all-AIR chunk with no emissive blocks: all light stays 0', () => {
    const blocks = makeAirBlocks()
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 0, 0, 0)).toBe(0)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
    expect(getLightAt(lightGrid, 15, 255, 15)).toBe(0)
  })

  it('LAVA at (8,100,8) emits level 15 at its own position', () => {
    const blocks = makeAirBlocks()
    placeBlock(blocks, 8, 100, 8, 'LAVA')
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 8, 100, 8)).toBe(15)
  })

  it('LAVA light propagates: 1 step away gets level 14', () => {
    const blocks = makeAirBlocks()
    placeBlock(blocks, 8, 100, 8, 'LAVA')
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 9, 100, 8)).toBe(14)
    expect(getLightAt(lightGrid, 7, 100, 8)).toBe(14)
    expect(getLightAt(lightGrid, 8, 101, 8)).toBe(14)
    expect(getLightAt(lightGrid, 8, 99, 8)).toBe(14)
    expect(getLightAt(lightGrid, 8, 100, 9)).toBe(14)
    expect(getLightAt(lightGrid, 8, 100, 7)).toBe(14)
  })

  it('LAVA light attenuates with distance: level decreases by 1 per step', () => {
    const blocks = makeAirBlocks()
    placeBlock(blocks, 8, 100, 8, 'LAVA')
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 8, 100, 8)).toBe(15)
    expect(getLightAt(lightGrid, 9, 100, 8)).toBe(14)
    expect(getLightAt(lightGrid, 10, 100, 8)).toBe(13)
    expect(getLightAt(lightGrid, 11, 100, 8)).toBe(12)
    expect(getLightAt(lightGrid, 12, 100, 8)).toBe(11)
  })

  it('light does not enter an opaque block (STONE receives 0)', () => {
    const blocks = makeAirBlocks()
    placeBlock(blocks, 8, 100, 8, 'LAVA')
    placeBlock(blocks, 9, 100, 8, 'STONE')
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 9, 100, 8)).toBe(0)
  })

  it('light propagates around a single STONE block to reach the far side', () => {
    const blocks = makeAirBlocks()
    placeBlock(blocks, 8, 100, 8, 'LAVA')
    placeBlock(blocks, 9, 100, 8, 'STONE')
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 10, 100, 8)).toBeGreaterThan(0)
  })

  it('STONE wall spanning the full x-range blocks all light to the other side', () => {
    const blocks = makeAirBlocks()
    placeBlock(blocks, 2, 100, 8, 'LAVA')
    Arr.forEach(Arr.makeBy(CHUNK_SIZE, z => z), (z) =>
      Arr.forEach(Arr.makeBy(CHUNK_HEIGHT, y => y), (y) => {
        placeBlock(blocks, 8, y, z, 'STONE')
      })
    )
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 8, 100, 8)).toBe(0)
    expect(getLightAt(lightGrid, 9, 100, 8)).toBe(0)
    expect(getLightAt(lightGrid, 14, 100, 8)).toBe(0)
  })

  it('REDSTONE_ORE emits level 9 at its own position', () => {
    const blocks = makeAirBlocks()
    placeBlock(blocks, 4, 64, 4, 'REDSTONE_ORE')
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 4, 64, 4)).toBe(9)
  })

  it('computeBlockLight zeroes the grid before computing (stale buffer is reset)', () => {
    const blocks = makeAirBlocks()
    const lightGrid = createLightBuffer()
    lightGrid.fill(0xff)
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 0, 0, 0)).toBe(0)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
  })
})
