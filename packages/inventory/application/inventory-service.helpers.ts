import { Array as Arr, Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import { ItemStack, createStack, addToStack, removeFromStack } from '../domain/item-stack'
import type { InventorySlot, InventorySlots } from './inventory-service'

// Pure: fills existing partial stacks of the same item type, returns [updatedSlots, remainingCount]
export const fillExistingStacks = (
  slots: InventorySlots,
  itemType: InventoryItem,
  count: number,
  maxStack: number,
): readonly [InventorySlots, number] => {
  const [remaining, updated] = Arr.mapAccum(slots, count, (rem, slot) => {
    if (rem <= 0) return [rem, slot] as const
    const stackVal = Option.getOrNull(slot)
    if (stackVal === null) return [rem, slot] as const
    if (stackVal.itemType !== itemType) return [rem, slot] as const
    const space = maxStack - stackVal.count
    if (space <= 0) return [rem, slot] as const
    const add = Math.min(space, rem)
    return [rem - add, Option.some(addToStack(stackVal, add))] as const
  })
  return [updated, remaining]
}

// Pure: drains `count` of `itemType` from the preferred slot (if provided and matching).
// Returns [remainingCount, updatedSlots].
export const drainPreferredSlot = (
  slots: InventorySlots,
  itemType: InventoryItem,
  count: number,
  preferredIdx: Option.Option<number>,
): readonly [number, InventorySlots] => {
  const takeFrom = (rem: number, stack: ItemStack): readonly [number, InventorySlot] => {
    if (stack.itemType !== itemType) return [rem, Option.some(stack)]
    const take = Math.min(stack.count, rem)
    return [rem - take, removeFromStack(stack, take)]
  }
  const idx = Option.getOrNull(preferredIdx)
  if (idx === null) return [count, slots]
  const stack = Option.getOrNull(Option.flatten(Arr.get(slots, idx)))
  if (stack === null) return [count, slots]
  const [newRem, newSlot] = takeFrom(count, stack)
  return [newRem, Arr.modify(slots, idx, () => newSlot)]
}

// Pure: fills empty slots with remaining count, returns [updatedSlots, remainingCount]
export const fillEmptySlots = (
  slots: InventorySlots,
  itemType: InventoryItem,
  count: number,
  maxStack: number,
): readonly [InventorySlots, number] => {
  const [remaining, updated] = Arr.mapAccum(slots, count, (rem, slot) => {
    if (rem <= 0) return [rem, slot] as const
    if (Option.isSome(slot)) return [rem, slot] as const
    const add = Math.min(maxStack, rem)
    return [rem - add, Option.some(createStack(itemType, add))] as const
  })
  return [updated, remaining]
}
