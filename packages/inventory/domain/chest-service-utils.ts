import { Array as Arr, HashMap, Option } from 'effect'
import { CHEST_SIZE } from './chest-service.config'
import type { ChestBlockState } from './chest-state'

export type ChestState = {
  readonly chests: HashMap.HashMap<string, ChestBlockState>
  readonly selectedChestPosition: Option.Option<{ readonly x: number; readonly y: number; readonly z: number }>
}

export const INITIAL_CHEST_STATE: ChestState = {
  chests: HashMap.empty<string, ChestBlockState>(),
  selectedChestPosition: Option.none(),
}

export const chestKey = (position: { readonly x: number; readonly y: number; readonly z: number }): string => `${position.x},${position.y},${position.z}`

export const emptyChestAtPosition = (position: { readonly x: number; readonly y: number; readonly z: number }): ChestBlockState => ({
  position,
  slots: Arr.makeBy(CHEST_SIZE, () => Option.none()),
})

export const setChestState = (
  state: ChestState,
  chest: ChestBlockState,
): ChestState => ({
  chests: HashMap.set(state.chests, chestKey(chest.position), chest),
  selectedChestPosition: state.selectedChestPosition,
})
