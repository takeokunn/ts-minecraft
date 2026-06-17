import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import {
  createLightBuffer,
  getLightAt,
  computeBlockLight,
} from '../domain/light'
import { makeChunkBlocks, setChunkBlock } from './chunk-block-test-utils'

// ---------------------------------------------------------------------------
// computeBlockLight
// ---------------------------------------------------------------------------

describe('computeBlockLight', () => {
  it('all-AIR chunk with no emissive blocks: all light stays 0', () => {
    const blocks = makeChunkBlocks()
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 0, 0, 0)).toBe(0)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
    expect(getLightAt(lightGrid, 15, 255, 15)).toBe(0)
  })

  it('LAVA at (8,100,8) emits level 15 at its own position', () => {
    const blocks = makeChunkBlocks()
    setChunkBlock(blocks, { lx: 8, y: 100, lz: 8, blockType: 'LAVA' })
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 8, 100, 8)).toBe(15)
  })

  it('LAVA light propagates: 1 step away gets level 14', () => {
    const blocks = makeChunkBlocks()
    setChunkBlock(blocks, { lx: 8, y: 100, lz: 8, blockType: 'LAVA' })
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
    const blocks = makeChunkBlocks()
    setChunkBlock(blocks, { lx: 8, y: 100, lz: 8, blockType: 'LAVA' })
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 8, 100, 8)).toBe(15)
    expect(getLightAt(lightGrid, 9, 100, 8)).toBe(14)
    expect(getLightAt(lightGrid, 10, 100, 8)).toBe(13)
    expect(getLightAt(lightGrid, 11, 100, 8)).toBe(12)
    expect(getLightAt(lightGrid, 12, 100, 8)).toBe(11)
  })

  it('light does not enter an opaque block (STONE receives 0)', () => {
    const blocks = makeChunkBlocks()
    setChunkBlock(blocks, { lx: 8, y: 100, lz: 8, blockType: 'LAVA' })
    setChunkBlock(blocks, { lx: 9, y: 100, lz: 8, blockType: 'STONE' })
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 9, 100, 8)).toBe(0)
  })

  it('light propagates around a single STONE block to reach the far side', () => {
    const blocks = makeChunkBlocks()
    setChunkBlock(blocks, { lx: 8, y: 100, lz: 8, blockType: 'LAVA' })
    setChunkBlock(blocks, { lx: 9, y: 100, lz: 8, blockType: 'STONE' })
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 10, 100, 8)).toBeGreaterThan(0)
  })

  it('STONE wall spanning the full x-range blocks all light to the other side', () => {
    const blocks = makeChunkBlocks()
    setChunkBlock(blocks, { lx: 2, y: 100, lz: 8, blockType: 'LAVA' })
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        setChunkBlock(blocks, { lx: 8, y, lz: z, blockType: 'STONE' })
      }
    }
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 8, 100, 8)).toBe(0)
    expect(getLightAt(lightGrid, 9, 100, 8)).toBe(0)
    expect(getLightAt(lightGrid, 14, 100, 8)).toBe(0)
  })

  it('REDSTONE_ORE emits level 9 at its own position', () => {
    const blocks = makeChunkBlocks()
    setChunkBlock(blocks, { lx: 4, y: 64, lz: 4, blockType: 'REDSTONE_ORE' })
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 4, 64, 4)).toBe(9)
  })

  it('computeBlockLight zeroes the grid before computing (stale buffer is reset)', () => {
    const blocks = makeChunkBlocks()
    const lightGrid = createLightBuffer()
    lightGrid.fill(0xff)
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 0, 0, 0)).toBe(0)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
  })
})
