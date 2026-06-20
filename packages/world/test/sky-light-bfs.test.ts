import { describe, expect, it } from '@effect/vitest'
import { createLightBuffer, getLightAt, LIGHT_LEVEL_MAX, setLightAt } from '@ts-minecraft/block/domain/light'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndexUnsafe, blockTypeToIndex } from '@ts-minecraft/core'
import { propagateSkyLightIncremental } from '../domain/sky-light-bfs'
import type { AABBAccumulator, DirtyVoxel, MutableBoundaryDirty } from '../domain/light-engine-model'

const AIR = blockTypeToIndex('AIR')
const STONE = blockTypeToIndex('STONE')

const CHUNK_BLOCK_COUNT = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE

const createAirBlocks = (): Uint8Array => {
  const blocks = new Uint8Array(CHUNK_BLOCK_COUNT)
  blocks.fill(AIR)
  return blocks
}

const createStoneBlocks = (): Uint8Array => {
  const blocks = new Uint8Array(CHUNK_BLOCK_COUNT)
  blocks.fill(STONE)
  return blocks
}

const placeBlock = (blocks: Uint8Array, lx: number, y: number, lz: number, block: number): void => {
  blocks[blockIndexUnsafe(lx, y, lz)] = block
}

const createBoundary = (): MutableBoundaryDirty => ({
  nx: false,
  px: false,
  nz: false,
  pz: false,
})

const createTouched = (): AABBAccumulator => ({ aabb: null })

const propagate = (
  blocks: Uint8Array,
  grid: Uint8Array,
  dirty: ReadonlyArray<DirtyVoxel>,
): { readonly boundary: MutableBoundaryDirty; readonly touched: AABBAccumulator } => {
  const boundary = createBoundary()
  const touched = createTouched()
  propagateSkyLightIncremental(blocks, grid, dirty, boundary, touched)
  return { boundary, touched }
}

describe('domain/sky-light-bfs', () => {
  it('fills an exposed dirty column and propagates skylight through transparent blocks', () => {
    const blocks = createAirBlocks()
    const grid = createLightBuffer()

    const { boundary, touched } = propagate(blocks, grid, [{ lx: 8, y: 64, lz: 8 }])

    expect(getLightAt(grid, 8, CHUNK_HEIGHT - 1, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(grid, 8, 0, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(grid, 9, 64, 8)).toBe(14)
    expect(boundary).toEqual({ nx: true, px: true, nz: true, pz: true })
    expect(touched.aabb).toEqual({
      minX: 0,
      maxX: 15,
      minY: 0,
      maxY: CHUNK_HEIGHT - 1,
      minZ: 0,
      maxZ: 15,
    })
  })

  it('deduplicates multiple dirty voxels in the same sky column', () => {
    const blocks = createAirBlocks()
    const grid = createLightBuffer()

    propagate(blocks, grid, [
      { lx: 8, y: 32, lz: 8 },
      { lx: 8, y: 160, lz: 8 },
    ])

    expect(getLightAt(grid, 8, CHUNK_HEIGHT - 1, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(grid, 8, 0, 8)).toBe(LIGHT_LEVEL_MAX)
  })

  it('removes stale light cascades from an opaque dirty column', () => {
    const blocks = createStoneBlocks()
    const grid = createLightBuffer()
    setLightAt(grid, 8, 64, 8, 10)
    setLightAt(grid, 9, 64, 8, 9)
    setLightAt(grid, 10, 64, 8, 8)

    const { touched } = propagate(blocks, grid, [{ lx: 8, y: 64, lz: 8 }])

    expect(getLightAt(grid, 8, 64, 8)).toBe(0)
    expect(getLightAt(grid, 9, 64, 8)).toBe(0)
    expect(getLightAt(grid, 10, 64, 8)).toBe(0)
    expect(touched.aabb).toEqual({
      minX: 8,
      maxX: 10,
      minY: 64,
      maxY: 64,
      minZ: 8,
      maxZ: 8,
    })
  })

  it('re-adds sky light from a stable stronger neighbor after clearing stale shadow', () => {
    const blocks = createAirBlocks()
    const grid = createLightBuffer()
    placeBlock(blocks, 8, 65, 8, STONE)
    setLightAt(grid, 8, 64, 8, LIGHT_LEVEL_MAX)
    setLightAt(grid, 9, 64, 8, LIGHT_LEVEL_MAX)

    propagate(blocks, grid, [{ lx: 8, y: 64, lz: 8 }])

    expect(getLightAt(grid, 9, 64, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(grid, 8, 64, 8)).toBe(14)
  })

  it('skips stale queued propagation after a brighter sky column reaches the same voxel', () => {
    const blocks = createAirBlocks()
    const grid = createLightBuffer()
    placeBlock(blocks, 8, 64, 8, STONE)
    setLightAt(grid, 8, 64, 8, 10)
    setLightAt(grid, 9, 64, 8, 12)

    propagate(blocks, grid, [
      { lx: 8, y: 64, lz: 8 },
      { lx: 9, y: 64, lz: 9 },
    ])

    expect(getLightAt(grid, 9, 64, 8)).toBe(14)
    expect(getLightAt(grid, 8, 64, 8)).toBe(0)
  })

  it('marks negative horizontal boundaries while removing stale edge sky light', () => {
    const blocks = createStoneBlocks()
    const grid = createLightBuffer()
    setLightAt(grid, 0, 0, 0, 10)

    const { boundary } = propagate(blocks, grid, [{ lx: 0, y: 0, lz: 0 }])

    expect(getLightAt(grid, 0, 0, 0)).toBe(0)
    expect(boundary).toEqual({ nx: true, px: false, nz: true, pz: false })
  })

  it('marks positive horizontal boundaries while removing stale edge sky light', () => {
    const blocks = createStoneBlocks()
    const grid = createLightBuffer()
    setLightAt(grid, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1, 10)

    const { boundary } = propagate(blocks, grid, [{ lx: CHUNK_SIZE - 1, y: 0, lz: CHUNK_SIZE - 1 }])

    expect(getLightAt(grid, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1)).toBe(0)
    expect(boundary).toEqual({ nx: false, px: true, nz: false, pz: true })
  })

  it('treats opaque neighbor entries from the full chunk buffer as propagation blockers', () => {
    const blocks = createAirBlocks()
    const grid = createLightBuffer()
    placeBlock(blocks, 9, 64, 8, STONE)

    propagate(blocks, grid, [{ lx: 8, y: 64, lz: 8 }])

    expect(getLightAt(grid, 8, 64, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(grid, 9, 64, 8)).toBe(0)
  })

  it('does not fan out level-one queued light', () => {
    const blocks = createStoneBlocks()
    const grid = createLightBuffer()
    setLightAt(grid, 8, 64, 8, 2)
    setLightAt(grid, 9, 64, 8, 1)

    propagate(blocks, grid, [{ lx: 8, y: 64, lz: 8 }])

    expect(getLightAt(grid, 8, 64, 8)).toBe(0)
    expect(getLightAt(grid, 9, 64, 8)).toBe(0)
    expect(getLightAt(grid, 10, 64, 8)).toBe(0)
  })
})
