import { Array as Arr, HashMap, Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/kernel'
import type { InventorySlot } from '@ts-minecraft/inventory'
import { SLOT_COLORS, DEFAULT_SLOT_COLOR, getTileImageUrl } from './inventory-renderer.config'

/* c8 ignore next 2 */
export const getSlotColor = (itemType: InventoryItem): string =>
  Option.getOrElse(Option.fromNullable(SLOT_COLORS[itemType]), () => DEFAULT_SLOT_COLOR)

export const getSlotImageStyle = (itemType: InventoryItem): string | null => {
  const url = getTileImageUrl(itemType)
  return url ? `url('${url}')` : null
}

export const collectAvailableCounts = (slots: ReadonlyArray<InventorySlot>): HashMap.HashMap<InventoryItem, number> =>
  Arr.reduce(slots, HashMap.empty<InventoryItem, number>(), (counts, slot) =>
    Option.match(slot, {
      onNone: () => counts,
      onSome: (stack) =>
        HashMap.set(
          counts,
          stack.itemType,
          Option.getOrElse(HashMap.get(counts, stack.itemType), () => 0) + stack.count,
        ),
    }),
  )
