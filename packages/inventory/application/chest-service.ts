import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
import { SlotIndex } from '@ts-minecraft/core'
import { PlayerServicePort, WorldBlockQueryPort } from '@ts-minecraft/world'
import { InventoryService } from './inventory-service'
import type { InventorySlots } from './inventory-service-types'
import {
  hydrateChest,
  normalizeChest,
  serializeChest,
} from './chest-persistence'
import type { ChestRuntimeState } from './chest-service-types'
import { ItemStack, removeFromStack } from '../domain/item-stack'
import type { ChestBlockState, ChestItemStack } from '../domain/chest-state'
import {
  type ChestState,
  INITIAL_CHEST_STATE,
  chestKey,
  setChestState,
} from '../domain/chest-service-utils'
import { makeChestHelpers } from './chest-service-helpers'
import { fillSlotsFromStack, isValidChestIndex, moveBetweenSlots, removeChestAtPosition, tryFillSlotsFromStacks } from './chest-service-state'

const writeInventorySlots = (
  inventoryService: InventoryService,
  slots: InventorySlots,
): Effect.Effect<void, never> =>
  Effect.forEach(
    slots,
    (slot, index) => inventoryService.setSlot(SlotIndex.make(index), slot),
    { discard: true, concurrency: 1 },
  )

export class ChestService extends Effect.Service<ChestService>()(
  '@minecraft/application/ChestService',
  {
    effect: Effect.gen(function* () {
      const inventoryService = yield* InventoryService
      const playerService = yield* PlayerServicePort
      const worldBlockQueryPort = yield* WorldBlockQueryPort
      const stateRef = yield* Ref.make<ChestState>(INITIAL_CHEST_STATE)
      const helpers = makeChestHelpers(playerService, worldBlockQueryPort, stateRef)

      const updateSelectedChest = (
        update: (chest: ChestRuntimeState) => ChestRuntimeState,
      ): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const chestOpt = yield* helpers.getNearestChestState()
          const chest = Option.getOrNull(chestOpt)
          if (chest === null) return
          yield* Ref.update(stateRef, (state) => setChestState(state, normalizeChest(serializeChest(update(hydrateChest(chest))))))
        })

      return {
        getState: (): Effect.Effect<ChestState, never> => Ref.get(stateRef),

        getNearestChestState: (): Effect.Effect<Option.Option<ChestBlockState>, never> =>
          Effect.map(helpers.getNearestChestState(), (chestOpt) => Option.map(chestOpt, normalizeChest)),

        hasNearbyChest: (): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            const pos = yield* helpers.getSelectedChestPosition()
            return Option.isSome(pos)
          }),

        setSelectedChest: (position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<void, never> =>
          Ref.update(stateRef, (state) => ({
            ...state,
            selectedChestPosition: Option.some(position),
          })),

        moveInventoryStackToChestSlot: (inventoryIndex: SlotIndex, chestIndex: number): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            if (!isValidChestIndex(chestIndex)) return
            const inventorySlot = yield* inventoryService.getSlot(inventoryIndex)
            const source = Option.getOrNull(inventorySlot)
            if (source === null) return
            const chestOpt = yield* helpers.getNearestChestState()
            const chest = Option.getOrNull(chestOpt)
            if (chest === null) return
            const runtimeChest = hydrateChest(chest)
            const slots = runtimeChest.slots
            const chestSlot = Option.getOrElse(Arr.get(slots, chestIndex), () => Option.none<ItemStack>())
            const [nextInventorySlot, nextChestSlot] = moveBetweenSlots(inventorySlot, chestSlot)
            yield* inventoryService.setSlot(inventoryIndex, nextInventorySlot)
            yield* Ref.update(stateRef, (state) =>
              setChestState(state, serializeChest({ ...runtimeChest, slots: Arr.modify(slots, chestIndex, () => nextChestSlot) }))
            )
          }),

        moveChestStackToInventorySlot: (chestIndex: number, inventoryIndex: SlotIndex): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            if (!isValidChestIndex(chestIndex)) return
            const inventorySlot = yield* inventoryService.getSlot(inventoryIndex)
            const chestOpt = yield* helpers.getNearestChestState()
            const chest = Option.getOrNull(chestOpt)
            if (chest === null) return
            const runtimeChest = hydrateChest(chest)
            const slots = runtimeChest.slots
            const chestSlot = Option.getOrElse(Arr.get(slots, chestIndex), () => Option.none<ItemStack>())
            const [nextChestSlot, nextInventorySlot] = moveBetweenSlots(chestSlot, inventorySlot)
            yield* inventoryService.setSlot(inventoryIndex, nextInventorySlot)
            yield* Ref.update(stateRef, (state) =>
              setChestState(state, serializeChest({ ...runtimeChest, slots: Arr.modify(slots, chestIndex, () => nextChestSlot) }))
            )
          }),

        quickMoveInventoryToChest: (inventoryIndex: SlotIndex): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const source = Option.getOrNull(yield* inventoryService.getSlot(inventoryIndex))
            if (source === null) return
            const chestOpt = yield* helpers.getNearestChestState()
            const chest = Option.getOrNull(chestOpt)
            if (chest === null) return
            const runtimeChest = hydrateChest(chest)
            const [nextChestSlots, remainder] = fillSlotsFromStack(runtimeChest.slots, source)
            const moved = source.count - (Option.getOrNull(remainder)?.count ?? 0)
            if (moved <= 0) return
            yield* inventoryService.setSlot(inventoryIndex, removeFromStack(source, moved))
            yield* Ref.update(stateRef, (state) =>
              setChestState(state, serializeChest({ ...runtimeChest, slots: nextChestSlots }))
            )
          }),

        quickMoveChestToInventory: (chestIndex: number): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            if (!isValidChestIndex(chestIndex)) return
            const inventorySlots = yield* inventoryService.getAllSlots()
            let nextInventorySlots = inventorySlots
            yield* updateSelectedChest((chest) => {
              const chestSlots = chest.slots
              const source = Option.getOrNull(Option.getOrElse(Arr.get(chestSlots, chestIndex), () => Option.none<ItemStack>()))
              if (source === null) return chest
              const [filledInventory, remainder] = fillSlotsFromStack(inventorySlots, source)
              const moved = source.count - (Option.getOrNull(remainder)?.count ?? 0)
              if (moved <= 0) return chest
              nextInventorySlots = filledInventory
              return { ...chest, slots: Arr.modify(chestSlots, chestIndex, () => removeFromStack(source, moved)) }
            })
            if (nextInventorySlots !== inventorySlots) yield* writeInventorySlots(inventoryService, nextInventorySlots)
          }),

        clearChest: (position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<ReadonlyArray<ChestItemStack>, never> =>
          Ref.modify(stateRef, (state) => removeChestAtPosition(state, position)),

        dismantleChest: (position: { readonly x: number; readonly y: number; readonly z: number }): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            const [dropped, nextState] = removeChestAtPosition(state, position)
            if (dropped.length === 0 && nextState === state) return true
            const inventoryStacks = Arr.map(dropped, (stack) => new ItemStack(stack))
            const inventorySlots = yield* inventoryService.getAllSlots()
            const nextInventorySlots = Option.getOrNull(tryFillSlotsFromStacks(inventorySlots, inventoryStacks))
            if (nextInventorySlots === null) return false
            yield* writeInventorySlots(inventoryService, nextInventorySlots)
            yield* Ref.set(stateRef, nextState)
            return true
          }),

        serialize: (): Effect.Effect<ReadonlyArray<ChestBlockState>, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            return Arr.map(Arr.fromIterable(HashMap.values(state.chests)), (chest) => normalizeChest(chest))
          }),

        deserialize: (serialized: ReadonlyArray<ChestBlockState>): Effect.Effect<void, never> =>
          Ref.set(stateRef, {
            chests: HashMap.fromIterable(
              Arr.map(serialized, (chest) => {
                const normalized = normalizeChest(chest)
                return [chestKey(normalized.position), normalized] as const
              }),
            ),
            selectedChestPosition: Option.none(),
          }),
      }
    }),
  },
) {}
