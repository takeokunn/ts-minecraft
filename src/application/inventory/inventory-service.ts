import { Array as Arr, Effect, Ref, Option, Schema } from 'effect'
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
  count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
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
      const nonAirBlocks = Arr.take(Arr.filter(allBlocks, (b) => b.type !== 'AIR'), HOTBAR_SIZE)

      const initialSlots: InventorySlots = Arr.makeBy(INVENTORY_SIZE, (i) => {
        const hotbarIndex = i - HOTBAR_START
        if (i >= HOTBAR_START) {
          return Option.map(Arr.get(nonAirBlocks, hotbarIndex), (block) => createStack(block.type, MAX_STACK_SIZE))
        }
        return Option.none()
      })

      const slotsRef = yield* Ref.make<InventorySlots>(initialSlots)

      const getSlot = (index: SlotIndex): Effect.Effect<InventorySlot, never> =>
        Ref.get(slotsRef).pipe(Effect.map((slots) => Option.getOrElse(Arr.get(slots, SlotIndex.toNumber(index)), () => Option.none<ItemStack>())))

      const setSlot = (index: SlotIndex, stack: InventorySlot): Effect.Effect<void, never> =>
        Ref.update(slotsRef, Arr.modify(SlotIndex.toNumber(index), () => stack))

      const moveStack = (from: SlotIndex, to: SlotIndex): Effect.Effect<void, never> =>
        Ref.update(slotsRef, (slots) => {
          const fromIdx = SlotIndex.toNumber(from)
          const toIdx = SlotIndex.toNumber(to)

          if (from === to) return slots

          const fromSlot = Option.getOrElse(Arr.get(slots, fromIdx), () => Option.none<ItemStack>())
          const toSlot = Option.getOrElse(Arr.get(slots, toIdx), () => Option.none<ItemStack>())

          return Option.match(fromSlot, {
            onNone: () => slots,
            onSome: (from) => {
              const [newFromSlot, newToSlot] = Option.match(toSlot, {
                onNone: () => [Option.none<ItemStack>(), Option.some(from)] as const,
                onSome: (to) => canMerge(from, to)
                  ? (() => {
                      // Merge stacks
                      const [merged, remainder] = mergeStacks(to, from)
                      return [remainder, Option.some(merged)] as const
                    })()
                  // Swap
                  : [toSlot, fromSlot] as const,
              })
              const withFrom = Arr.modify(slots, fromIdx, () => newFromSlot)
              return Arr.modify(withFrom, toIdx, () => newToSlot)
            },
          })
        })

      const addBlock = (blockType: BlockType, count: number): Effect.Effect<boolean, never> =>
        Ref.modify(slotsRef, (slots) => {
          // First pass: fill existing partial stacks
          const [remaining1, slots1] = Arr.mapAccum(slots, count, (rem, slot) => {
            if (rem <= 0) return [rem, slot] as const
            return Option.match(slot, {
              onNone: () => [rem, slot] as const,
              onSome: (stackVal) => {
                if (!canMerge(stackVal, { blockType, count: 1 })) return [rem, slot] as const
                const space = MAX_STACK_SIZE - stackVal.count
                if (space <= 0) return [rem, slot] as const
                const add = Math.min(space, rem)
                return [rem - add, Option.some(addToStack(stackVal, add))] as const
              },
            })
          })

          // Second pass: fill empty slots
          const [remaining2, slots2] = Arr.mapAccum(slots1, remaining1, (rem, slot) => {
            if (rem <= 0) return [rem, slot] as const
            return Option.match(slot, {
              onSome: () => [rem, slot] as const,
              onNone: () => {
                const add = Math.min(MAX_STACK_SIZE, rem)
                return [rem - add, Option.some(createStack(blockType, add))] as const
              },
            })
          })

          return [remaining2 === 0, slots2]
        })

      const removeBlock = (blockType: BlockType, count: number): Effect.Effect<boolean, never> =>
        Ref.modify(slotsRef, (slots) => {
          const [remaining, result] = Arr.mapAccum(slots, count, (rem, slot) => {
            if (rem <= 0) return [rem, slot] as const
            return Option.match(slot, {
              onNone: () => [rem, slot] as const,
              onSome: (stackVal) => {
                if (stackVal.blockType !== blockType) return [rem, slot] as const
                const take = Math.min(stackVal.count, rem)
                return [rem - take, removeFromStack(stackVal, take)] as const
              },
            })
          })
          return [remaining === 0, result]
        })

      const getHotbarSlots = (): Effect.Effect<ReadonlyArray<InventorySlot>, never> =>
        Ref.get(slotsRef).pipe(Effect.map((slots) => Arr.take(Arr.drop(slots, HOTBAR_START), HOTBAR_SIZE)))

      const getAllSlots = (): Effect.Effect<InventorySlots, never> =>
        Ref.get(slotsRef)

      const serialize = (): Effect.Effect<InventorySaveData, never> =>
        Ref.get(slotsRef).pipe(
          Effect.map((slots) => ({
            slots: Arr.map(slots, (slot, i) =>
              Option.match(slot, {
                onSome: (stack) => ({ slot: SlotIndex.make(i), blockType: stack.blockType, count: stack.count }),
                onNone: () => null,
              })
            ),
          }))
        )

      const deserialize = (data: InventorySaveData): Effect.Effect<void, never> =>
        Ref.update(slotsRef, (slots) =>
          Arr.reduce(data.slots, slots, (acc, entry) =>
            Option.match(Option.fromNullable(entry), {
              onNone: () => acc,
              onSome: (e) => {
                const i = SlotIndex.toNumber(e.slot)
                return i >= 0 && i < INVENTORY_SIZE
                  ? Arr.modify(acc, i, () => Option.some(createStack(e.blockType, e.count)))
                  : acc
              },
            })
          )
        )

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
