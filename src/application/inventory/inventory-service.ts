import { Effect, Context, Layer, Ref, Option } from 'effect'
import type { BlockType } from '@/domain/block'
import { BlockRegistry } from '@/domain/blockRegistry'
import { ItemStack, createStack, mergeStacks, canMerge, MAX_STACK_SIZE, addToStack, removeFromStack } from '@/domain/item-stack'

export type InventorySlot = Option.Option<ItemStack>
export type InventorySlots = ReadonlyArray<InventorySlot>

export const INVENTORY_SIZE = 36
export const HOTBAR_START = 27
export const HOTBAR_SIZE = 9

/**
 * Save data format for inventory serialization
 */
export interface InventorySaveData {
  readonly slots: ReadonlyArray<{ slot: number; blockType: string; count: number } | null>
}

export interface InventoryService {
  readonly getSlot: (index: number) => Effect.Effect<InventorySlot, never>
  readonly setSlot: (index: number, stack: InventorySlot) => Effect.Effect<void, never>
  readonly moveStack: (from: number, to: number) => Effect.Effect<void, never>
  readonly addBlock: (blockType: BlockType, count: number) => Effect.Effect<boolean, never>
  readonly removeBlock: (blockType: BlockType, count: number) => Effect.Effect<boolean, never>
  readonly getHotbarSlots: () => Effect.Effect<ReadonlyArray<InventorySlot>, never>
  readonly getAllSlots: () => Effect.Effect<InventorySlots, never>
  readonly serialize: () => Effect.Effect<InventorySaveData, never>
  readonly deserialize: (data: InventorySaveData) => Effect.Effect<void, never>
}

export const InventoryService = Context.GenericTag<InventoryService>('@minecraft/application/InventoryService')

export const InventoryServiceLive = Layer.effect(
  InventoryService,
  Effect.gen(function* () {
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

    const getSlot = (index: number): Effect.Effect<InventorySlot, never> =>
      Ref.get(slotsRef).pipe(Effect.map((slots) => slots[index] ?? Option.none()))

    const setSlot = (index: number, stack: InventorySlot): Effect.Effect<void, never> =>
      Ref.update(slotsRef, (slots) => {
        const next = [...slots]
        next[index] = stack
        return next
      })

    const moveStack = (from: number, to: number): Effect.Effect<void, never> =>
      Ref.update(slotsRef, (slots) => {
        const next = [...slots]
        const fromSlot = next[from] ?? Option.none()
        const toSlot = next[to] ?? Option.none()

        if (Option.isNone(fromSlot)) return next

        if (Option.isNone(toSlot)) {
          // Move to empty slot
          next[to] = fromSlot
          next[from] = Option.none()
        } else if (canMerge(fromSlot.value, toSlot.value)) {
          // Merge stacks
          const [merged, remainder] = mergeStacks(toSlot.value, fromSlot.value)
          next[to] = Option.some(merged)
          next[from] = remainder
        } else {
          // Swap
          next[to] = fromSlot
          next[from] = toSlot
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
              ? { slot: i, blockType: slot.value.blockType, count: slot.value.count }
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

    return InventoryService.of({
      getSlot,
      setSlot,
      moveStack,
      addBlock,
      removeBlock,
      getHotbarSlots,
      getAllSlots,
      serialize,
      deserialize,
    })
  })
)
