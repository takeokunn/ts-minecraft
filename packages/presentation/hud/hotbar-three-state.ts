import { Array as Arr, Option } from 'effect'
import { InventoryItem, SlotIndex } from '@ts-minecraft/core'

export const HOTBAR_SLOTS = 9

export type HotbarSlotValue = InventoryItem | null

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

export const slotValueAt = (slots: ReadonlyArray<Option.Option<InventoryItem>>, index: number): HotbarSlotValue => {
  const slot = slots[index]
  return slot !== undefined && Option.isSome(slot) ? slot.value : null
}

export const captureSlotValues = (slots: ReadonlyArray<Option.Option<InventoryItem>>): ReadonlyArray<HotbarSlotValue> =>
  Arr.makeBy(HOTBAR_SLOTS, (index) => slotValueAt(slots, index))

export const slotsMatchSnapshot = (
  currentSlots: ReadonlyArray<Option.Option<InventoryItem>>,
  snapshot: ReadonlyArray<HotbarSlotValue>,
): boolean => {
  if (snapshot.length !== HOTBAR_SLOTS) return false
  for (let index = 0; index < HOTBAR_SLOTS; index++) {
    if (slotValueAt(currentSlots, index) !== snapshot[index]) {
      return false
    }
  }
  return true
}

export const resolveHotbarUpdate = (
  slots: ReadonlyArray<Option.Option<InventoryItem>>,
  selectedSlot: SlotIndex,
  prevState: HotbarState,
): HotbarUpdateDecision => {
  const selectedIndex = SlotIndex.toNumber(selectedSlot)
  const selectedItem = slotValueAt(slots, selectedIndex)
  const selectedItemKey = selectedItem ?? ''
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
