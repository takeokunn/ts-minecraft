import { describe, it, expect } from 'vitest'
import { HashMap, HashSet, Option } from 'effect'
import { createFluidBuffer, encodeFluidCell } from '@ts-minecraft/block/domain/fluid'
import { INITIAL_STATE, type FluidCell } from '@ts-minecraft/block/domain/fluid-model'
import { blockKey } from '@ts-minecraft/block/domain/fluid-position-utils'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndex, blockTypeToIndex } from '@ts-minecraft/core'
import type { Position } from '@ts-minecraft/core'
import type { Chunk } from '../domain/chunk'
import { setCell, setCellAndEnqueueKey, removeCell, hydrateChunk } from '../application/fluid-state-ops'

const pos = (x: number, y: number, z: number): Position => ({ x, y, z })
const water = (level = 0, source = true): FluidCell => ({ type: 'water', level, source })
const lava = (level = 0, source = true): FluidCell => ({ type: 'lava', level, source })
const chunkLength = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
const indexAt = (x: number, y: number, z: number): number => Option.getOrThrow(blockIndex(x, y, z))
const makeChunk = (overrides: Partial<Chunk> = {}): Chunk => ({
  coord: { x: 0, z: 0 },
  blocks: new Uint8Array(chunkLength),
  fluid: Option.none(),
  ...overrides,
})

describe('setCell', () => {
  it('inserts a cell keyed by block position', () => {
    const p = pos(3, 64, 7)
    const next = setCell(INITIAL_STATE, p, water())
    expect(Option.getOrThrow(HashMap.get(next.cells, blockKey(p)))).toEqual(water())
  })

  it('does not mutate the input state (immutability)', () => {
    const before = HashMap.size(INITIAL_STATE.cells)
    setCell(INITIAL_STATE, pos(1, 1, 1), lava())
    expect(HashMap.size(INITIAL_STATE.cells)).toBe(before)
  })

  it('overwrites the cell at an existing position', () => {
    const p = pos(0, 0, 0)
    const once = setCell(INITIAL_STATE, p, water(0, true))
    const twice = setCell(once, p, water(4, false))
    expect(HashMap.size(twice.cells)).toBe(1)
    expect(Option.getOrThrow(HashMap.get(twice.cells, blockKey(p)))).toEqual(water(4, false))
  })

  it('preserves frontier and tickCounter from the prior state', () => {
    const seeded = { ...INITIAL_STATE, tickCounter: 42 }
    const next = setCell(seeded, pos(2, 2, 2), water())
    expect(next.tickCounter).toBe(42)
    expect(next.frontier).toBe(seeded.frontier)
  })

  it('keeps distinct positions as distinct entries', () => {
    const a = setCell(INITIAL_STATE, pos(1, 0, 0), water())
    const b = setCell(a, pos(2, 0, 0), lava())
    expect(HashMap.size(b.cells)).toBe(2)
  })
})

describe('setCellAndEnqueueKey', () => {
  it('stores the cell and enqueues the affected block key', () => {
    const p = pos(7, 8, 9)
    const key = blockKey(p)
    const next = setCellAndEnqueueKey(INITIAL_STATE, key, lava(3, false))

    expect(Option.getOrThrow(HashMap.get(next.cells, key))).toEqual(lava(3, false))
    expect(HashSet.has(next.frontier, key)).toBe(true)
    expect(HashSet.size(next.frontier)).toBe(1)
  })
})

describe('hydrateChunk', () => {
  it('hydrates encoded cells from a complete fluid buffer', () => {
    const fluid = createFluidBuffer()
    const waterIdx = indexAt(1, 64, 2)
    const lavaIdx = indexAt(3, 32, 4)
    fluid[waterIdx] = encodeFluidCell(water(2, false))
    fluid[lavaIdx] = encodeFluidCell(lava(0, true))
    const chunk = makeChunk({ coord: { x: 2, z: -1 }, fluid: Option.some(fluid) })

    const next = hydrateChunk(INITIAL_STATE, chunk)
    const waterKey = blockKey(pos(33, 64, -14))
    const lavaKey = blockKey(pos(35, 32, -12))

    expect(Option.getOrThrow(HashMap.get(next.cells, waterKey))).toEqual(water(2, false))
    expect(Option.getOrThrow(HashMap.get(next.cells, lavaKey))).toEqual(lava())
    expect(HashSet.has(next.frontier, waterKey)).toBe(true)
    expect(HashSet.has(next.frontier, lavaKey)).toBe(true)
  })

  it('returns the same state when no fluid cells are present', () => {
    const next = hydrateChunk(INITIAL_STATE, makeChunk({ fluid: Option.some(createFluidBuffer()) }))
    expect(next).toBe(INITIAL_STATE)
  })

  it('hydrates source blocks when no complete fluid buffer is available', () => {
    const blocks = new Uint8Array(chunkLength)
    const waterIdx = indexAt(0, 10, 0)
    const lavaIdx = indexAt(4, 11, 5)
    blocks[waterIdx] = blockTypeToIndex('WATER')
    blocks[lavaIdx] = blockTypeToIndex('LAVA')
    const chunk = makeChunk({ blocks })

    const next = hydrateChunk(INITIAL_STATE, chunk)
    expect(Option.getOrThrow(HashMap.get(next.cells, blockKey(pos(0, 10, 0))))).toEqual(water())
    expect(Option.getOrThrow(HashMap.get(next.cells, blockKey(pos(4, 11, 5))))).toEqual(lava())
  })

  it('does not enqueue steady-state ocean-interior cells (frontier stays lean)', () => {
    // Fill a solid-floored basin: stone floor at y=9, water filling y=10..13
    // across the full chunk. Only the surface layer (air above) is enqueued
    // directly; enqueueKey spills one layer below as its neighbor. Cells two
    // or more layers below the surface — the bulk of any ocean — must stay
    // out of the frontier.
    const blocks = new Uint8Array(chunkLength)
    const STONE = blockTypeToIndex('STONE')
    const WATER = blockTypeToIndex('WATER')
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        blocks[indexAt(x, 9, z)] = STONE
        for (let y = 10; y <= 13; y++) blocks[indexAt(x, y, z)] = WATER
      }
    }
    const next = hydrateChunk(INITIAL_STATE, makeChunk({ blocks }))
    // every water cell is tracked
    expect(HashMap.size(next.cells)).toBe(CHUNK_SIZE * CHUNK_SIZE * 4)
    // deep interior cells (2+ below the surface) are NOT in the frontier
    expect(HashSet.has(next.frontier, blockKey(pos(8, 11, 8)))).toBe(false)
    expect(HashSet.has(next.frontier, blockKey(pos(8, 10, 8)))).toBe(false)
    // the surface layer (air above) IS enqueued
    expect(HashSet.has(next.frontier, blockKey(pos(8, 13, 8)))).toBe(true)
    // chunk-face cells are conservatively enqueued (outward neighbor unknown)
    expect(HashSet.has(next.frontier, blockKey(pos(0, 11, 8)))).toBe(true)
  })

  it('enqueues an interior source next to the other fluid (contact must react)', () => {
    const blocks = new Uint8Array(chunkLength)
    const WATER = blockTypeToIndex('WATER')
    const LAVA = blockTypeToIndex('LAVA')
    const STONE = blockTypeToIndex('STONE')
    // encase a water+lava pair in stone so only the contact matters
    for (let x = 6; x <= 9; x++) for (let y = 19; y <= 21; y++) for (let z = 6; z <= 9; z++) blocks[indexAt(x, y, z)] = STONE
    blocks[indexAt(7, 20, 7)] = WATER
    blocks[indexAt(8, 20, 7)] = LAVA
    const next = hydrateChunk(INITIAL_STATE, makeChunk({ blocks }))
    expect(HashSet.has(next.frontier, blockKey(pos(7, 20, 7)))).toBe(true)
    expect(HashSet.has(next.frontier, blockKey(pos(8, 20, 7)))).toBe(true)
  })

  it('rejects non-zero fluid bytes that were not written by the codec', () => {
    const fluid = createFluidBuffer()
    fluid[indexAt(0, 1, 0)] = 0x07

    expect(() => hydrateChunk(INITIAL_STATE, makeChunk({ fluid: Option.some(fluid) }))).toThrow()
  })
})

describe('removeCell', () => {
  it('removes a previously set cell', () => {
    const p = pos(5, 10, 5)
    const withCell = setCell(INITIAL_STATE, p, water())
    const removed = removeCell(withCell, p)
    expect(Option.isNone(HashMap.get(removed.cells, blockKey(p)))).toBe(true)
    expect(HashMap.size(removed.cells)).toBe(0)
  })

  it('is a no-op for a position that has no cell', () => {
    const removed = removeCell(INITIAL_STATE, pos(9, 9, 9))
    expect(HashMap.size(removed.cells)).toBe(0)
  })

  it('does not mutate the input state', () => {
    const withCell = setCell(INITIAL_STATE, pos(0, 0, 0), water())
    removeCell(withCell, pos(0, 0, 0))
    expect(HashMap.size(withCell.cells)).toBe(1)
  })

  it('leaves sibling cells intact', () => {
    const two = setCell(setCell(INITIAL_STATE, pos(1, 0, 0), water()), pos(2, 0, 0), lava())
    const removed = removeCell(two, pos(1, 0, 0))
    expect(HashMap.size(removed.cells)).toBe(1)
    expect(Option.isSome(HashMap.get(removed.cells, blockKey(pos(2, 0, 0))))).toBe(true)
  })

  it('round-trips: set then remove returns to an empty cell map', () => {
    const p = pos(-4, 30, -8) // negative coords exercise the BIAS-offset key encoding
    const roundTrip = removeCell(setCell(INITIAL_STATE, p, water()), p)
    expect(HashMap.size(roundTrip.cells)).toBe(0)
  })
})
