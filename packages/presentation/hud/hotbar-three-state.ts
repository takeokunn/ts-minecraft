import { Array as Arr, Option } from 'effect'
import { InventoryItem, SlotIndex, type StackCount } from '@ts-minecraft/core'
import type { HotbarSlotStack } from '@ts-minecraft/inventory/application/hotbar-service'

export const HOTBAR_SLOTS = 9

// Plain-null (not Option) in the render-state hot path is deliberate: this
// module runs every frame and the repo's perf policy avoids per-frame Option
// allocation. The branded StackCount preserves the domain invariant instead.
export type HotbarSlotValue = { readonly item: InventoryItem; readonly count: StackCount } | null

export type HotbarState = {
  readonly slots: ReadonlyArray<HotbarSlotValue>
  readonly selectedIndex: number
  readonly selectedItemKey: InventoryItem | ''
  readonly hasState: boolean
}

export type HotbarUpdateDecision = {
  readonly selectedIndex: number
  readonly selectedItem: HotbarSlotValue
  readonly selectedItemKey: InventoryItem | ''
  readonly sameSelection: boolean
  readonly slotsChanged: boolean
  readonly unchanged: boolean
  readonly shouldShowItemName: boolean
  readonly heldItemChanged: boolean
  readonly nextState: HotbarState
}

export const EMPTY_HOTBAR_VALUES = Arr.makeBy(HOTBAR_SLOTS, () => null)

export const slotValueAt = (slots: ReadonlyArray<Option.Option<HotbarSlotStack>>, index: number): HotbarSlotValue => {
  const slot = slots[index]
  return slot !== undefined && Option.isSome(slot) ? { item: slot.value.itemType, count: slot.value.count } : null
}

export const captureSlotValues = (slots: ReadonlyArray<Option.Option<HotbarSlotStack>>): ReadonlyArray<HotbarSlotValue> =>
  Arr.makeBy(HOTBAR_SLOTS, (index) => slotValueAt(slots, index))

// Count participates in the comparison so stack-size changes (place/pickup of
// the same item) re-render the slot strip — the count badge must track them.
export const slotsMatchSnapshot = (
  currentSlots: ReadonlyArray<Option.Option<HotbarSlotStack>>,
  snapshot: ReadonlyArray<HotbarSlotValue>,
): boolean => {
  if (snapshot.length !== HOTBAR_SLOTS) return false
  for (let index = 0; index < HOTBAR_SLOTS; index++) {
    const current = slotValueAt(currentSlots, index)
    const prev = snapshot[index] ?? null
    if (current === null || prev === null) {
      if (current !== prev) return false
      continue
    }
    if (current.item !== prev.item || current.count !== prev.count) {
      return false
    }
  }
  return true
}

export const resolveHotbarUpdate = (
  slots: ReadonlyArray<Option.Option<HotbarSlotStack>>,
  selectedSlot: SlotIndex,
  prevState: HotbarState,
): HotbarUpdateDecision => {
  const selectedIndex = SlotIndex.toNumber(selectedSlot)
  const selectedItem = slotValueAt(slots, selectedIndex)
  const selectedItemKey = selectedItem?.item ?? ''
  const sameSelection = prevState.selectedIndex === selectedIndex
  const slotsChanged = !prevState.hasState || !slotsMatchSnapshot(slots, prevState.slots)
  const unchanged = prevState.hasState && sameSelection && !slotsChanged
  const shouldShowItemName = prevState.hasState && (!sameSelection || prevState.selectedItemKey !== selectedItemKey)
  const heldItemChanged = !prevState.hasState || prevState.selectedItemKey !== selectedItemKey

  return {
    selectedIndex,
    selectedItem,
    selectedItemKey,
    sameSelection,
    slotsChanged,
    unchanged,
    shouldShowItemName,
    heldItemChanged,
    nextState: {
      slots: slotsChanged ? captureSlotValues(slots) : prevState.slots,
      selectedIndex,
      selectedItemKey,
      hasState: true,
    },
  }
}
