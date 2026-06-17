import { Array as Arr, HashMap, Option } from 'effect'
import type { FurnaceBlockState } from '../domain/furnace-state'
import { type FurnaceState, furnaceKey } from '../domain/furnace-service-utils'

export const serializeFurnaceState = (state: FurnaceState): ReadonlyArray<FurnaceBlockState> =>
  Arr.fromIterable(HashMap.values(state.furnaces))

export const deserializeFurnaceState = (serialized: ReadonlyArray<FurnaceBlockState>): FurnaceState => ({
  furnaces: HashMap.fromIterable(
    Arr.map(serialized, (furnace) => [furnaceKey(furnace.position), furnace] as const),
  ),
  selectedFurnacePosition: Option.none(),
})
