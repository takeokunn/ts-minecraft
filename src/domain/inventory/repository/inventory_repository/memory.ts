import { now as timestampNow } from '@domain/shared/value_object/units/timestamp'
import { Effect, HashMap, Layer, Match, Option, Ref, pipe } from 'effect'
import type {
  Inventory,
  InventoryQuery,
  InventorySnapshot,
  InventoryTransferRequest,
  ItemId,
  ItemStack,
  PlayerId,
  SlotPosition,
  StackOperationRequest,
} from '../../types'
import { createInventoryNotFoundError, createRepositoryError, createSlotNotFoundError } from '../types'
import { InventoryRepository } from './index'

/**
 * InventoryRepository Memory Implementation
 *
 * インメモリ実装。テスト・開発用途向け。
 * 高速だが永続化されないため、アプリケーション再起動で消失する。
 */
export const InventoryRepositoryMemory = Layer.effect(
  InventoryRepository,
  Effect.gen(function* () {
    // インベントリストア
    const inventoryStore = yield* Ref.make(HashMap.empty<PlayerId, Inventory>())

    // スナップショットストア
    const snapshotStore = yield* Ref.make(HashMap.empty<string, InventorySnapshot>())

    // スナップショットカウンター
    const snapshotCounter = yield* Ref.make(0)

    return InventoryRepository.of({
      save: (inventory: Inventory) =>
        Effect.gen(function* () {
          yield* Ref.update(inventoryStore, (store) => HashMap.set(store, inventory.playerId, inventory))
        }),

      findByPlayerId: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(inventoryStore)
          return HashMap.get(store, playerId)
        }),

      findItemsByPlayerId: (playerId: PlayerId, itemId: ItemId) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(inventoryStore)
          const inventoryOption = HashMap.get(store, playerId)

          return yield* pipe(
            inventoryOption,
            Option.match({
              onNone: () => Effect.succeed([]),
              onSome: (inventory) =>
                Effect.sync(() =>
                  Array.from(inventory.slots.entries())
                    .filter(([, stack]) => stack.itemId === itemId)
                    .map(([position, stack]) => [position, stack] as const)
                ),
            })
          )
        }),

      updateSlot: (playerId: PlayerId, position: SlotPosition, itemStack: ItemStack | null) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(inventoryStore)
          const inventoryOption = HashMap.get(store, playerId)

          yield* pipe(
            inventoryOption,
            Option.match({
              onNone: () => Effect.fail(createInventoryNotFoundError(playerId)),
              onSome: (inventory) =>
                Effect.gen(function* () {
                  yield* pipe(
                    Match.value(position),
                    Match.when(
                      (pos) => pos < 0 || pos >= inventory.capacity,
                      (pos) => Effect.fail(createSlotNotFoundError(playerId, pos))
                    ),
                    Match.orElse(() =>
                      Effect.gen(function* () {
                        const updatedSlots = new Map(inventory.slots)
                        yield* pipe(
                          Option.fromNullable(itemStack),
                          Option.match({
                            onNone: () => Effect.sync(() => updatedSlots.delete(position)),
                            onSome: (stack) =>
                              Effect.sync(() => {
                                updatedSlots.set(position, stack)
                              }),
                          })
                        )

                        const timestamp = yield* timestampNow()
                        const updatedInventory: Inventory = {
                          ...inventory,
                          slots: updatedSlots,
                          lastUpdated: timestamp,
                          version: inventory.version + 1,
                        }

                        yield* Ref.update(inventoryStore, (store) => HashMap.set(store, playerId, updatedInventory))
                      })
                    )
                  )
                }),
            })
          )
        }),

      clearSlot: (playerId: PlayerId, position: SlotPosition) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(inventoryStore)
          const inventoryOption = HashMap.get(store, playerId)

          yield* pipe(
            inventoryOption,
            Option.match({
              onNone: () => Effect.fail(createInventoryNotFoundError(playerId)),
              onSome: (inventory) =>
                Effect.gen(function* () {
                  const updatedSlots = new Map(inventory.slots)
                  updatedSlots.delete(position)

                  const timestamp = yield* timestampNow()
                  const updatedInventory: Inventory = {
                    ...inventory,
                    slots: updatedSlots,
                    lastUpdated: timestamp,
                    version: inventory.version + 1,
                  }

                  yield* Ref.update(inventoryStore, (store) => HashMap.set(store, playerId, updatedInventory))
                }),
            })
          )
        }),

      delete: (playerId: PlayerId) =>
        Effect.gen(function* () {
          yield* Ref.update(inventoryStore, (store) => HashMap.remove(store, playerId))
        }),

      exists: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(inventoryStore)
          return HashMap.has(store, playerId)
        }),

      count: () =>
        Effect.gen(function* () {
          const store = yield* Ref.get(inventoryStore)
          return HashMap.size(store)
        }),

      saveMany: (inventories: ReadonlyArray<Inventory>) =>
        Effect.gen(function* () {
          yield* Ref.update(inventoryStore, (store) => {
            let updatedStore = store
            inventories.forEach((inventory) => {
              updatedStore = HashMap.set(updatedStore, inventory.playerId, inventory)
            })
            return updatedStore
          })
        }),

      findByQuery: (query: InventoryQuery) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(inventoryStore)
          const inventories = Array.from(HashMap.values(store))

          return inventories.filter((inventory) => {
            const meetsMinCapacity = pipe(
              Match.value(query.minCapacity),
              Match.when(
                (min): min is undefined => min === undefined,
                () => true
              ),
              Match.orElse((min) => inventory.capacity >= min)
            )

            const meetsMaxCapacity = pipe(
              Match.value(query.maxCapacity),
              Match.when(
                (max): max is undefined => max === undefined,
                () => true
              ),
              Match.orElse((max) => inventory.capacity <= max)
            )

            const containsItems = pipe(
              Match.value(query.hasItems),
              Match.when(
                (items): items is undefined => items === undefined || items.length === 0,
                () => true
              ),
              Match.orElse((items) => {
                const inventoryItems = new Set(Array.from(inventory.slots.values()).map((stack) => stack.itemId))
                return items.every((itemId) => inventoryItems.has(itemId))
              })
            )

            const updatedAfter = pipe(
              Match.value(query.updatedAfter),
              Match.when(
                (date): date is undefined => date === undefined,
                () => true
              ),
              Match.orElse((date) => inventory.lastUpdated >= date)
            )

            const updatedBefore = pipe(
              Match.value(query.updatedBefore),
              Match.when(
                (date): date is undefined => date === undefined,
                () => true
              ),
              Match.orElse((date) => inventory.lastUpdated <= date)
            )

            const includeEmpty = pipe(
              Match.value(query.excludeEmpty),
              Match.when(
                (flag): flag is undefined | false => flag !== true,
                () => true
              ),
              Match.orElse(() => inventory.slots.size > 0)
            )

            return (
              meetsMinCapacity && meetsMaxCapacity && containsItems && updatedAfter && updatedBefore && includeEmpty
            )
          })
        }),

      transfer: (request: InventoryTransferRequest) =>
        Effect.gen(function* () {
          // 実装を簡略化（実際にはアトミックなトランザクション処理が必要）
          yield* Effect.fail(createRepositoryError('transfer', 'Memory implementation does not support transfer yet'))
        }),

      stackOperation: (request: StackOperationRequest) =>
        Effect.gen(function* () {
          // 実装を簡略化（実際にはスタック操作の実装が必要）
          yield* Effect.fail(
            createRepositoryError('stackOperation', 'Memory implementation does not support stackOperation yet')
          )
        }),

      createSnapshot: (playerId: PlayerId, snapshotName: string) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(inventoryStore)
          const inventoryOption = HashMap.get(store, playerId)

          return yield* pipe(
            inventoryOption,
            Option.match({
              onNone: () => Effect.fail(createInventoryNotFoundError(playerId)),
              onSome: (inventory) =>
                Effect.gen(function* () {
                  const snapshotId = yield* Ref.updateAndGet(snapshotCounter, (n) => n + 1)
                  const createdAt = yield* timestampNow()
                  const snapshot: InventorySnapshot = {
                    id: `snapshot-${snapshotId}`,
                    name: snapshotName,
                    playerId,
                    inventory: structuredClone(inventory),
                    createdAt,
                  }

                  yield* Ref.update(snapshotStore, (store) => HashMap.set(store, snapshot.id, snapshot))

                  return snapshot
                }),
            })
          )
        }),

      restoreFromSnapshot: (snapshotId: string) =>
        Effect.gen(function* () {
          const snapshots = yield* Ref.get(snapshotStore)
          const snapshotOption = HashMap.get(snapshots, snapshotId)

          yield* pipe(
            snapshotOption,
            Option.match({
              onNone: () =>
                Effect.fail(createRepositoryError('restoreFromSnapshot', `Snapshot not found: ${snapshotId}`)),
              onSome: (snapshot) =>
                Effect.gen(function* () {
                  const lastUpdated = yield* timestampNow()
                  const restoredInventory: Inventory = {
                    ...snapshot.inventory,
                    lastUpdated,
                    version: snapshot.inventory.version + 1,
                  }

                  yield* Ref.update(inventoryStore, (store) => HashMap.set(store, snapshot.playerId, restoredInventory))
                }),
            })
          )
        }),

      initialize: () => Effect.void,

      cleanup: () => Effect.void,
    })
  })
)
