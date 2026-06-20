import { Option } from 'effect'
import { addToStack, canMerge, ItemStack, maxStackFor, mergeStacks, removeFromStack } from '@ts-minecraft/inventory/domain/item-stack'
import type { InventorySlot } from '@ts-minecraft/inventory/application/inventory-service'

export type InventoryCursorClickButton = 'primary' | 'secondary'

export type InventoryCursorClickState = {
  readonly slot: InventorySlot
  readonly cursor: InventorySlot
}

const cloneStackWithCount = (stack: ItemStack, count: number): ItemStack =>
  new ItemStack({
    itemType: stack.itemType,
    count,
    durability: stack.durability,
    enchantments: stack.enchantments,
  })

const pickHalf = (stack: ItemStack): readonly [InventorySlot, InventorySlot] => {
  const picked = Math.ceil(stack.count / 2)
  return [removeFromStack(stack, picked), Option.some(cloneStackWithCount(stack, picked))]
}

const placeOneFromCursor = (cursorStack: ItemStack): readonly [InventorySlot, InventorySlot] =>
  [Option.some(cloneStackWithCount(cursorStack, 1)), removeFromStack(cursorStack, 1)]

const applyPrimaryClick = ({ slot, cursor }: InventoryCursorClickState): InventoryCursorClickState => {
  const slotStack = Option.getOrNull(slot)
  const cursorStack = Option.getOrNull(cursor)

  if (slotStack === null && cursorStack === null) return { slot, cursor }
  if (cursorStack === null) return { slot: Option.none(), cursor: slot }
  if (slotStack === null) return { slot: cursor, cursor: Option.none() }
  if (canMerge(slotStack, cursorStack)) {
    const [mergedSlot, remainderCursor] = mergeStacks(slotStack, cursorStack)
    return { slot: Option.some(mergedSlot), cursor: remainderCursor }
  }
  return { slot: cursor, cursor: slot }
}

const applySecondaryClick = ({ slot, cursor }: InventoryCursorClickState): InventoryCursorClickState => {
  const slotStack = Option.getOrNull(slot)
  const cursorStack = Option.getOrNull(cursor)

  if (slotStack === null && cursorStack === null) return { slot, cursor }
  if (cursorStack === null && slotStack !== null) {
    const [nextSlot, nextCursor] = pickHalf(slotStack)
    return { slot: nextSlot, cursor: nextCursor }
  }
  if (cursorStack === null) return { slot, cursor }
  if (slotStack === null) {
    const [nextSlot, nextCursor] = placeOneFromCursor(cursorStack)
    return { slot: nextSlot, cursor: nextCursor }
  }
  if (canMerge(slotStack, cursorStack) && slotStack.count < maxStackFor(slotStack.itemType)) {
    return { slot: Option.some(addToStack(slotStack, 1)), cursor: removeFromStack(cursorStack, 1) }
  }
  return { slot, cursor }
}

export const applyInventoryCursorClick = (
  state: InventoryCursorClickState,
  button: InventoryCursorClickButton,
): InventoryCursorClickState =>
  button === 'primary' ? applyPrimaryClick(state) : applySecondaryClick(state)

export const describeInventoryCursor = (cursor: InventorySlot): string =>
  Option.match(cursor, {
    onNone: () => 'Cursor empty.',
    onSome: (stack) => `Holding ${stack.count} ${stack.itemType}.`,
  })
