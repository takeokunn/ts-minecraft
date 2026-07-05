import { Option } from 'effect'
import { StackCount } from '@ts-minecraft/core'
import { formatLabel } from './inventory-renderer-refresh'
import { addToStack, canMerge, ItemStack, maxStackFor, mergeStacks, removeFromStack } from '@ts-minecraft/inventory/domain/item-stack'
import type { InventorySlot } from '@ts-minecraft/inventory/application/inventory-service'

export type InventoryCursorClickButton = 'primary' | 'secondary'

export type InventoryCursorClickState = {
  readonly slot: InventorySlot
  readonly cursor: InventorySlot
}

export type InventoryCursorReturnState = {
  readonly slots: ReadonlyArray<InventorySlot>
  readonly cursor: InventorySlot
}

const cloneStackWithCount = (stack: ItemStack, count: number): ItemStack =>
  new ItemStack({
    itemType: stack.itemType,
    count: StackCount.make(count),
    durability: stack.durability,
    enchantments: stack.enchantments,
  })

const pickHalf = (stack: ItemStack): readonly [InventorySlot, InventorySlot] => {
  const picked = Math.ceil(stack.count / 2)
  return [removeFromStack(stack, picked), Option.some(cloneStackWithCount(stack, picked))]
}

const placeOneFromCursor = (cursorStack: ItemStack): readonly [InventorySlot, InventorySlot] =>
  [Option.some(cloneStackWithCount(cursorStack, 1)), removeFromStack(cursorStack, 1)]

const placeCursorStackIntoSlot = (slot: InventorySlot, cursorStack: ItemStack): readonly [InventorySlot, InventorySlot] => {
  const slotStack = Option.getOrNull(slot)
  if (slotStack === null) {
    return [Option.some(cursorStack), Option.none()]
  }

  if (!canMerge(slotStack, cursorStack) || slotStack.count >= maxStackFor(slotStack.itemType)) {
    return [slot, Option.some(cursorStack)]
  }

  const [mergedSlot, remainderCursor] = mergeStacks(slotStack, cursorStack)
  return [Option.some(mergedSlot), remainderCursor]
}

const returnCursorAcrossSlots = (
  slots: ReadonlyArray<InventorySlot>,
  cursor: InventorySlot,
  shouldUseSlot: (slot: InventorySlot, cursorStack: ItemStack) => boolean,
): InventoryCursorReturnState => {
  let remaining = cursor
  const nextSlots = slots.slice()

  for (let index = 0; index < nextSlots.length && Option.isSome(remaining); index += 1) {
    const cursorStack = Option.getOrNull(remaining)
    if (cursorStack === null) {
      break
    }

    const slot = nextSlots[index] ?? Option.none()
    if (!shouldUseSlot(slot, cursorStack)) {
      continue
    }

    const [nextSlot, nextCursor] = placeCursorStackIntoSlot(slot, cursorStack)
    nextSlots[index] = nextSlot
    remaining = nextCursor
  }

  return { slots: nextSlots, cursor: remaining }
}

export const returnInventoryCursorToSlots = (
  slots: ReadonlyArray<InventorySlot>,
  cursor: InventorySlot,
): InventoryCursorReturnState => {
  if (Option.isNone(cursor)) {
    return { slots, cursor }
  }

  const merged = returnCursorAcrossSlots(slots, cursor, (slot, cursorStack) => {
    const slotStack = Option.getOrNull(slot)
    return slotStack !== null && canMerge(slotStack, cursorStack) && slotStack.count < maxStackFor(slotStack.itemType)
  })

  if (Option.isNone(merged.cursor)) {
    return merged
  }

  return returnCursorAcrossSlots(merged.slots, merged.cursor, (slot) => Option.isNone(slot))
}

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
    onSome: (stack) => `Holding ${stack.count} ${formatLabel(stack.itemType)}.`,
  })
