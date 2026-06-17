import { describe, expect, it } from '@effect/vitest'
import { HashMap, Option } from 'effect'

import { RecipeId } from '@ts-minecraft/core'
import type { FurnaceBlockState, FurnaceItemStack } from '../domain/furnace-state'
import { furnaceKey, INITIAL_STATE, type FurnaceState } from '../domain/furnace-service-utils'
import { getFurnaceItemStacks, removeFurnaceAtPosition, resetFurnaceAfterOutputCollected } from '../application/furnace-service-state'

const makeStack = (itemType: FurnaceItemStack['itemType'], count: number): FurnaceItemStack => ({
  itemType,
  count,
})

const makeFurnace = (position: FurnaceBlockState['position']): FurnaceBlockState => ({
  position,
  input: Option.some(makeStack('IRON_ORE', 1)),
  fuel: Option.some(makeStack('COAL', 2)),
  output: Option.some(makeStack('IRON_INGOT', 3)),
  activeRecipeId: Option.some(RecipeId.make('smelt_iron_ore')),
  progressSecs: 7,
  burnRemainingSecs: 11,
  burnTotalSecs: 13,
})

describe('inventory/furnace-service-state', () => {
  it('returns occupied furnace slots in order', () => {
    const furnace = makeFurnace({ x: 1, y: 64, z: -2 })

    expect(getFurnaceItemStacks(furnace)).toEqual([
      { itemType: 'IRON_ORE', count: 1 },
      { itemType: 'COAL', count: 2 },
      { itemType: 'IRON_INGOT', count: 3 },
    ])
  })

  it('resets output collection state without touching burn metadata', () => {
    const furnace = makeFurnace({ x: 4, y: 32, z: 8 })

    expect(resetFurnaceAfterOutputCollected(furnace)).toEqual({
      position: { x: 4, y: 32, z: 8 },
      input: Option.none(),
      fuel: Option.none(),
      output: Option.none(),
      activeRecipeId: Option.some('smelt_iron_ore'),
      progressSecs: 0,
      burnRemainingSecs: 11,
      burnTotalSecs: 13,
    })
  })

  it('removes an existing furnace and clears matching selection', () => {
    const position = { x: 10, y: 64, z: 20 }
    const key = furnaceKey(position)
    const furnace = makeFurnace(position)
    const state: FurnaceState = {
      furnaces: HashMap.set(INITIAL_STATE.furnaces, key, furnace),
      selectedFurnacePosition: Option.some(position),
    }

    const [dropped, nextState] = removeFurnaceAtPosition(state, position)

    expect(dropped).toEqual([
      { itemType: 'IRON_ORE', count: 1 },
      { itemType: 'COAL', count: 2 },
      { itemType: 'IRON_INGOT', count: 3 },
    ])
    expect(Option.isNone(HashMap.get(nextState.furnaces, key))).toBe(true)
    expect(Option.isNone(nextState.selectedFurnacePosition)).toBe(true)
  })

  it('returns the original state unchanged when the furnace does not exist', () => {
    const position = { x: -3, y: 11, z: 7 }

    const [dropped, nextState] = removeFurnaceAtPosition(INITIAL_STATE, position)

    expect(dropped).toEqual([])
    expect(nextState).toBe(INITIAL_STATE)
  })
})
