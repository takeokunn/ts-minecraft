import { Array as Arr, HashMap, Option } from 'effect'

import type { FurnaceBlockState, FurnaceItemStack } from '../domain/furnace-state'
import { furnaceKey, type FurnaceState } from '../domain/furnace-service-utils'

const removeSelectedFurnacePosition = (
  selectedFurnacePosition: FurnaceState['selectedFurnacePosition'],
  key: string,
): FurnaceState['selectedFurnacePosition'] =>
  Option.filter(selectedFurnacePosition, (selected) => furnaceKey(selected) !== key)

export const getFurnaceItemStacks = (furnace: FurnaceBlockState): ReadonlyArray<FurnaceItemStack> =>
  Arr.filterMap([furnace.input, furnace.fuel, furnace.output], (slot) => slot)

export const resetFurnaceAfterOutputCollected = (furnace: FurnaceBlockState): FurnaceBlockState => ({
  ...furnace,
  input: Option.none(),
  fuel: Option.none(),
  output: Option.none(),
  progressSecs: 0,
})

export const removeFurnaceAtPosition = (
  state: FurnaceState,
  position: { readonly x: number; readonly y: number; readonly z: number },
): readonly [ReadonlyArray<FurnaceItemStack>, FurnaceState] => {
  const key = furnaceKey(position)
  const furnace = Option.getOrNull(HashMap.get(state.furnaces, key))
  if (furnace === null) return [[], state]
  return [
    getFurnaceItemStacks(furnace),
    {
      furnaces: HashMap.remove(state.furnaces, key),
      selectedFurnacePosition: removeSelectedFurnacePosition(state.selectedFurnacePosition, key),
    },
  ]
}
