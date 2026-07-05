import { Array as Arr, HashMap, Option } from 'effect'
import { StackCount } from '@ts-minecraft/core'
import { CHEST_SIZE } from './chest-service.config'
import type { ChestBlockState, ChestItemStack } from './chest-state'

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

// Max per-slot stack inside chests (vanilla 64; durables never merge).
const CHEST_MAX_STACK = 64

// Pure deposit: merge into existing same-type non-durable stacks first, then
// fill empty slots. Returns the updated chest and how many items fit.
export const depositIntoChest = (
  chest: ChestBlockState,
  itemType: ChestItemStack['itemType'],
  count: number,
): { readonly chest: ChestBlockState; readonly deposited: number } => {
  if (count <= 0) return { chest, deposited: 0 }
  let remaining = count
  const slots = [...chest.slots]

  for (let i = 0; i < slots.length && remaining > 0; i++) {
    const slot = Option.getOrNull(slots[i]!)
    if (slot === null || slot.itemType !== itemType || slot.durability !== null) continue
    const capacity = CHEST_MAX_STACK - slot.count
    if (capacity <= 0) continue
    const moved = Math.min(capacity, remaining)
    slots[i] = Option.some({ ...slot, count: StackCount.make(slot.count + moved) })
    remaining -= moved
  }

  for (let i = 0; i < slots.length && remaining > 0; i++) {
    if (Option.isSome(slots[i]!)) continue
    const moved = Math.min(CHEST_MAX_STACK, remaining)
    slots[i] = Option.some({ itemType, count: StackCount.make(moved), durability: null })
    remaining -= moved
  }

  return { chest: { ...chest, slots }, deposited: count - remaining }
}

// Pure withdraw: removes ONE item from the first occupied slot. Returns the
// updated chest and the item taken (None when the chest is empty).
export const takeOneFromChest = (
  chest: ChestBlockState,
): { readonly chest: ChestBlockState; readonly taken: Option.Option<ChestItemStack['itemType']> } => {
  const slots = [...chest.slots]
  for (let i = 0; i < slots.length; i++) {
    const slot = Option.getOrNull(slots[i]!)
    if (slot === null) continue
    slots[i] = slot.count > 1 ? Option.some({ ...slot, count: StackCount.make(slot.count - 1) }) : Option.none()
    return { chest: { ...chest, slots }, taken: Option.some(slot.itemType) }
  }
  return { chest, taken: Option.none() }
}
