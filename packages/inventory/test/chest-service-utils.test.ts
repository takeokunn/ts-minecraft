import { describe, expect, it } from 'vitest'
import { HashMap, Option } from 'effect'
import { chestKey, emptyChestAtPosition, setChestState, INITIAL_CHEST_STATE } from '@ts-minecraft/inventory/domain/chest-service-utils'
import { CHEST_SIZE } from '@ts-minecraft/inventory/domain/chest-service.config'

const pos = (x: number, y: number, z: number) => ({ x, y, z })

// ─── chestKey ─────────────────────────────────────────────────────────────────
describe('chestKey', () => {
  it('formats position as "x,y,z"', () => {
    expect(chestKey(pos(10, 64, -5))).toBe('10,64,-5')
  })

  it('handles zero coordinates', () => {
    expect(chestKey(pos(0, 0, 0))).toBe('0,0,0')
  })

  it('produces different keys for different positions', () => {
    expect(chestKey(pos(1, 2, 3))).not.toBe(chestKey(pos(3, 2, 1)))
  })
})

// ─── emptyChestAtPosition ─────────────────────────────────────────────────────
describe('emptyChestAtPosition', () => {
  it('stores the given position', () => {
    const chest = emptyChestAtPosition(pos(5, 70, 8))
    expect(chest.position).toEqual({ x: 5, y: 70, z: 8 })
  })

  it(`creates exactly ${CHEST_SIZE} slots`, () => {
    const chest = emptyChestAtPosition(pos(0, 0, 0))
    expect(chest.slots).toHaveLength(CHEST_SIZE)
  })

  it('initialises all slots to Option.none()', () => {
    const chest = emptyChestAtPosition(pos(0, 0, 0))
    for (const slot of chest.slots) {
      expect(Option.isNone(slot)).toBe(true)
    }
  })
})

// ─── INITIAL_CHEST_STATE ──────────────────────────────────────────────────────
describe('INITIAL_CHEST_STATE', () => {
  it('starts with an empty chests map', () => {
    expect(HashMap.size(INITIAL_CHEST_STATE.chests)).toBe(0)
  })

  it('starts with selectedChestPosition = none', () => {
    expect(Option.isNone(INITIAL_CHEST_STATE.selectedChestPosition)).toBe(true)
  })
})

// ─── setChestState ────────────────────────────────────────────────────────────
describe('setChestState', () => {
  it('inserts a chest into the state', () => {
    const chest = emptyChestAtPosition(pos(0, 64, 0))
    const state = setChestState(INITIAL_CHEST_STATE, chest)
    expect(HashMap.size(state.chests)).toBe(1)
    const stored = Option.getOrNull(HashMap.get(state.chests, chestKey(pos(0, 64, 0))))
    expect(stored?.position).toEqual({ x: 0, y: 64, z: 0 })
  })

  it('overwrites an existing chest at the same position', () => {
    const chest1 = emptyChestAtPosition(pos(0, 64, 0))
    const chest2 = emptyChestAtPosition(pos(0, 64, 0))
    const state1 = setChestState(INITIAL_CHEST_STATE, chest1)
    const state2 = setChestState(state1, chest2)
    expect(HashMap.size(state2.chests)).toBe(1)
  })

  it('does not mutate the original state', () => {
    const chest = emptyChestAtPosition(pos(0, 64, 0))
    setChestState(INITIAL_CHEST_STATE, chest)
    expect(HashMap.size(INITIAL_CHEST_STATE.chests)).toBe(0)
  })

  it('accumulates multiple distinct chests', () => {
    const c1 = emptyChestAtPosition(pos(0, 64, 0))
    const c2 = emptyChestAtPosition(pos(16, 64, 0))
    const state = setChestState(setChestState(INITIAL_CHEST_STATE, c1), c2)
    expect(HashMap.size(state.chests)).toBe(2)
  })

  it('preserves the selectedChestPosition from the input state', () => {
    const chest = emptyChestAtPosition(pos(0, 64, 0))
    const state = setChestState(INITIAL_CHEST_STATE, chest)
    expect(Option.isNone(state.selectedChestPosition)).toBe(true)
  })
})
