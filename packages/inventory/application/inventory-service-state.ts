import { Array as Arr, Option } from 'effect'
import type { InventoryItem, InventorySaveData, InventorySlotSaveEntry } from '@ts-minecraft/core'
import { SlotIndex } from '@ts-minecraft/core'
import { INVENTORY_SIZE, HOTBAR_START } from './inventory-service.config'
import { ItemStack, canMerge, maxStackFor, mergeStacks, removeFromStack, repairStackWithMendingXP } from '../domain/item-stack'
import type { InventorySlot, InventorySlots } from './inventory-service-types'
import { fillEmptySlots, fillExistingStacks, drainPreferredSlot } from './inventory-service.helpers'

const serializeInventorySlot = (slot: InventorySlot, index: number): InventorySaveData['slots'][number] =>
  Option.map(slot, (stack) => ({
    slot: SlotIndex.make(index),
    itemType: stack.itemType,
    count: stack.count,
    durability: stack.durability ?? null,
  }))

const hydrateInventorySlot = (entry: InventorySlotSaveEntry): InventorySlot =>
  Option.some(new ItemStack({ itemType: entry.itemType, count: entry.count, durability: entry.durability }))

export const serializeInventorySlots = (slots: InventorySlots): InventorySaveData => ({
  slots: Arr.makeBy(INVENTORY_SIZE, (index) =>
    serializeInventorySlot(Option.getOrElse(Arr.get(slots, index), () => Option.none<ItemStack>()), index),
  ),
})

export const deserializeInventorySlots = (data: InventorySaveData): InventorySlots =>
  Arr.reduce(
    data.slots,
    Arr.makeBy(INVENTORY_SIZE, () => Option.none<ItemStack>()),
    (acc, entry) => {
      const item = Option.getOrNull(entry)
      if (item === null) return acc
      const slotIndex = SlotIndex.toNumber(item.slot)
      if (slotIndex < 0 || slotIndex >= INVENTORY_SIZE) return acc
      return Arr.modify(acc, slotIndex, () => hydrateInventorySlot(item))
    },
  )

export const quickMoveInventorySlots = (slots: InventorySlots, from: SlotIndex): InventorySlots => {
  const fromIdx = SlotIndex.toNumber(from)
  const source = Option.getOrNull(Option.getOrElse(Arr.get(slots, fromIdx), () => Option.none<ItemStack>()))
  if (source === null) return slots

  const { itemType, count } = source
  const maxStack = maxStackFor(itemType)

  // Target region = the region the source slot is NOT in.
  const inHotbar = fromIdx >= HOTBAR_START
  const lo = inHotbar ? 0 : HOTBAR_START
  const hi = inHotbar ? HOTBAR_START : INVENTORY_SIZE

  const region = slots.slice(lo, hi)
  const [afterFill, rem1] = fillExistingStacks(region, itemType, count, maxStack)
  const [afterEmpty, rem2] = fillEmptySlots(afterFill, itemType, rem1, maxStack)
  const moved = count - rem2
  if (moved === 0) return slots

  const merged: InventorySlots = [...slots.slice(0, lo), ...afterEmpty, ...slots.slice(hi)]
  return Arr.modify(merged, fromIdx, () => removeFromStack(source, moved))
}

export const tryAddBlocksToInventory = (
  slots: InventorySlots,
  itemType: InventoryItem,
  count: number,
): readonly [boolean, InventorySlots] => {
  const maxStack = maxStackFor(itemType)
  const [afterFill, rem1] = fillExistingStacks(slots, itemType, count, maxStack)
  const [afterEmpty, rem2] = fillEmptySlots(afterFill, itemType, rem1, maxStack)
  const ok = rem2 === 0
  // Atomicity: only write new state if ALL items fit; otherwise roll back.
  return [ok, ok ? afterEmpty : slots] as const
}

export const moveStackInInventorySlots = (
  slots: InventorySlots,
  from: SlotIndex,
  to: SlotIndex,
): InventorySlots => {
  const fromIdx = SlotIndex.toNumber(from)
  const toIdx = SlotIndex.toNumber(to)

  if (fromIdx === toIdx) return slots

  const fromSlot = Option.getOrElse(Arr.get(slots, fromIdx), () => Option.none<ItemStack>())
  const toSlot = Option.getOrElse(Arr.get(slots, toIdx), () => Option.none<ItemStack>())

  const fromStack = Option.getOrNull(fromSlot)
  if (fromStack === null) return slots

  const toStack = Option.getOrNull(toSlot)
  if (toStack === null) {
    const withFromCleared = Arr.modify(slots, fromIdx, () => Option.none<ItemStack>())
    return Arr.modify(withFromCleared, toIdx, () => Option.some(fromStack))
  }

  if (canMerge(fromStack, toStack)) {
    const [merged, remainder] = mergeStacks(toStack, fromStack)
    const withFrom = Arr.modify(slots, fromIdx, () => remainder)
    return Arr.modify(withFrom, toIdx, () => Option.some(merged))
  }

  const withFrom = Arr.modify(slots, fromIdx, () => toSlot)
  return Arr.modify(withFrom, toIdx, () => fromSlot)
}

export const repairMendingInventorySlotsWithXP = (
  slots: InventorySlots,
  amount: number,
): readonly [number, InventorySlots] => {
  if (amount <= 0) return [amount, slots]
  const wholeXP = Math.floor(amount)
  const fractionalXP = amount - wholeXP
  let remainingXP = wholeXP
  let nextSlots = slots

  for (let i = 0; i < nextSlots.length && remainingXP > 0; i++) {
    const slot = Option.getOrElse(Arr.get(nextSlots, i), () => Option.none<ItemStack>())
    const stack = Option.getOrNull(slot)
    if (stack === null) continue
    const repaired = repairStackWithMendingXP(stack, remainingXP)
    if (repaired.xpUsed <= 0) continue
    remainingXP -= repaired.xpUsed
    nextSlots = Arr.modify(nextSlots, i, () => Option.some(repaired.stack))
  }

  return [remainingXP + fractionalXP, nextSlots]
}

export const removeBlocksFromInventory = (
  slots: InventorySlots,
  itemType: InventoryItem,
  count: number,
  preferredSlot?: SlotIndex,
): readonly [boolean, InventorySlots] => {
  const preferredIdx = Option.map(Option.fromNullable(preferredSlot), SlotIndex.toNumber)

  const takeFrom = (rem: number, stack: ItemStack): readonly [number, InventorySlot] => {
    if (stack.itemType !== itemType) return [rem, Option.some(stack)]
    const take = Math.min(stack.count, rem)
    return [rem - take, removeFromStack(stack, take)]
  }

  // Step 1: drain preferred slot first (if provided)
  const [rem1, slots1] = drainPreferredSlot(slots, itemType, count, preferredIdx)

  // Step 2: drain remaining from all other slots in order
  const preferredIdxNum = Option.getOrElse(preferredIdx, () => -1)
  const [rem2, slots2] = Arr.mapAccum(slots1, rem1, (rem, slot, idx) => {
    if (rem <= 0) return [rem, slot] as const
    if (idx === preferredIdxNum) return [rem, slot] as const
    const stack = Option.getOrNull(slot)
    return stack === null ? [rem, slot] as const : takeFrom(rem, stack)
  })

  const ok = rem2 === 0
  // Atomicity: only write new state if ALL items were removed; otherwise roll back.
  return [ok, ok ? slots2 : slots] as const
}
