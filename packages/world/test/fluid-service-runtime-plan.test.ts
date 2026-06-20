import { HashMap, HashSet, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  FLUID_TICK_BUDGET,
  INITIAL_STATE,
  blockKey,
} from '@ts-minecraft/block/domain/fluid-model'
import type { FluidCell, FluidState, FluidType } from '@ts-minecraft/block/domain/fluid-model'
import { CHUNK_SIZE, ChunkCacheKey } from '@ts-minecraft/core'
import type { Position } from '@ts-minecraft/core'
import { cacheFromChunks } from '../application/fluid-service-helpers'
import { buildSyncedFluidState, collectTickWork } from '../application/fluid-service-runtime-plan'
import { setCellAndEnqueueKey, hydrateChunk } from '../application/fluid-state-ops'
import {
  makeTestChunkWithBlocks,
} from './chunk-buffer-test-utils'

const pos = (x: number, y: number, z: number): Position => ({ x, y, z })

const water = (level = 0, source = true): FluidCell => ({ level, source, type: 'water' })
const lava = (level = 0, source = true): FluidCell => ({ level, source, type: 'lava' })

const seedCells = (state: FluidState, type: FluidType, count: number, startAt = 0): FluidState => {
  let next = state
  for (let i = 0; i < count; i++) {
    const key = blockKey(pos(startAt + i, 64, 0))
    next = setCellAndEnqueueKey(next, key, type === 'water' ? water() : lava())
  }
  return next
}

const chunkCellKey = (coordX: number, coordZ: number, lx: number, y: number, lz: number) =>
  blockKey(pos(coordX * CHUNK_SIZE + lx, y, coordZ * CHUNK_SIZE + lz))

describe('buildSyncedFluidState', () => {
  it('hydrates newly loaded chunks from an empty cache', () => {
    const chunk = makeTestChunkWithBlocks(
      [
        { lx: 1, y: 10, lz: 2, blockType: 'WATER' },
        { lx: 3, y: 12, lz: 4, blockType: 'LAVA' },
      ],
      { x: 2, z: -1 },
    )

    const { nextState, nextCache } = buildSyncedFluidState(INITIAL_STATE, cacheFromChunks([]), [chunk])
    const waterKey = chunkCellKey(2, -1, 1, 10, 2)
    const lavaKey = chunkCellKey(2, -1, 3, 12, 4)

    expect(HashMap.has(nextCache, ChunkCacheKey.make(chunk.coord))).toBe(true)
    expect(Option.getOrThrow(HashMap.get(nextState.cells, waterKey))).toEqual(water())
    expect(Option.getOrThrow(HashMap.get(nextState.cells, lavaKey))).toEqual(lava())
    expect(HashSet.has(nextState.frontier, waterKey)).toBe(true)
    expect(HashSet.has(nextState.frontier, lavaKey)).toBe(true)
  })

  it('prunes cells and frontier entries from departed chunks', () => {
    const departed = makeTestChunkWithBlocks([{ lx: 1, y: 10, lz: 2, blockType: 'WATER' }], { x: 0, z: 0 })
    const retained = makeTestChunkWithBlocks([{ lx: 3, y: 11, lz: 4, blockType: 'LAVA' }], { x: 1, z: 0 })
    const seeded = hydrateChunk(hydrateChunk(INITIAL_STATE, departed), retained)
    const prevCache = cacheFromChunks([departed, retained])

    const { nextState, nextCache } = buildSyncedFluidState(seeded, prevCache, [retained])
    const departedKey = chunkCellKey(0, 0, 1, 10, 2)
    const retainedKey = chunkCellKey(1, 0, 3, 11, 4)

    expect(HashMap.has(nextCache, ChunkCacheKey.make(retained.coord))).toBe(true)
    expect(HashMap.has(nextCache, ChunkCacheKey.make(departed.coord))).toBe(false)
    expect(Option.isNone(HashMap.get(nextState.cells, departedKey))).toBe(true)
    expect(HashSet.has(nextState.frontier, departedKey)).toBe(false)
    expect(Option.getOrThrow(HashMap.get(nextState.cells, retainedKey))).toEqual(lava())
    expect(HashSet.has(nextState.frontier, retainedKey)).toBe(true)
  })
})

describe('collectTickWork', () => {
  it('caps water collection at half the tick budget and skips lava while inactive', () => {
    const halfBudget = Math.floor(FLUID_TICK_BUDGET / 2)
    const state = seedCells(seedCells(INITIAL_STATE, 'water', halfBudget + 2), 'lava', 4, 10_000)
    const collected = collectTickWork(state, false)

    expect(collected).toHaveLength(halfBudget)
    expect(collected.every((item) => item.cell.type === 'water')).toBe(true)
  })

  it('collects lava only when the lava tick is active', () => {
    const halfBudget = Math.floor(FLUID_TICK_BUDGET / 2)
    const state = seedCells(seedCells(INITIAL_STATE, 'water', halfBudget + 2), 'lava', FLUID_TICK_BUDGET + 2, 20_000)
    const collected = collectTickWork(state, true)

    expect(collected.filter((item) => item.cell.type === 'water')).toHaveLength(halfBudget)
    expect(collected.filter((item) => item.cell.type === 'lava')).toHaveLength(FLUID_TICK_BUDGET)
  })
})
