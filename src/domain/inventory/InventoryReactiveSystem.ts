/**
 * InventoryReactiveSystem - ゲームループ統合用リアクティブシステム
 *
 * Effect-TSのFiber、Stream、Scheduleを使った
 * ゲームエンジンとの統合を提供
 */

import {
  Chunk,
  Context,
  Duration,
  Effect,
  Fiber,
  Layer,
  Match,
  Option,
  pipe,
  Queue,
  Ref,
  Schedule,
  Stream,
} from 'effect'
import { InventoryAPIService } from './InventoryAPIService'
import { InventoryService } from './InventoryService'
import { InventoryStateManager } from './InventoryStateManager'
import { Inventory, ItemStack, PlayerId } from './InventoryTypes'

// Reactive update types
export interface InventoryUpdate {
  readonly _tag: string
  readonly playerId: PlayerId
  readonly deltaTime: number
}

export interface DurabilityUpdate extends InventoryUpdate {
  readonly _tag: 'DurabilityUpdate'
  readonly slotIndex: number
  readonly damage: number
}

export interface HungerUpdate extends InventoryUpdate {
  readonly _tag: 'HungerUpdate'
  readonly consumption: number
}

export interface EffectUpdate extends InventoryUpdate {
  readonly _tag: 'EffectUpdate'
  readonly effects: ReadonlyArray<{
    type: string
    duration: number
    level: number
  }>
}

export type GameUpdate = DurabilityUpdate | HungerUpdate | EffectUpdate

// Reactive system service
export interface InventoryReactiveSystem {
  // Game loop integration
  readonly startGameLoop: (tickRate: number) => Effect.Effect<Fiber.RuntimeFiber<void, never>>
  readonly stopGameLoop: (fiber: Fiber.RuntimeFiber<void, never>) => Effect.Effect<void>
  readonly processTick: (deltaTime: number) => Effect.Effect<void>

  // Update streams
  readonly durabilityStream: Stream.Stream<DurabilityUpdate, never>
  readonly hungerStream: Stream.Stream<HungerUpdate, never>
  readonly effectStream: Stream.Stream<EffectUpdate, never>

  // Reactive queries
  readonly watchInventory: (playerId: PlayerId) => Stream.Stream<Inventory, never>
  readonly watchSlot: (playerId: PlayerId, slotIndex: number) => Stream.Stream<Option.Option<ItemStack>, never>
  readonly watchHotbar: (playerId: PlayerId) => Stream.Stream<ReadonlyArray<ItemStack | null>, never>

  // Reactive operations - エラー型をneverに統一
  readonly autoStack: (playerId: PlayerId) => Effect.Effect<void, never, never>
  readonly autoSort: (playerId: PlayerId) => Effect.Effect<void, never, never>
  readonly autoRepair: (playerId: PlayerId) => Effect.Effect<void, never, never>

  // Performance monitoring
  readonly frameMetrics: Stream.Stream<
    {
      fps: number
      tickTime: number
      updateCount: number
    },
    never
  >

  // Batch processing
  readonly processBatch: (updates: ReadonlyArray<GameUpdate>) => Effect.Effect<void>
  readonly queueUpdate: (update: GameUpdate) => Effect.Effect<void>
  readonly flushUpdates: () => Effect.Effect<void>
}

// Context tag
export const InventoryReactiveSystem = Context.GenericTag<InventoryReactiveSystem>(
  '@minecraft/domain/InventoryReactiveSystem'
)

// Implementation
export const InventoryReactiveSystemLive = Layer.effect(
  InventoryReactiveSystem,
  Effect.gen(function* () {
    const stateManager = yield* InventoryStateManager
    const inventoryService = yield* InventoryService
    const apiService = yield* InventoryAPIService

    // Update queues
    const durabilityQueue = yield* Queue.unbounded<DurabilityUpdate>()
    const hungerQueue = yield* Queue.unbounded<HungerUpdate>()
    const effectQueue = yield* Queue.unbounded<EffectUpdate>()

    // Batch processing queue
    const batchQueue = yield* Queue.bounded<GameUpdate>(1000)

    // Performance metrics
    const metricsRef = yield* Ref.make({
      fps: 60,
      tickTime: 0,
      updateCount: 0,
      lastTickTime: Date.now(),
    })

    // Process durability updates
    const processDurabilityUpdate = (update: DurabilityUpdate) =>
      Effect.gen(function* () {
        const inventory = yield* stateManager.getCurrentState(update.playerId)

        yield* pipe(
          inventory,
          Option.match({
            onNone: () => Effect.succeed(void 0),
            onSome: (inv) =>
              Effect.gen(function* () {
                const item = inv.slots[update.slotIndex]
                if (!item || !item.metadata?.durability) return

                const newDurability = Math.max(0, (item.metadata.durability ?? 0) - update.damage)

                yield* pipe(
                  Match.value(newDurability > 0),
                  Match.when(true, () =>
                    stateManager.updateState(update.playerId, (inventory) => ({
                      ...inventory,
                      slots: inventory.slots.map((slot, idx) =>
                        idx === update.slotIndex && slot
                          ? {
                              ...slot,
                              metadata: {
                                ...slot.metadata,
                                durability: newDurability,
                              },
                            }
                          : slot
                      ),
                    }))
                  ),
                  Match.when(false, () =>
                    // Item broke
                    stateManager.removeItemTracked(update.playerId, update.slotIndex)
                  ),
                  Match.exhaustive
                )
              }),
          })
        )
      })

    // Process hunger updates
    const processHungerUpdate = (update: HungerUpdate) =>
      Effect.gen(function* () {
        // Find and consume food items
        const inventory = yield* stateManager.getCurrentState(update.playerId)

        yield* pipe(
          inventory,
          Option.match({
            onNone: () => Effect.succeed(void 0),
            onSome: (inv) =>
              Effect.gen(function* () {
                // This would integrate with a hunger/food system
                // For now, just a placeholder
                console.log(`Hunger update for ${update.playerId}: ${update.consumption}`)
              }),
          })
        )
      })

    // Process effect updates
    const processEffectUpdate = (update: EffectUpdate) =>
      Effect.gen(function* () {
        // Apply effects to inventory items
        const inventory = yield* stateManager.getCurrentState(update.playerId)

        yield* pipe(
          inventory,
          Option.match({
            onNone: () => Effect.succeed(void 0),
            onSome: (inv) =>
              Effect.gen(function* () {
                // This would integrate with an effects system
                console.log(`Effect update for ${update.playerId}:`, update.effects)
              }),
          })
        )
      })

    // Main game tick processor
    const processGameTick = (deltaTime: number) =>
      Effect.gen(function* () {
        const startTime = Date.now()

        // Process all pending updates
        const updates = yield* Queue.takeAll(batchQueue)
        let updateCount = 0

        yield* Effect.forEach(
          updates,
          (update) =>
            pipe(
              Match.value(update._tag),
              Match.when('DurabilityUpdate', () => {
                updateCount++
                return processDurabilityUpdate(update as DurabilityUpdate)
              }),
              Match.when('HungerUpdate', () => {
                updateCount++
                return processHungerUpdate(update as HungerUpdate)
              }),
              Match.when('EffectUpdate', () => {
                updateCount++
                return processEffectUpdate(update as EffectUpdate)
              }),
              Match.exhaustive
            ),
          { concurrency: 'unbounded' }
        )

        // Update metrics
        const tickTime = Date.now() - startTime
        yield* Ref.update(metricsRef, (metrics) => ({
          fps: Math.round(1000 / Math.max(deltaTime, 16.67)),
          tickTime,
          updateCount,
          lastTickTime: Date.now(),
        }))
      })

    return InventoryReactiveSystem.of({
      startGameLoop: (tickRate: number) =>
        Effect.gen(function* () {
          const tickInterval = 1000 / tickRate

          const gameLoop = Effect.gen(function* () {
            const lastTick = yield* Ref.make(Date.now())

            yield* Effect.repeat(
              Effect.gen(function* () {
                const now = Date.now()
                const last = yield* Ref.get(lastTick)
                const deltaTime = now - last

                yield* processGameTick(deltaTime).pipe(Effect.catchAll(() => Effect.succeed(void 0)))
                yield* Ref.set(lastTick, now)
              }),
              Schedule.fixed(Duration.millis(tickInterval))
            )
          })

          return yield* gameLoop.pipe(
            Effect.forkDaemon,
            Effect.catchAll(() => Effect.succeed(null as any))
          )
        }).pipe(Effect.map((fiber) => fiber as Fiber.RuntimeFiber<void, never>)),

      stopGameLoop: (fiber: Fiber.RuntimeFiber<void, never>) => Fiber.interrupt(fiber).pipe(Effect.asVoid),

      processTick: (deltaTime: number) =>
        pipe(
          processGameTick(deltaTime),
          Effect.catchAll((error) => {
            console.error('Game tick error:', error)
            return Effect.void
          })
        ),

      durabilityStream: Stream.fromQueue(durabilityQueue),
      hungerStream: Stream.fromQueue(hungerQueue),
      effectStream: Stream.fromQueue(effectQueue),

      watchInventory: (playerId: PlayerId) =>
        stateManager.events.pipe(
          Stream.filter((event) => event.playerId === playerId),
          Stream.mapEffect(() => stateManager.getCurrentState(playerId)),
          Stream.filterMap((x) => x)
        ),

      watchSlot: (playerId: PlayerId, slotIndex: number) =>
        stateManager.events.pipe(
          Stream.filter(
            (event) => event.playerId === playerId && (event._tag === 'SlotUpdated' || event._tag === 'ItemMoved')
          ),
          Stream.mapEffect(() =>
            stateManager
              .getCurrentState(playerId)
              .pipe(Effect.map(Option.map((inv) => Option.fromNullable(inv.slots[slotIndex]))))
          ),
          Stream.map(Option.flatten)
        ),

      watchHotbar: (playerId: PlayerId) =>
        stateManager.events.pipe(
          Stream.filter(
            (event) => event.playerId === playerId && (event._tag === 'HotbarChanged' || event._tag === 'SlotUpdated')
          ),
          Stream.mapEffect(() =>
            stateManager
              .getCurrentState(playerId)
              .pipe(
                Effect.map(
                  Option.map((inv) => inv.hotbar.map((idx) => inv.slots[idx]) as ReadonlyArray<ItemStack | null>)
                )
              )
          ),
          Stream.filterMap((x) => x)
        ) as Stream.Stream<ReadonlyArray<ItemStack | null>, never>,

      autoStack: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* stateManager.getCurrentState(playerId)

          yield* pipe(
            inventory,
            Option.match({
              onNone: () => Effect.succeed(void 0),
              onSome: (inv) =>
                Effect.gen(function* () {
                  // Group items by ID and metadata
                  const itemGroups = new Map<string, Array<{ slot: number; item: ItemStack }>>()

                  inv.slots.forEach((item, slot) => {
                    if (!item) return
                    const key = `${item.itemId}:${JSON.stringify(item.metadata)}`
                    const group = itemGroups.get(key) ?? []
                    group.push({ slot, item })
                    itemGroups.set(key, group)
                  })

                  // Stack items in each group
                  yield* Effect.forEach(
                    itemGroups.entries(),
                    ([_, items]) =>
                      Effect.gen(function* () {
                        if (items.length <= 1) return

                        // Sort by count to fill fuller stacks first
                        items.sort((a, b) => b.item.count - a.item.count)

                        let i = 0
                        while (i < items.length - 1) {
                          const current = items[i]
                          const next = items[i + 1]

                          if (!current || !next) {
                            i++
                            continue
                          }

                          const maxStack = 64 // Should come from item definition
                          const space = maxStack - current.item.count

                          if (space > 0 && next.item.count > 0) {
                            const transfer = Math.min(space, next.item.count)

                            // Update current stack
                            yield* inventoryService.setSlotItem(playerId, current.slot, {
                              ...current.item,
                              count: current.item.count + transfer,
                            })

                            // Update next stack
                            yield* pipe(
                              Match.value(next.item.count - transfer > 0),
                              Match.when(true, () =>
                                inventoryService.setSlotItem(playerId, next.slot, {
                                  ...next.item,
                                  count: next.item.count - transfer,
                                })
                              ),
                              Match.when(false, () => inventoryService.setSlotItem(playerId, next.slot, null)),
                              Match.exhaustive
                            )

                            // Update local references for tracking
                            const updatedCurrent = {
                              ...current,
                              item: { ...current.item, count: current.item.count + transfer },
                            }
                            const updatedNext = { ...next, item: { ...next.item, count: next.item.count - transfer } }
                            items[i] = updatedCurrent

                            if (updatedNext.item.count === 0) {
                              items.splice(i + 1, 1)
                            } else {
                              items[i + 1] = updatedNext
                            }
                          } else {
                            i++
                          }
                        }
                      }),
                    { concurrency: 1 }
                  )

                  // Update state
                  const updatedInventory = yield* inventoryService.getInventory(playerId)
                  yield* stateManager.setState(playerId, updatedInventory)
                }),
            })
          )
        }).pipe(Effect.catchAll(() => Effect.succeed(void 0))),

      autoSort: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const result = yield* apiService.sortInventory(playerId) // 引数を修正
          console.log(`Inventory sorted for ${playerId}:`, result)
        }).pipe(Effect.catchAll(() => Effect.succeed(void 0))),

      autoRepair: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventory = yield* stateManager.getCurrentState(playerId)

          yield* pipe(
            inventory,
            Option.match({
              onNone: () => Effect.succeed(void 0),
              onSome: (inv) =>
                Effect.gen(function* () {
                  // Find damaged items and repair materials
                  const damagedItems: Array<{ slot: number; item: ItemStack }> = []
                  const repairMaterials: Array<{ slot: number; item: ItemStack }> = []

                  inv.slots.forEach((item, slot) => {
                    if (!item) return

                    const durability = item.metadata?.durability
                    if (durability && durability < 1000) {
                      // Assuming max durability is 1000
                      damagedItems.push({ slot, item })
                    }

                    // Check if item is repair material (placeholder logic)
                    if (item.itemId.includes('ingot') || item.itemId.includes('diamond')) {
                      repairMaterials.push({ slot, item })
                    }
                  })

                  // Perform repairs
                  yield* Effect.forEach(
                    damagedItems,
                    ({ slot, item }) =>
                      Effect.gen(function* () {
                        const material = repairMaterials.find(
                          (m) =>
                            // Placeholder matching logic
                            (item.itemId.includes('iron') && m.item.itemId === 'iron_ingot') ||
                            (item.itemId.includes('diamond') && m.item.itemId === 'diamond')
                        )

                        if (!material || material.item.count === 0) return

                        const repairAmount = 25 // Placeholder repair value
                        const newDurability = Math.min(
                          1000, // max durability
                          (item.metadata!.durability ?? 0) + repairAmount
                        )

                        // Update item durability
                        yield* inventoryService.setSlotItem(playerId, slot, {
                          ...item,
                          metadata: {
                            ...item.metadata,
                            durability: newDurability,
                          },
                        })

                        // Consume repair material
                        yield* inventoryService.removeItem(playerId, material.slot, 1)
                        // Note: removeItem should handle the count update, no direct mutation needed
                      }),
                    { concurrency: 1 }
                  )

                  // Update state
                  const updatedInventory = yield* inventoryService.getInventory(playerId)
                  yield* stateManager.setState(playerId, updatedInventory)
                }),
            })
          )
        }).pipe(Effect.catchAll(() => Effect.succeed(void 0))),

      frameMetrics: Stream.repeatEffect(Ref.get(metricsRef).pipe(Effect.delay(Duration.seconds(1)))),

      processBatch: (updates: ReadonlyArray<GameUpdate>) =>
        Effect.forEach(updates, (update) => Queue.offer(batchQueue, update), { concurrency: 'unbounded' }).pipe(
          Effect.asVoid
        ),

      queueUpdate: (update: GameUpdate) =>
        pipe(
          Match.value(update._tag),
          Match.when('DurabilityUpdate', () => Queue.offer(durabilityQueue, update as DurabilityUpdate)),
          Match.when('HungerUpdate', () => Queue.offer(hungerQueue, update as HungerUpdate)),
          Match.when('EffectUpdate', () => Queue.offer(effectQueue, update as EffectUpdate)),
          Match.exhaustive
        ),

      flushUpdates: () =>
        Effect.gen(function* () {
          const durability = yield* Queue.takeAll(durabilityQueue)
          const hunger = yield* Queue.takeAll(hungerQueue)
          const effects = yield* Queue.takeAll(effectQueue)

          const allUpdates = [
            ...Chunk.toReadonlyArray(durability),
            ...Chunk.toReadonlyArray(hunger),
            ...Chunk.toReadonlyArray(effects),
          ]

          yield* Effect.forEach(allUpdates, (update) => Queue.offer(batchQueue, update), {
            concurrency: 'unbounded',
          }).pipe(Effect.asVoid)
        }),
    })
  })
)

// Reactive helpers for game integration
export const InventoryReactiveHelpers = {
  // Create damage over time effect
  createDamageOverTime: (system: InventoryReactiveSystem, playerId: PlayerId, slotIndex: number, dps: number) =>
    Stream.repeatEffect(
      system
        .queueUpdate({
          _tag: 'DurabilityUpdate',
          playerId,
          slotIndex,
          damage: dps,
          deltaTime: 1000,
        })
        .pipe(Effect.delay(Duration.seconds(1)))
    ),

  // Monitor inventory capacity
  monitorCapacity: (
    system: InventoryReactiveSystem,
    manager: InventoryStateManager,
    playerId: PlayerId,
    threshold: number = 0.8
  ) =>
    system.watchInventory(playerId).pipe(
      Stream.tap((inventory) => {
        const used = inventory.slots.filter((s) => s !== null).length
        const total = inventory.slots.length
        const usage = used / total

        return pipe(
          Match.value(usage >= threshold),
          Match.when(true, () =>
            Effect.sync(() => console.warn(`Inventory nearly full for ${playerId}: ${Math.round(usage * 100)}%`))
          ),
          Match.when(false, () => Effect.succeed(void 0)),
          Match.exhaustive
        )
      })
    ),

  // Auto-consume food when hungry
  createAutoEat: (
    system: InventoryReactiveSystem,
    manager: InventoryStateManager,
    playerId: PlayerId,
    hungerThreshold: number = 6
  ) =>
    system.hungerStream.pipe(
      Stream.filter((update) => update.playerId === playerId),
      Stream.tap((update) =>
        Effect.gen(function* () {
          // Find food items in hotbar
          const inventory = yield* manager.getCurrentState(playerId)

          yield* pipe(
            inventory,
            Option.match({
              onNone: () => Effect.succeed(void 0),
              onSome: (inv) =>
                Effect.gen(function* () {
                  const foodSlot = inv.hotbar.find((slotIdx) => {
                    const item = inv.slots[slotIdx]
                    return item?.itemId.includes('food') || item?.itemId.includes('apple')
                  })

                  if (foodSlot !== undefined) {
                    yield* manager.removeItemTracked(playerId, foodSlot, 1)
                    console.log(`Auto-consumed food from slot ${foodSlot}`)
                  }
                }),
            })
          )
        })
      )
    ),
}
