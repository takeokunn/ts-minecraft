import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Option } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/core'
import {
  computeInitialLightGrids,
  createTerrainNoiseCoordinates,
  toChunkBlocks,
} from '../domain/terrain/terrain-generation-utils'

const makeEmptyBlocks = () => new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)

describe('domain/terrain/terrain-generation-utils — createTerrainNoiseCoordinates', () => {
  it('returns exactly CHUNK_SIZE * CHUNK_SIZE coordinate pairs', () => {
    const coords = createTerrainNoiseCoordinates({ x: 0, z: 0 })
    expect(coords.length).toBe(CHUNK_SIZE * CHUNK_SIZE)
  })

  it('preserves chunk origin offsets', () => {
    const coords = createTerrainNoiseCoordinates({ x: 1, z: 1 })
    const first = Option.getOrThrow(Arr.get(coords, 0))
    expect(first.wx).toBe(CHUNK_SIZE)
    expect(first.wz).toBe(CHUNK_SIZE)
  })

  it('keeps negative chunk coordinates negative in world space', () => {
    const coords = createTerrainNoiseCoordinates({ x: -1, z: -1 })
    Arr.forEach(coords, ({ wx, wz }) => {
      expect(wx).toBeLessThan(0)
      expect(wz).toBeLessThan(0)
    })
  })
})

describe('domain/terrain/terrain-generation-utils — light buffer helpers', () => {
  it('computeInitialLightGrids allocates packed light buffers for the chunk', () => {
    const blocks = makeEmptyBlocks()
    const { skyLight, blockLight } = computeInitialLightGrids(blocks)
    const expectedLength = Math.ceil((CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT) / 2)
    expect(skyLight.byteLength).toBe(expectedLength)
    expect(blockLight.byteLength).toBe(expectedLength)
  })

  it('toChunkBlocks reuses the block buffer and attaches computed light buffers', () => {
    const blocks = makeEmptyBlocks()
    blocks[0] = blockTypeToIndex('STONE')

    const chunkBlocks = toChunkBlocks({ blocks })

    expect(chunkBlocks.blocks).toBe(blocks)
    expect(chunkBlocks.skyLight).not.toBe(blocks)
    expect(chunkBlocks.blockLight).not.toBe(blocks)
    expect(chunkBlocks.skyLight.byteLength).toBeGreaterThan(0)
    expect(chunkBlocks.blockLight.byteLength).toBeGreaterThan(0)
  })
})
