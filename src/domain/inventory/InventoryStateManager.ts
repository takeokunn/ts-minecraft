/**
 * InventoryStateManager - Effect-TS純粋状態管理システム
 *
 * Effect-TSのRef、PubSub、Streamを使った高性能状態管理
 * ゲームエンジン向けのリアクティブな状態同期を提供
 */

import {
  Context,
  Duration,
  Effect,
  Fiber,
  Layer,
  Match,
  Option,
  pipe,
  PubSub,
  Queue,
  Ref,
  Schedule,
  Stream,
} from 'effect'
import { InventoryError, InventoryService } from './InventoryService'
import { InventoryStorageService } from './InventoryStorageService'
import { Inventory, ItemStack, PlayerId } from './InventoryTypes'
import { ItemManagerService } from './ItemManagerService'

// State change event types
export interface InventoryStateEvent {
  readonly _tag: string
  readonly playerId: PlayerId
  readonly timestamp: number
}

export interface InventoryLoadedEvent extends InventoryStateEvent {
  readonly _tag: 'InventoryLoaded'
  readonly inventory: Inventory
}

export interface ItemAddedEvent extends InventoryStateEvent {
  readonly _tag: 'ItemAdded'
  readonly item: ItemStack
  readonly slotIndex: number
}

export interface ItemRemovedEvent extends InventoryStateEvent {
  readonly _tag: 'ItemRemoved'
  readonly item: ItemStack
  readonly slotIndex: number
}

export interface ItemMovedEvent extends InventoryStateEvent {
  readonly _tag: 'ItemMoved'
  readonly fromSlot: number
  readonly toSlot: number
  readonly item: ItemStack
}

export interface SlotUpdatedEvent extends InventoryStateEvent {
  readonly _tag: 'SlotUpdated'
  readonly slotIndex: number
  readonly oldItem: ItemStack | null
  readonly newItem: ItemStack | null
}

export interface HotbarChangedEvent extends InventoryStateEvent {
  readonly _tag: 'HotbarChanged'
  readonly selectedSlot: number
}

export type StateEvent =
  | InventoryLoadedEvent
  | ItemAddedEvent
  | ItemRemovedEvent
  | ItemMovedEvent
  | SlotUpdatedEvent
  | HotbarChangedEvent

// State manager service interface
export interface InventoryStateManager {
  // State access
  readonly getCurrentState: (playerId: PlayerId) => Effect.Effect<Option.Option<Inventory>>
  readonly getAllStates: () => Effect.Effect<Map<PlayerId, Inventory>>

  // State mutations
  readonly updateState: (playerId: PlayerId, updater: (inventory: Inventory) => Inventory) => Effect.Effect<void>
  readonly setState: (playerId: PlayerId, inventory: Inventory) => Effect.Effect<void>
  readonly removeState: (playerId: PlayerId) => Effect.Effect<void>

  // Event streaming
  readonly events: Stream.Stream<StateEvent, never>
  readonly subscribe: () => Effect.Effect<Queue.Dequeue<StateEvent>>
  readonly subscribeFiltered: (filter: (event: StateEvent) => boolean) => Effect.Effect<Queue.Dequeue<StateEvent>>

  // State operations with events
  readonly loadPlayer: (playerId: PlayerId) => Effect.Effect<void, InventoryError, never>
  readonly savePlayer: (playerId: PlayerId) => Effect.Effect<void, never, never> // StorageError -> never に統一
  readonly addItemTracked: (playerId: PlayerId, item: ItemStack) => Effect.Effect<void, InventoryError, never>
  readonly removeItemTracked: (
    playerId: PlayerId,
    slotIndex: number,
    amount?: number
  ) => Effect.Effect<void, InventoryError, never>
  readonly moveItemTracked: (
    playerId: PlayerId,
    fromSlot: number,
    toSlot: number
  ) => Effect.Effect<void, InventoryError, never>

  // Batch operations
  readonly transaction: <A>(
    playerId: PlayerId,
    operation: Effect.Effect<A, never, never>
  ) => Effect.Effect<A, never, never>
  readonly bulkUpdate: (updates: Map<PlayerId, Inventory>) => Effect.Effect<void>

  // State synchronization - Fiber型をneverに統一
  readonly startSync: (interval: Duration.Duration) => Effect.Effect<Fiber.RuntimeFiber<number, never>, never, never>
  readonly stopSync: (fiber: Fiber.RuntimeFiber<number, never>) => Effect.Effect<void>
  readonly forceSync: () => Effect.Effect<void>

  // State snapshots
  readonly createSnapshot: () => Effect.Effect<Map<PlayerId, Inventory>>
  readonly restoreSnapshot: (snapshot: Map<PlayerId, Inventory>) => Effect.Effect<void>

  // Performance monitoring
  readonly getStats: () => Effect.Effect<{
    playerCount: number
    totalItems: number
    eventQueueSize: number
    lastSyncTime: number | null
  }>
}

// Context tag
export const InventoryStateManager = Context.GenericTag<InventoryStateManager>(
  '@minecraft/domain/InventoryStateManager'
)

// State Manager Implementation
export const InventoryStateManagerLive = Layer.effect(
  InventoryStateManager,
  Effect.gen(function* () {
    const inventoryService = yield* InventoryService
    const storageService = yield* InventoryStorageService
    const itemManager = yield* ItemManagerService

    // Core state storage
    const stateMapRef = yield* Ref.make<Map<PlayerId, Inventory>>(new Map())

    // Event pub/sub system
    const eventPubSub = yield* PubSub.unbounded<StateEvent>()

    // Transaction locks
    const lockMapRef = yield* Ref.make<Map<PlayerId, boolean>>(new Map())

    // Sync state
    const lastSyncRef = yield* Ref.make<number | null>(null)
    const dirtyPlayersRef = yield* Ref.make<Set<PlayerId>>(new Set())

    // Helper to publish events
    const publishEvent = (event: StateEvent) => PubSub.publish(eventPubSub, event)

    // Helper to acquire lock
    const acquireLock = (playerId: PlayerId) =>
      Effect.gen(function* () {
        yield* Effect.repeat(
          Ref.modify(lockMapRef, (locks) => {
            const isLocked = locks.get(playerId) ?? false
            return pipe(
              Match.value(isLocked),
              Match.when(true, () => [false, locks] as const),
              Match.when(false, () => {
                const newLocks = new Map(locks)
                newLocks.set(playerId, true)
                return [true, newLocks] as const
              }),
              Match.exhaustive
            )
          }),
          Schedule.recurWhile((acquired: boolean) => !acquired)
        )
      })

    // Helper to release lock
    const releaseLock = (playerId: PlayerId) =>
      Ref.update(lockMapRef, (locks) => {
        const newLocks = new Map(locks)
        newLocks.delete(playerId)
        return newLocks
      })

    // Mark player as dirty (needs sync)
    const markDirty = (playerId: PlayerId) =>
      Ref.update(dirtyPlayersRef, (dirty) => {
        const newDirty = new Set(dirty)
        newDirty.add(playerId)
        return newDirty
      })

    const stateManagerService: InventoryStateManager = {
      getCurrentState: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const stateMap = yield* Ref.get(stateMapRef)
          return Option.fromNullable(stateMap.get(playerId))
        }),

      getAllStates: () => Ref.get(stateMapRef),

      updateState: (playerId: PlayerId, updater: (inventory: Inventory) => Inventory) =>
        Effect.gen(function* () {
          yield* Ref.update(stateMapRef, (states) => {
            const current = states.get(playerId)
            return pipe(
              Option.fromNullable(current),
              Option.match({
                onNone: () => states,
                onSome: (inventory) => {
                  const updated = updater(inventory)
                  const newStates = new Map(states)
                  newStates.set(playerId, updated)
                  return newStates
                },
              })
            )
          })
          yield* markDirty(playerId)
        }),

      setState: (playerId: PlayerId, inventory: Inventory) =>
        Effect.gen(function* () {
          yield* Ref.update(stateMapRef, (states) => {
            const newStates = new Map(states)
            newStates.set(playerId, inventory)
            return newStates
          })
          yield* markDirty(playerId)
        }),

      removeState: (playerId: PlayerId) =>
        Effect.gen(function* () {
          yield* Ref.update(stateMapRef, (states) => {
            const newStates = new Map(states)
            newStates.delete(playerId)
            return newStates
          })
          yield* Ref.update(dirtyPlayersRef, (dirty) => {
            const newDirty = new Set(dirty)
            newDirty.delete(playerId)
            return newDirty
          })
        }),

      events: Stream.fromPubSub(eventPubSub),

      subscribe: () =>
        Effect.gen(function* () {
          const queue = yield* Queue.unbounded<StateEvent>()
          yield* Stream.fromPubSub(eventPubSub)
            .pipe(Stream.run(Stream.toQueue(queue)))
            .pipe(Effect.forkDaemon)
          return queue
        }),

      subscribeFiltered: (filter: (event: StateEvent) => boolean) =>
        Effect.gen(function* () {
          const queue = yield* Queue.unbounded<StateEvent>()
          yield* Stream.fromPubSub(eventPubSub)
            .pipe(Stream.filter(filter), Stream.run(Stream.toQueue(queue)))
            .pipe(Effect.forkDaemon)
          return queue
        }),

      loadPlayer: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* inventoryService.getInventory(playerId)
          yield* stateManagerService.setState(playerId, inventory)
          yield* publishEvent({
            _tag: 'InventoryLoaded',
            playerId,
            inventory,
            timestamp: Date.now(),
          })
        }),

      savePlayer: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const state = yield* stateManagerService.getCurrentState(playerId)
          yield* pipe(
            state,
            Option.match({
              onNone: () => Effect.succeed(void 0),
              onSome: (inventory) =>
                storageService.saveInventory(playerId, inventory).pipe(
                  Effect.catchAll(() => Effect.succeed(void 0)) // StorageErrorを無視してneverに変換
                ),
            })
          )
          yield* Ref.update(dirtyPlayersRef, (dirty) => {
            const newDirty = new Set(dirty)
            newDirty.delete(playerId)
            return newDirty
          })
        }),

      addItemTracked: (playerId: PlayerId, item: ItemStack) =>
        Effect.gen(function* () {
          const result = yield* inventoryService.addItem(playerId, item)

          yield* pipe(
            Match.value(result._tag),
            Match.when('success', () =>
              Effect.gen(function* () {
                const inventory = yield* inventoryService.getInventory(playerId)
                yield* stateManagerService.setState(playerId, inventory)

                // Find where item was added
                const slotIndex = inventory.slots.findIndex((slot) => slot?.itemId === item.itemId)

                yield* publishEvent({
                  _tag: 'ItemAdded',
                  playerId,
                  item,
                  slotIndex,
                  timestamp: Date.now(),
                })
              })
            ),
            Match.when('partial', () =>
              Effect.gen(function* () {
                const inventory = yield* inventoryService.getInventory(playerId)
                yield* stateManagerService.setState(playerId, inventory)

                const slotIndex = inventory.slots.findIndex((slot) => slot?.itemId === item.itemId)

                yield* publishEvent({
                  _tag: 'ItemAdded',
                  playerId,
                  item: { ...item, count: result._tag === 'partial' ? result.addedItems : item.count },
                  slotIndex,
                  timestamp: Date.now(),
                })
              })
            ),
            Match.when('full', () => Effect.succeed(void 0)),
            Match.exhaustive
          )
        }),

      removeItemTracked: (playerId: PlayerId, slotIndex: number, amount?: number) =>
        Effect.gen(function* () {
          const currentItem = yield* inventoryService.getSlotItem(playerId, slotIndex)
          const removedItem = yield* inventoryService.removeItem(playerId, slotIndex, amount ?? 1)

          yield* pipe(
            Option.fromNullable(removedItem),
            Option.match({
              onNone: () => Effect.succeed(void 0),
              onSome: (item) =>
                Effect.gen(function* () {
                  const inventory = yield* inventoryService.getInventory(playerId)
                  yield* stateManagerService.setState(playerId, inventory)

                  yield* publishEvent({
                    _tag: 'ItemRemoved',
                    playerId,
                    item,
                    slotIndex,
                    timestamp: Date.now(),
                  })
                }),
            })
          )
        }),

      moveItemTracked: (playerId: PlayerId, fromSlot: number, toSlot: number) =>
        Effect.gen(function* () {
          const item = yield* inventoryService.getSlotItem(playerId, fromSlot)
          yield* inventoryService.moveItem(playerId, fromSlot, toSlot)

          const inventory = yield* inventoryService.getInventory(playerId)
          yield* stateManagerService.setState(playerId, inventory)

          yield* pipe(
            Option.fromNullable(item),
            Option.match({
              onNone: () => Effect.succeed(void 0),
              onSome: (movedItem) =>
                publishEvent({
                  _tag: 'ItemMoved',
                  playerId,
                  fromSlot,
                  toSlot,
                  item: movedItem,
                  timestamp: Date.now(),
                }),
            })
          )
        }),

      transaction: <A>(playerId: PlayerId, operation: Effect.Effect<A>) =>
        Effect.gen(function* () {
          yield* acquireLock(playerId)
          const result = yield* operation.pipe(Effect.ensuring(releaseLock(playerId)))
          return result
        }),

      bulkUpdate: (updates: Map<PlayerId, Inventory>) =>
        Effect.gen(function* () {
          yield* Ref.update(stateMapRef, (current) => {
            const newStates = new Map(current)
            updates.forEach((inventory, playerId) => {
              newStates.set(playerId, inventory)
            })
            return newStates
          })

          yield* Ref.update(dirtyPlayersRef, (dirty) => {
            const newDirty = new Set(dirty)
            updates.forEach((_, playerId) => {
              newDirty.add(playerId)
            })
            return newDirty
          })
        }),

      startSync: (interval: Duration.Duration) =>
        Effect.gen(function* () {
          const syncTask = Effect.gen(function* () {
            const dirtyPlayers = yield* Ref.get(dirtyPlayersRef)

            yield* Effect.forEach(
              dirtyPlayers,
              (playerId) =>
                stateManagerService.savePlayer(playerId).pipe(Effect.catchAll(() => Effect.succeed(void 0))),
              {
                concurrency: 'unbounded',
              }
            )

            yield* Ref.set(lastSyncRef, Date.now())
          }).pipe(Effect.catchAll(() => Effect.succeed(void 0)))

          return yield* syncTask.pipe(
            Effect.repeat(Schedule.fixed(interval)),
            Effect.forkDaemon,
            Effect.catchAll(() => Effect.succeed(null as any))
          )
        }).pipe(Effect.map((fiber) => fiber as Fiber.RuntimeFiber<number, never>)),

      stopSync: (fiber: Fiber.RuntimeFiber<number, never>) => Fiber.interrupt(fiber).pipe(Effect.asVoid),

      forceSync: () =>
        Effect.gen(function* () {
          const dirtyPlayers = yield* Ref.get(dirtyPlayersRef)

          yield* Effect.forEach(dirtyPlayers, (playerId) => stateManagerService.savePlayer(playerId), {
            concurrency: 'unbounded',
          })

          yield* Ref.set(lastSyncRef, Date.now())
        }),

      createSnapshot: () => Ref.get(stateMapRef).pipe(Effect.map((states) => new Map(states))),

      restoreSnapshot: (snapshot: Map<PlayerId, Inventory>) =>
        Effect.gen(function* () {
          yield* Ref.set(stateMapRef, new Map(snapshot))
          yield* Ref.set(dirtyPlayersRef, new Set(snapshot.keys()))
        }),

      getStats: () =>
        Effect.gen(function* () {
          const states = yield* Ref.get(stateMapRef)
          const lastSync = yield* Ref.get(lastSyncRef)
          const pubSubSize = yield* PubSub.size(eventPubSub)

          let totalItems = 0
          states.forEach((inventory) => {
            totalItems += inventory.slots.filter((slot) => slot !== null).length
          })

          return {
            playerCount: states.size,
            totalItems,
            eventQueueSize: pubSubSize,
            lastSyncTime: lastSync,
          }
        }),
    }

    return InventoryStateManager.of(stateManagerService)
  })
)

// Event stream processors
export const InventoryEventProcessors = {
  // Log all events
  logEvents: (manager: InventoryStateManager) =>
    manager.events.pipe(
      Stream.tap((event) =>
        Effect.sync(() => {
          console.log(`[InventoryEvent] ${event._tag}`, {
            playerId: event.playerId,
            timestamp: new Date(event.timestamp).toISOString(),
          })
        })
      ),
      Stream.runDrain
    ),

  // Auto-save on item changes
  autoSaveOnChanges: (manager: InventoryStateManager, debounceMs: number = 5000) =>
    manager.events.pipe(
      Stream.filter(
        (event) => event._tag === 'ItemAdded' || event._tag === 'ItemRemoved' || event._tag === 'ItemMoved'
      ),
      Stream.debounce(Duration.millis(debounceMs)),
      Stream.tap((event) => manager.savePlayer(event.playerId)),
      Stream.runDrain
    ),

  // Track item statistics
  trackItemStats: (manager: InventoryStateManager) =>
    Effect.gen(function* () {
      const statsRef = yield* Ref.make<Map<string, number>>(new Map())

      yield* manager.events
        .pipe(
          Stream.tap((event) =>
            pipe(
              Match.value(event._tag),
              Match.when('ItemAdded', () =>
                Ref.update(statsRef, (stats) => {
                  const newStats = new Map(stats)
                  const current = newStats.get((event as ItemAddedEvent).item.itemId) ?? 0
                  newStats.set((event as ItemAddedEvent).item.itemId, current + (event as ItemAddedEvent).item.count)
                  return newStats
                })
              ),
              Match.when('ItemRemoved', () =>
                Ref.update(statsRef, (stats) => {
                  const newStats = new Map(stats)
                  const current = newStats.get((event as ItemRemovedEvent).item.itemId) ?? 0
                  newStats.set(
                    (event as ItemRemovedEvent).item.itemId,
                    Math.max(0, current - (event as ItemRemovedEvent).item.count)
                  )
                  return newStats
                })
              ),
              Match.orElse(() => Effect.succeed(void 0))
            )
          ),
          Stream.runDrain
        )
        .pipe(Effect.forkDaemon)

      return statsRef
    }),
}

// State query helpers
export const InventoryStateQueries = {
  // Get all online players
  getOnlinePlayers: (manager: InventoryStateManager) =>
    manager.getAllStates().pipe(Effect.map((states) => Array.from(states.keys()))),

  // Get total item count across all players
  getTotalItemCount: (manager: InventoryStateManager) =>
    manager.getAllStates().pipe(
      Effect.map((states) => {
        let total = 0
        states.forEach((inventory) => {
          inventory.slots.forEach((slot) => {
            if (slot) total += slot.count
          })
        })
        return total
      })
    ),

  // Find players with specific item
  findPlayersWithItem: (manager: InventoryStateManager, itemId: string) =>
    manager.getAllStates().pipe(
      Effect.map((states) => {
        const players: PlayerId[] = []
        states.forEach((inventory, playerId) => {
          const hasItem = inventory.slots.some((slot) => slot?.itemId === itemId)
          if (hasItem) players.push(playerId)
        })
        return players
      })
    ),

  // Get inventory value (sum of all item values)
  getInventoryValue: (manager: InventoryStateManager, playerId: PlayerId) =>
    manager.getCurrentState(playerId).pipe(
      Effect.map(
        Option.match({
          onNone: () => 0,
          onSome: (inventory) => {
            // This would calculate based on item values from ItemRegistry
            return inventory.slots.reduce((total, slot) => {
              if (!slot) return total
              // Placeholder calculation
              return total + slot.count * 10
            }, 0)
          },
        })
      )
    ),
}
