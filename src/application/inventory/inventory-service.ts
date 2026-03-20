import { Effect, Ref, Option, Schema } from 'effect'
import type { BlockType } from '@/domain/block'
import { BlockRegistry } from '@/domain/block-registry'
import { BlockTypeSchema } from '@/domain/block'
import { ItemStack, createStack, mergeStacks, canMerge, MAX_STACK_SIZE, addToStack, removeFromStack } from '@/domain/item-stack'
import { SlotIndex, SlotIndexSchema } from '@/shared/kernel'

export type InventorySlot = Option.Option<ItemStack>
export type InventorySlots = ReadonlyArray<InventorySlot>

export const INVENTORY_SIZE = 36
export const HOTBAR_START = 27
export const HOTBAR_SIZE = 9

const InventorySlotSaveEntrySchema = Schema.Struct({
  slot: SlotIndexSchema,
  blockType: BlockTypeSchema,   // Use typed schema for runtime type safety
  count: Schema.Number,
})
export const InventorySaveDataSchema = Schema.Struct({
  slots: Schema.Array(Schema.NullOr(InventorySlotSaveEntrySchema)),
})
export type InventorySaveData = Schema.Schema.Type<typeof InventorySaveDataSchema>

export class InventoryService extends Effect.Service<InventoryService>()(
  '@minecraft/application/InventoryService',
  {
    effect: Effect.gen(function* () {
      const blockRegistry = yield* BlockRegistry

      // Build initial slots: empty for main grid (0-26), one of each non-AIR block for hotbar (27-35)
      const allBlocks = yield* blockRegistry.getAll()
      const nonAirBlocks = allBlocks.filter((b) => b.type !== 'AIR').slice(0, HOTBAR_SIZE)

      const initialSlots: InventorySlot[] = Array.from({ length: INVENTORY_SIZE }, (_, i) => {
        const hotbarIndex = i - HOTBAR_START
        if (i >= HOTBAR_START && hotbarIndex < nonAirBlocks.length) {
          const block = nonAirBlocks[hotbarIndex]
          return block ? Option.some(createStack(block.type, MAX_STACK_SIZE)) : Option.none()
        }
        return Option.none()
      })

      const slotsRef = yield* Ref.make<InventorySlot[]>(initialSlots)

      const getSlot = (index: SlotIndex): Effect.Effect<InventorySlot, never> =>
        Ref.get(slotsRef).pipe(Effect.map((slots) => slots[SlotIndex.toNumber(index)] ?? Option.none()))

      const setSlot = (index: SlotIndex, stack: InventorySlot): Effect.Effect<void, never> =>
        Ref.update(slotsRef, (slots) => {
          const next = [...slots]
          next[SlotIndex.toNumber(index)] = stack
          return next
        })

      const moveStack = (from: SlotIndex, to: SlotIndex): Effect.Effect<void, never> =>
        Ref.update(slotsRef, (slots) => {
          const next = [...slots]
          if (from === to) return next
          const fromSlot = next[SlotIndex.toNumber(from)] ?? Option.none()
          const toSlot = next[SlotIndex.toNumber(to)] ?? Option.none()

          if (Option.isNone(fromSlot)) return next

          const toIdx = SlotIndex.toNumber(to)
          const fromIdx = SlotIndex.toNumber(from)

          if (Option.isNone(toSlot)) {
            // Move to empty slot
            next[toIdx] = fromSlot
            next[fromIdx] = Option.none()
          } else if (canMerge(fromSlot.value, toSlot.value)) {
            // Merge stacks
            const [merged, remainder] = mergeStacks(toSlot.value, fromSlot.value)
            next[toIdx] = Option.some(merged)
            next[fromIdx] = remainder
          } else {
            // Swap
            next[toIdx] = fromSlot
            next[fromIdx] = toSlot
          }
          return next
        })

      const addBlock = (blockType: BlockType, count: number): Effect.Effect<boolean, never> =>
        Ref.modify(slotsRef, (slots) => {
          const next = [...slots]
          let remaining = count

          // First pass: fill existing partial stacks
          for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
            const slot = next[i]
            if (slot && Option.isSome(slot) && canMerge(slot.value, { blockType, count: 1 })) {
              const space = MAX_STACK_SIZE - slot.value.count
              if (space > 0) {
                const add = Math.min(space, remaining)
                next[i] = Option.some(addToStack(slot.value, add))
                remaining -= add
              }
            }
          }

          // Second pass: fill empty slots
          for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
            const slot = next[i]
            if (!slot || Option.isNone(slot)) {
              const add = Math.min(MAX_STACK_SIZE, remaining)
              next[i] = Option.some(createStack(blockType, add))
              remaining -= add
            }
          }

          return [remaining === 0, next]
        })

      const removeBlock = (blockType: BlockType, count: number): Effect.Effect<boolean, never> =>
        Ref.modify(slotsRef, (slots) => {
          const next = [...slots]
          let remaining = count

          for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
            const slot = next[i]
            if (slot && Option.isSome(slot) && slot.value.blockType === blockType) {
              const take = Math.min(slot.value.count, remaining)
              const updated = removeFromStack(slot.value, take)
              next[i] = updated
              remaining -= take
            }
          }

          return [remaining === 0, next]
        })

      const getHotbarSlots = (): Effect.Effect<ReadonlyArray<InventorySlot>, never> =>
        Ref.get(slotsRef).pipe(Effect.map((slots) => slots.slice(HOTBAR_START, HOTBAR_START + HOTBAR_SIZE)))

      const getAllSlots = (): Effect.Effect<InventorySlots, never> =>
        Ref.get(slotsRef)

      const serialize = (): Effect.Effect<InventorySaveData, never> =>
        Ref.get(slotsRef).pipe(
          Effect.map((slots) => ({
            slots: slots.map((slot, i) =>
              Option.isSome(slot)
                ? { slot: SlotIndex.make(i), blockType: slot.value.blockType, count: slot.value.count }
                : null
            ),
          }))
        )

      const deserialize = (data: InventorySaveData): Effect.Effect<void, never> =>
        Ref.update(slotsRef, (slots) => {
          const next = [...slots]
          for (const entry of data.slots) {
            if (entry && entry.slot >= 0 && entry.slot < INVENTORY_SIZE) {
              next[entry.slot] = Option.some(createStack(entry.blockType as BlockType, entry.count))
            }
          }
          return next
        })

      return {
        getSlot,
        setSlot,
        moveStack,
        addBlock,
        removeBlock,
        getHotbarSlots,
        getAllSlots,
        serialize,
        deserialize,
      }
    }),
  }
) {}

export const InventoryServiceLive = InventoryService.Default
