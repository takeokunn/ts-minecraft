import { describe, it, expect } from 'vitest'
import { HashMap, Option } from 'effect'
import { INITIAL_STATE, blockKey } from '@ts-minecraft/block'
import type { FluidCell } from '@ts-minecraft/block'
import type { Position } from '@ts-minecraft/core'
import { setCell, removeCell } from '../application/fluid-state-ops'

const pos = (x: number, y: number, z: number): Position => ({ x, y, z })
const water = (level = 0, source = true): FluidCell => ({ type: 'water', level, source })
const lava = (level = 0, source = true): FluidCell => ({ type: 'lava', level, source })

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
