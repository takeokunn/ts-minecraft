import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import {
  LIGHT_LEVEL_MAX,
  createLightBuffer,
  getLightAt,
  computeSkyLight,
} from '../domain/light'
import { makeChunkBlocks, setChunkBlock } from './chunk-block-test-utils'

describe('computeSkyLight', () => {
  it('all-AIR chunk: every voxel in every column receives level 15', () => {
    const blocks = makeChunkBlocks()
    const lightGrid = createLightBuffer()
    computeSkyLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 0, CHUNK_HEIGHT - 1, 0)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 0, 0, 0)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 15, 0, 15)).toBe(LIGHT_LEVEL_MAX)
  })

  it('single STONE at y=128 in column (8,z=8): above is lit, stone itself is 0', () => {
    const blocks = makeChunkBlocks()
    setChunkBlock(blocks, { lx: 8, y: 128, lz: 8, blockType: 'STONE' })
    const lightGrid = createLightBuffer()
    computeSkyLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 8, 255, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 8, 129, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
    expect(getLightAt(lightGrid, 8, 127, 8)).toBeGreaterThan(0)
    expect(getLightAt(lightGrid, 8, 127, 8)).toBeLessThanOrEqual(LIGHT_LEVEL_MAX - 1)
  })

  it('full stone column spanning all y in (8,z=8): below-stone cells receive 0 sky light', () => {
    const blocks = makeChunkBlocks()
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      setChunkBlock(blocks, { lx: 8, y, lz: 8, blockType: 'STONE' })
    }
    const lightGrid = createLightBuffer()
    computeSkyLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 8, 255, 8)).toBe(0)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
    expect(getLightAt(lightGrid, 8, 0, 8)).toBe(0)
    expect(getLightAt(lightGrid, 9, 255, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 9, 0, 8)).toBe(LIGHT_LEVEL_MAX)
  })

  it('adjacent column is unaffected by a stone block in a different column', () => {
    const blocks = makeChunkBlocks()
    setChunkBlock(blocks, { lx: 8, y: 128, lz: 8, blockType: 'STONE' })
    const lightGrid = createLightBuffer()
    computeSkyLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 9, 255, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 9, 128, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 9, 0, 8)).toBe(LIGHT_LEVEL_MAX)
  })

  it('all-STONE chunk: all sky light stays 0', () => {
    const blocks = makeChunkBlocks('STONE')
    const lightGrid = createLightBuffer()
    computeSkyLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 0, 255, 0)).toBe(0)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
    expect(getLightAt(lightGrid, 15, 0, 15)).toBe(0)
  })

  it('skylight spreads horizontally under an overhang, attenuating 1 per block', () => {
    // A STONE roof at y=100 over x∈[2,15] for ALL z, leaving x=0,1 as open
    // columns. Sunlight fills the open columns to 15 at every y; under the roof
    // the only light path is horizontal from x=1, so it attenuates 1/block.
    // This is the cave-mouth / overhang lighting case.
    const blocks = makeChunkBlocks()
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 2; x < CHUNK_SIZE; x++) {
        setChunkBlock(blocks, { lx: x, y: 100, lz: z, blockType: 'STONE' })
      }
    }
    const lightGrid = createLightBuffer()
    computeSkyLight(blocks, lightGrid)

    // Open columns: full skylight at the row just below the roof.
    expect(getLightAt(lightGrid, 0, 99, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 1, 99, 8)).toBe(LIGHT_LEVEL_MAX)
    // Under the roof: horizontal attenuation from the open edge (x=1 → 15).
    expect(getLightAt(lightGrid, 2, 99, 8)).toBe(14)
    expect(getLightAt(lightGrid, 3, 99, 8)).toBe(13)
    expect(getLightAt(lightGrid, 4, 99, 8)).toBe(12)
    // The roof block itself blocks vertical light.
    expect(getLightAt(lightGrid, 2, 100, 8)).toBe(0)
    // Above the roof, open sky is still full.
    expect(getLightAt(lightGrid, 2, 150, 8)).toBe(LIGHT_LEVEL_MAX)
  })

  it('computeSkyLight zeroes the grid before computing (stale buffer is reset)', () => {
    const blocks = makeChunkBlocks('STONE')
    const lightGrid = createLightBuffer()
    lightGrid.fill(0xff)
    computeSkyLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 0, 0, 0)).toBe(0)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
  })
})
