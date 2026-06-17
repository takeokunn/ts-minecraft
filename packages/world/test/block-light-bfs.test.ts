import { describe, expect, it } from '@effect/vitest'
import { createLightBuffer, getLightAt, setLightAt } from '@ts-minecraft/block'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndexUnsafe, blockTypeToIndex } from '@ts-minecraft/core'
import { propagateBlockLightIncremental } from '../domain/block-light-bfs'
import type { AABBAccumulator, DirtyVoxel, MutableBoundaryDirty } from '../domain/light-engine-model'

const AIR = blockTypeToIndex('AIR')
const STONE = blockTypeToIndex('STONE')
const LAVA = blockTypeToIndex('LAVA')
const REDSTONE_TORCH = blockTypeToIndex('REDSTONE_TORCH')
const END_PORTAL_FRAME = blockTypeToIndex('END_PORTAL_FRAME')

const CHUNK_BLOCK_COUNT = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE

const createAirBlocks = (): Uint8Array => {
  const blocks = new Uint8Array(CHUNK_BLOCK_COUNT)
  blocks.fill(AIR)
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
  propagateBlockLightIncremental(blocks, grid, dirty, boundary, touched)
  return { boundary, touched }
}

describe('domain/block-light-bfs', () => {
  it('seeds an emissive dirty voxel and propagates through transparent blocks', () => {
    const blocks = createAirBlocks()
    const grid = createLightBuffer()
    placeBlock(blocks, 8, 100, 8, LAVA)

    const { boundary, touched } = propagate(blocks, grid, [{ lx: 8, y: 100, lz: 8 }])

    expect(getLightAt(grid, 8, 100, 8)).toBe(15)
    expect(getLightAt(grid, 9, 100, 8)).toBe(14)
    expect(getLightAt(grid, 10, 100, 8)).toBe(13)
    expect(getLightAt(grid, 8, 101, 8)).toBe(14)
    expect(boundary).toEqual({ nx: true, px: true, nz: true, pz: true })
    expect(touched.aabb).toEqual({
      minX: 0,
      maxX: 15,
      minY: 86,
      maxY: 114,
      minZ: 0,
      maxZ: 15,
    })
  })

  it('does not propagate new light through opaque neighbors', () => {
    const blocks = createAirBlocks()
    const grid = createLightBuffer()
    placeBlock(blocks, 8, 64, 8, LAVA)
    placeBlock(blocks, 9, 64, 8, STONE)

    propagate(blocks, grid, [{ lx: 8, y: 64, lz: 8 }])

    expect(getLightAt(grid, 8, 64, 8)).toBe(15)
    expect(getLightAt(grid, 9, 64, 8)).toBe(0)
    expect(getLightAt(grid, 8, 64, 9)).toBe(14)
  })

  it('marks horizontal chunk boundaries when propagation reaches an edge', () => {
    const blocks = createAirBlocks()
    const grid = createLightBuffer()
    placeBlock(blocks, 0, 0, 0, LAVA)

    const { boundary } = propagate(blocks, grid, [{ lx: 0, y: 0, lz: 0 }])

    expect(getLightAt(grid, 0, 0, 0)).toBe(15)
    expect(boundary.nx).toBe(true)
    expect(boundary.nz).toBe(true)
    expect(boundary.px).toBe(false)
    expect(boundary.pz).toBe(false)
  })

  it('removes a stale light field when an emissive source is cleared', () => {
    const blocks = createAirBlocks()
    const grid = createLightBuffer()
    setLightAt(grid, 8, 64, 8, 15)
    setLightAt(grid, 9, 64, 8, 14)
    setLightAt(grid, 10, 64, 8, 13)
    setLightAt(grid, 8, 65, 8, 14)

    const { touched } = propagate(blocks, grid, [{ lx: 8, y: 64, lz: 8 }])

    expect(getLightAt(grid, 8, 64, 8)).toBe(0)
    expect(getLightAt(grid, 9, 64, 8)).toBe(0)
    expect(getLightAt(grid, 10, 64, 8)).toBe(0)
    expect(getLightAt(grid, 8, 65, 8)).toBe(0)
    expect(touched.aabb).toEqual({
      minX: 8,
      maxX: 10,
      minY: 64,
      maxY: 65,
      minZ: 8,
      maxZ: 8,
    })
  })

  it('marks horizontal boundaries while removing stale edge light', () => {
    const blocks = createAirBlocks()
    const grid = createLightBuffer()
    setLightAt(grid, 0, 0, 0, 15)

    const { boundary } = propagate(blocks, grid, [{ lx: 0, y: 0, lz: 0 }])

    expect(getLightAt(grid, 0, 0, 0)).toBe(0)
    expect(boundary.nx).toBe(true)
    expect(boundary.nz).toBe(true)
    expect(boundary.px).toBe(false)
    expect(boundary.pz).toBe(false)
  })

  it('marks positive horizontal boundaries while removing stale edge light', () => {
    const blocks = createAirBlocks()
    const grid = createLightBuffer()
    setLightAt(grid, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1, 15)

    const { boundary } = propagate(blocks, grid, [{ lx: CHUNK_SIZE - 1, y: 0, lz: CHUNK_SIZE - 1 }])

    expect(getLightAt(grid, CHUNK_SIZE - 1, 0, CHUNK_SIZE - 1)).toBe(0)
    expect(boundary.nx).toBe(false)
    expect(boundary.nz).toBe(false)
    expect(boundary.px).toBe(true)
    expect(boundary.pz).toBe(true)
  })

  it('re-adds light from a stronger neighbor after removing stale light', () => {
    const blocks = createAirBlocks()
    const grid = createLightBuffer()
    setLightAt(grid, 8, 64, 8, 10)
    setLightAt(grid, 9, 64, 8, 12)

    propagate(blocks, grid, [{ lx: 8, y: 64, lz: 8 }])

    expect(getLightAt(grid, 9, 64, 8)).toBe(12)
    expect(getLightAt(grid, 8, 64, 8)).toBe(11)
  })

  it('uses the full block buffer contract while re-adding stale light', () => {
    const blocks = createAirBlocks()
    const grid = createLightBuffer()
    placeBlock(blocks, 10, 64, 8, STONE)
    setLightAt(grid, 8, 64, 8, 10)
    setLightAt(grid, 9, 64, 8, 12)

    propagate(blocks, grid, [{ lx: 8, y: 64, lz: 8 }])

    expect(getLightAt(grid, 8, 64, 8)).toBe(11)
    expect(getLightAt(grid, 10, 64, 8)).toBe(0)
    expect(getLightAt(grid, 9, 64, 9)).toBe(11)
  })

  it('skips stale queued propagation after a brighter source reaches the same voxel', () => {
    const blocks = createAirBlocks()
    const grid = createLightBuffer()
    placeBlock(blocks, 8, 64, 8, REDSTONE_TORCH)
    placeBlock(blocks, 10, 64, 8, LAVA)

    propagate(blocks, grid, [
      { lx: 8, y: 64, lz: 8 },
      { lx: 10, y: 64, lz: 8 },
    ])

    expect(getLightAt(grid, 9, 64, 8)).toBe(14)
    expect(getLightAt(grid, 8, 64, 8)).toBe(13)
  })

  it('keeps dim level-one emitters local and ignores invalid vertical neighbors', () => {
    const blocks = createAirBlocks()
    const grid = createLightBuffer()
    placeBlock(blocks, 8, CHUNK_HEIGHT - 1, 8, END_PORTAL_FRAME)

    const { boundary } = propagate(blocks, grid, [{ lx: 8, y: CHUNK_HEIGHT - 1, lz: 8 }])

    expect(getLightAt(grid, 8, CHUNK_HEIGHT - 1, 8)).toBe(1)
    expect(getLightAt(grid, 7, CHUNK_HEIGHT - 1, 8)).toBe(0)
    expect(boundary).toEqual({ nx: false, px: false, nz: false, pz: false })
  })
})
