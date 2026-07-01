import { describe, expect, it } from 'vitest'
import { HashMap, Option } from 'effect'
import {
  getFurnaceItemStacks,
  resetFurnaceAfterOutputCollected,
  removeFurnaceAtPosition,
} from '../application/furnace-service-state'
import type { FurnaceBlockState } from '../domain/furnace-state'
import { INITIAL_STATE } from '../domain/furnace-service-utils'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const POS = { x: 10, y: 64, z: 20 }

const makeStack = (itemType: string, count: number) => ({ itemType: itemType as any, count })

const makeFurnace = (overrides: Partial<FurnaceBlockState> = {}): FurnaceBlockState => ({
  position: POS,
  input: Option.some(makeStack('RAW_IRON', 1)),
  fuel: Option.some(makeStack('COAL', 1)),
  output: Option.some(makeStack('IRON_INGOT', 1)),
  activeRecipeId: Option.none(),
  progressSecs: 5,
  ...overrides,
})

// ─── getFurnaceItemStacks ─────────────────────────────────────────────────────

describe('getFurnaceItemStacks', () => {
  it('returns all three item stacks when all slots are filled', () => {
    const stacks = getFurnaceItemStacks(makeFurnace())
    expect(stacks).toHaveLength(3)
  })

  it('excludes empty (None) slots', () => {
    const sparse = makeFurnace({ fuel: Option.none(), output: Option.none() })
    expect(getFurnaceItemStacks(sparse)).toHaveLength(1)
  })

  it('returns empty array when all slots are empty', () => {
    const empty = makeFurnace({ input: Option.none(), fuel: Option.none(), output: Option.none() })
    expect(getFurnaceItemStacks(empty)).toHaveLength(0)
  })
})

// ─── resetFurnaceAfterOutputCollected ─────────────────────────────────────────

describe('resetFurnaceAfterOutputCollected', () => {
  it('clears all item slots', () => {
    const reset = resetFurnaceAfterOutputCollected(makeFurnace())
    expect(Option.isNone(reset.input)).toBe(true)
    expect(Option.isNone(reset.fuel)).toBe(true)
    expect(Option.isNone(reset.output)).toBe(true)
  })

  it('resets progressSecs to 0', () => {
    const reset = resetFurnaceAfterOutputCollected(makeFurnace())
    expect(reset.progressSecs).toBe(0)
  })

  it('preserves position', () => {
    const reset = resetFurnaceAfterOutputCollected(makeFurnace())
    expect(reset.position).toEqual(POS)
  })
})

// ─── removeFurnaceAtPosition ──────────────────────────────────────────────────

describe('removeFurnaceAtPosition', () => {
  it('returns empty stacks and unchanged state when furnace is not found', () => {
    const [stacks, nextState] = removeFurnaceAtPosition(INITIAL_STATE, POS)
    expect(stacks).toHaveLength(0)
    expect(nextState).toBe(INITIAL_STATE)
  })

  it('returns the furnace item stacks and removes it from state', () => {
    const furnace = makeFurnace()
    const stateWithFurnace = {
      ...INITIAL_STATE,
      furnaces: HashMap.set(INITIAL_STATE.furnaces, `${POS.x},${POS.y},${POS.z}`, furnace),
    }
    const [stacks, nextState] = removeFurnaceAtPosition(stateWithFurnace, POS)
    expect(stacks).toHaveLength(3)
    expect(HashMap.size(nextState.furnaces)).toBe(0)
  })

  it('clears selectedFurnacePosition when it matches removed furnace', () => {
    const furnace = makeFurnace()
    const key = `${POS.x},${POS.y},${POS.z}`
    const stateWithSelected = {
      furnaces: HashMap.set(INITIAL_STATE.furnaces, key, furnace),
      selectedFurnacePosition: Option.some(POS),
    }
    const [, nextState] = removeFurnaceAtPosition(stateWithSelected, POS)
    expect(Option.isNone(nextState.selectedFurnacePosition)).toBe(true)
  })
})
