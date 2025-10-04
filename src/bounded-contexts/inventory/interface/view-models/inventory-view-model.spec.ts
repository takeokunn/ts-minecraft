
import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Option, Ref } from 'effect'
import {
  InventoryViewModelLive,
  InventoryViewModelTag,
} from './inventory-view-model'
import {
  ItemDragEnd,
  ItemDropped,
  InventoryClosed,
  InventoryOpened,
  QuickDrop,
  QuickMove,
  SlotClicked,
  makeDropResult,
  parsePlayerId,
  parseSlotIndex,
  slotGridPosition,
} from '@presentation/inventory/adt/inventory-adt'
import {
  ItemId as DomainItemId,
  ItemStack as DomainItemStack,
  PlayerId as DomainPlayerId,
  createEmptyInventory,
} from '@mc/bc-inventory/domain/inventory-types'
import {
  InventoryUiService,
  toInventoryDTO,
  toItemStackDTO,
  type ItemStackDTO,
} from '@mc/bc-inventory/application/use-cases/inventory-ui-service'

interface TestContext {
  readonly layer: Layer.Layer<never, never, InventoryViewModelTag>
  readonly operations: Ref.Ref<ReadonlyArray<string>>
  readonly playerId: Awaited<ReturnType<typeof parsePlayerId>>
}

const makeTestContext = () =>
  Effect.gen(function* () {
  const operations = yield* Ref.make<ReadonlyArray<string>>([])
  const record = (entry: string) => Ref.update(operations, (logs) => [...logs, entry])

  const domainPlayerId: DomainPlayerId = DomainPlayerId('player-1')
  const inventory = createEmptyInventory(domainPlayerId)
  const sampleItem: DomainItemStack = {
    itemId: DomainItemId('minecraft:stone'),
    count: 1,
  }
  inventory.slots[0] = sampleItem

  const dtoInventory = toInventoryDTO(inventory)

  const service: InventoryUiService = {
    getInventory: () => Effect.succeed(dtoInventory),
    getSlotItem: (_, slot) => Effect.succeed(toItemStackDTO(inventory.slots[slot] ?? null)),
    setSelectedSlot: (_, slot) => record(`select:${slot}`),
    moveItem: (_, from, to) => record(`move:${from}->${to}`),
    swapItems: (_, first, second) => record(`swap:${first}<->${second}`),
    mergeStacks: (_, source, target) => record(`merge:${source}->${target}`),
    splitStack: (_, source, target, amount) => record(`split:${source}->${target}(${amount})`),
    transferToHotbar: (_, slot, hotbar) => record(`transfer:${slot}->${hotbar}`),
    dropItem: (_, slot) => record(`drop:${slot}`).pipe(Effect.as(null)),
    dropAllItems: () =>
      record('dropAll').pipe(
        Effect.andThen(Effect.succeed<ReadonlyArray<ItemStackDTO>>([]))
      ),
  }

  const layer = InventoryViewModelLive.pipe(
    Layer.provide(Layer.succeed(InventoryUiService, service))
  )
  const playerId = yield* parsePlayerId('player-1')
    return { layer, operations, playerId }
  })

describe('presentation/inventory/view-model', () => {
  it.effect('converts domain inventory to view representation', () =>
    makeTestContext().pipe(
      Effect.flatMap(({ layer, playerId }) =>
        Effect.gen(function* () {
          const viewModel = yield* InventoryViewModelTag
          const view = yield* viewModel.viewOf(playerId)
          expect(view.slots.length).toBe(36)
          expect(view.hotbar.length).toBe(9)
          const firstSlot = view.slots[0]
          expect(Option.isSome(firstSlot.item)).toBe(true)
        }).pipe(Effect.provide(layer))
      )
    )
  )

  it.effect('tracks open state via events', () =>
    makeTestContext().pipe(
      Effect.flatMap(({ layer, playerId }) =>
        Effect.gen(function* () {
          const viewModel = yield* InventoryViewModelTag
          yield* viewModel.handleEvent(playerId, InventoryOpened({}))
          const open = yield* viewModel.isOpen(playerId)
          expect(open).toBe(true)
          yield* viewModel.handleEvent(playerId, InventoryClosed({}))
          const closed = yield* viewModel.isOpen(playerId)
          expect(closed).toBe(false)
        }).pipe(Effect.provide(layer))
      )
    )
  )

  it.effect('logs domain operations for slot interactions', () =>
    makeTestContext().pipe(
      Effect.flatMap(({ layer, playerId, operations }) =>
        Effect.gen(function* () {
          const viewModel = yield* InventoryViewModelTag
          const slot = yield* parseSlotIndex(1)
          yield* viewModel.handleEvent(playerId, SlotClicked({ slot, button: 'left' }))
          const logs = yield* Ref.get(operations)
          expect(logs).toContain('select:1')
        }).pipe(Effect.provide(layer))
      )
    )
  )

  it.effect('routes quick move and drop operations', () =>
    makeTestContext().pipe(
      Effect.flatMap(({ layer, playerId, operations }) =>
        Effect.gen(function* () {
          const viewModel = yield* InventoryViewModelTag
          const slot = yield* parseSlotIndex(2)
          yield* viewModel.handleEvent(playerId, QuickMove({ slot }))
          yield* viewModel.handleEvent(playerId, QuickDrop({ slot, all: false }))
          yield* viewModel.handleEvent(playerId, QuickDrop({ slot, all: true }))
          const logs = yield* Ref.get(operations)
          expect(logs).toContain('transfer:2->1')
          expect(logs).toContain('drop:2')
          expect(logs).toContain('dropAll')
        }).pipe(Effect.provide(layer))
      )
    )
  )

  it.effect('handles item drops and drag results', () =>
    makeTestContext().pipe(
      Effect.flatMap(({ layer, playerId, operations }) =>
        Effect.gen(function* () {
          const viewModel = yield* InventoryViewModelTag
          const source = yield* parseSlotIndex(1)
          const target = yield* parseSlotIndex(3)
          yield* viewModel.handleEvent(playerId, ItemDropped({ sourceSlot: source, targetSlot: target }))
          const drop = yield* makeDropResult({
            accepted: true,
            action: 'swap',
            sourceSlot: source,
            targetSlot: target,
            amount: 1,
          })
          yield* viewModel.handleEvent(playerId, ItemDragEnd({ result: Option.some(drop) }))
          const logs = yield* Ref.get(operations)
          expect(logs).toContain('move:1->3')
          expect(logs).toContain('swap:1<->3')
        }).pipe(Effect.provide(layer))
      )
    )
  )

  it.effect('fails rejected drag results with InvalidDropError', () =>
    makeTestContext().pipe(
      Effect.flatMap(({ layer, playerId }) =>
        Effect.gen(function* () {
          const viewModel = yield* InventoryViewModelTag
          const slot = yield* parseSlotIndex(0)
          const rejected = yield* makeDropResult({
            accepted: false,
            action: 'rejected',
            sourceSlot: slot,
            targetSlot: slot,
            amount: 0,
          })
          const result = yield* viewModel
            .handleEvent(playerId, ItemDragEnd({ result: Option.some(rejected) }))
            .pipe(Effect.either)
          expect(result._tag).toBe('Left')
        }).pipe(Effect.provide(layer))
      )
    )
  )
})
