import { Array as Arr, HashMap, Option } from 'effect'

import { CHEST_SIZE } from '../domain/chest-service.config'
import { ItemStack, canMerge, maxStackFor, mergeStacks, removeFromStack } from '../domain/item-stack'
import type { ChestItemStack } from '../domain/chest-state'
import { chestKey, type ChestState } from '../domain/chest-service-utils'

export const isValidChestIndex = (index: number): boolean =>
  Number.isInteger(index) && index >= 0 && index < CHEST_SIZE

export const moveBetweenSlots = (
  fromSlot: Option.Option<ItemStack>,
  toSlot: Option.Option<ItemStack>,
): readonly [Option.Option<ItemStack>, Option.Option<ItemStack>] => {
  const fromStack = Option.getOrNull(fromSlot)
  if (fromStack === null) return [fromSlot, toSlot]
  const toStack = Option.getOrNull(toSlot)
  if (toStack === null) return [Option.none(), Option.some(fromStack)]
  if (canMerge(fromStack, toStack)) {
    const [merged, remainder] = mergeStacks(toStack, fromStack)
    return [remainder, Option.some(merged)]
  }
  return [toSlot, fromSlot]
}

export const fillSlotsFromStack = (
  slots: ReadonlyArray<Option.Option<ItemStack>>,
  source: ItemStack,
): readonly [ReadonlyArray<Option.Option<ItemStack>>, Option.Option<ItemStack>] => {
  let remainder: Option.Option<ItemStack> = Option.some(source)
  let next = slots

  for (let index = 0; index < next.length; index += 1) {
    const sourceStack = Option.getOrNull(remainder)
    if (sourceStack === null) return [next, Option.none()]
    const target = Option.getOrNull(Option.flatten(Arr.get(next, index)))
    if (target === null || !canMerge(sourceStack, target)) continue
    const [merged, rest] = mergeStacks(target, sourceStack)
    next = Arr.modify(next, index, () => Option.some(merged))
    remainder = rest
  }

  for (let index = 0; index < next.length; index += 1) {
    const sourceStack = Option.getOrNull(remainder)
    if (sourceStack === null) return [next, Option.none()]
    const target = Option.getOrNull(Option.flatten(Arr.get(next, index)))
    if (target !== null) continue
    const moved = Math.min(sourceStack.count, maxStackFor(sourceStack.itemType))
    const placed = new ItemStack({
      itemType: sourceStack.itemType,
      count: moved,
      durability: sourceStack.durability,
      enchantments: sourceStack.enchantments,
    })
    next = Arr.modify(next, index, () => Option.some(placed))
    remainder = removeFromStack(sourceStack, moved)
  }

  return [next, remainder]
}

export const tryFillSlotsFromStacks = (
  slots: ReadonlyArray<Option.Option<ItemStack>>,
  sources: ReadonlyArray<ItemStack>,
): Option.Option<ReadonlyArray<Option.Option<ItemStack>>> => {
  let next = slots

  for (const source of sources) {
    const [filled, remainder] = fillSlotsFromStack(next, source)
    if (Option.isSome(remainder)) return Option.none()
    next = filled
  }

  return Option.some(next)
}

export const removeChestAtPosition = (
  state: ChestState,
  position: { readonly x: number; readonly y: number; readonly z: number },
): readonly [ReadonlyArray<ChestItemStack>, ChestState] => {
  const key = chestKey(position)
  const chest = Option.getOrNull(HashMap.get(state.chests, key))
  if (chest === null) return [[], state]
  const dropped = Arr.filterMap(chest.slots, (slot) => slot)
  return [
    dropped,
    {
      chests: HashMap.remove(state.chests, key),
      selectedChestPosition: Option.filter(state.selectedChestPosition, (selected) => chestKey(selected) !== key),
    },
  ]
}
