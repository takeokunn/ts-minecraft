import { Array as Arr, HashMap, Option } from 'effect'
import type { BlockType } from '@ts-minecraft/kernel'
import type { InventorySlot } from '@ts-minecraft/inventory'
import { SLOT_COLORS, DEFAULT_SLOT_COLOR } from './inventory-renderer.config'

/* c8 ignore next 2 */
export const getSlotColor = (blockType: BlockType): string =>
  Option.getOrElse(Option.fromNullable(SLOT_COLORS[blockType as BlockType]), () => DEFAULT_SLOT_COLOR)

export const collectAvailableCounts = (slots: ReadonlyArray<InventorySlot>): HashMap.HashMap<BlockType, number> =>
  Arr.reduce(slots, HashMap.empty<BlockType, number>(), (counts, slot) =>
    Option.match(slot, {
      onNone: () => counts,
      onSome: (stack) =>
        HashMap.set(
          counts,
          stack.blockType,
          Option.getOrElse(HashMap.get(counts, stack.blockType), () => 0) + stack.count,
        ),
    }),
  )
