
import {
  InventoryService,
} from '@domain/inventory/InventoryService'
import {
  PlayerId as DomainPlayerIdFactory,
  type Inventory as DomainInventory,
  type ItemStack as DomainItemStack,
  type PlayerId as DomainPlayerId,
} from '@domain/inventory/InventoryTypes'
import {
  DomainFailureError,
  InventoryEventHandler,
  InventoryGUIConfig,
  InventoryGUIConfigSchema,
  InventoryGUIError,
  InventoryGUIEvent,
  InventoryPanelModel,
  InventoryView,
  InvalidDropError,
  ItemDragEnd,
  ItemDropped,
  QuickDrop,
  QuickMove,
  RenderFailureError,
  SlotClicked,
  defaultInventoryGUIConfig,
  makeDropResult,
  makeInventorySlot,
  parseItemStack,
  parsePlayerId,
  parseSlotIndex,
  playerIdToString,
  slotGridPosition,
  slotIndexToNumber,
} from '../adt/inventory-adt'
import {
  Context,
  Duration,
  Effect,
  HashSet,
  Layer,
  Match,
  Option,
  Ref,
  Schedule,
  Schema,
  Stream,
  pipe,
} from 'effect'
import type { ParseError } from '@effect/schema/ParseResult'

export interface InventoryViewModel {
  readonly handleEvent: (
    playerId: InventoryView['playerId'],
    event: InventoryGUIEvent
  ) => Effect.Effect<void, InventoryGUIError>
  readonly viewOf: (
    playerId: InventoryView['playerId']
  ) => Effect.Effect<InventoryView, InventoryGUIError>
  readonly streamOf: (
    playerId: InventoryView['playerId']
  ) => Stream.Stream<InventoryView, InventoryGUIError>
  readonly panelModel: (
    playerId: InventoryView['playerId']
  ) => Effect.Effect<InventoryPanelModel, InventoryGUIError>
  readonly getConfig: () => Effect.Effect<InventoryGUIConfig>
  readonly setConfig: (
    patch: Partial<InventoryGUIConfig>
  ) => Effect.Effect<void, InventoryGUIError>
  readonly open: (playerId: InventoryView['playerId']) => Effect.Effect<void>
  readonly close: (playerId: InventoryView['playerId']) => Effect.Effect<void>
  readonly isOpen: (
    playerId: InventoryView['playerId']
  ) => Effect.Effect<boolean>
  readonly handler: (
    playerId: InventoryView['playerId']
  ) => InventoryEventHandler
}

export const InventoryViewModelTag = Context.GenericTag<InventoryViewModel>(
  '@minecraft/presentation/inventory/InventoryViewModel'
)

type FailureInput = ParseError | Error | { readonly message?: string } | { readonly _tag?: string } | string

const failureMessage = (error: FailureInput): string =>
  typeof error === 'string'
    ? error
    : 'message' in error && error.message
      ? error.message
      : '_tag' in error && error._tag
        ? JSON.stringify(error)
        : JSON.stringify(error)

const renderSchemaError = (error: FailureInput) =>
  RenderFailureError({ message: failureMessage(error) })

const toDomainFailure = (error: FailureInput) =>
  DomainFailureError({ message: failureMessage(error) })

const toDomainPlayerId = (playerId: InventoryView['playerId']): DomainPlayerId =>
  DomainPlayerIdFactory(playerIdToString(playerId))

const parseHotbarIndex = (value: number) =>
  parseSlotIndex(value)

const optionItemStack = (stack: DomainItemStack | null) =>
  pipe(
    Option.fromNullable(stack),
    Option.match({
      onNone: () => Effect.succeed(Option.none()),
      onSome: (value) =>
        parseItemStack(value).pipe(
          Effect.map(Option.some),
          Effect.mapError(renderSchemaError)
        ),
    })
  )

const collectArmor = (inventory: DomainInventory) =>
  Effect.all({
    helmet: optionItemStack(inventory.armor.helmet),
    chestplate: optionItemStack(inventory.armor.chestplate),
    leggings: optionItemStack(inventory.armor.leggings),
    boots: optionItemStack(inventory.armor.boots),
  })

const selectSlotIndex = (
  inventory: DomainInventory,
  hotbarIndices: ReadonlyArray<number>
) =>
  pipe(
    Option.fromNullable(hotbarIndices.at(inventory.selectedSlot)),
    Option.match({
      onSome: parseSlotIndex,
      onNone: () => parseSlotIndex(inventory.selectedSlot),
    })
  )

const buildInventorySlots = (
  inventory: DomainInventory,
  hotbarIndices: ReadonlyArray<number>,
  config: InventoryGUIConfig,
  highlightedSlot: SlotClicked['slot']
) => {
  const hotbarSet = HashSet.fromIterable(hotbarIndices)
  const slotEffects = inventory.slots.map((rawItem, index) =>
    Effect.gen(function* () {
      const slotIndex = yield* parseSlotIndex(index).pipe(Effect.mapError(renderSchemaError))
      const position = yield* slotGridPosition({
        index,
        columns: config.columns,
        spacing: config.slotSpacing,
        slotSize: config.slotSize,
      }).pipe(Effect.mapError(renderSchemaError))
      const item = yield* optionItemStack(rawItem)
      const section = pipe(
        HashSet.has(hotbarSet, index),
        Match.value,
        Match.when(true, () => 'hotbar'),
        Match.orElse(() => 'main')
      )
      const isHighlighted = pipe(
        slotIndexToNumber(slotIndex) === slotIndexToNumber(highlightedSlot),
        Match.value,
        Match.when(true, () => true),
        Match.orElse(() => false)
      )
      return makeInventorySlot({
        index: slotIndex,
        section,
        slotType: 'normal',
        position,
        item,
        isHighlighted,
        isDisabled: false,
      })
    })
  )

  return Effect.forEach(slotEffects, (effect) => effect, { concurrency: 'unbounded' })
}

const toInventoryView = (
  inventory: DomainInventory,
  config: InventoryGUIConfig
): Effect.Effect<InventoryView, InventoryGUIError> =>
  Effect.gen(function* () {
    const playerId = yield* parsePlayerId(playerIdToString(inventory.playerId)).pipe(
      Effect.mapError(renderSchemaError)
    )
    const hotbar = yield* Effect.forEach(
      inventory.hotbar,
      (slot) => parseHotbarIndex(slot).pipe(Effect.mapError(renderSchemaError)),
      { concurrency: 'unbounded' }
    )
    const selectedSlot = yield* selectSlotIndex(inventory, inventory.hotbar).pipe(
      Effect.mapError(renderSchemaError)
    )
    const slots = yield* buildInventorySlots(inventory, inventory.hotbar, config, selectedSlot)
    const armor = yield* collectArmor(inventory)
    const offhand = yield* optionItemStack(inventory.offhand)

    return {
      playerId,
      slots,
      hotbar,
      selectedSlot,
      armor,
      offhand,
    }
  })

const partialConfigSchema = Schema.partial(InventoryGUIConfigSchema)

const applyConfigPatch = (
  current: InventoryGUIConfig,
  patch: Partial<InventoryGUIConfig>
): Effect.Effect<InventoryGUIConfig, InventoryGUIError> =>
  Schema.decode(partialConfigSchema)(patch).pipe(
    Effect.map((validated) => ({ ...current, ...validated })),
    Effect.mapError(renderSchemaError)
  )

const handleSlotClicked = (
  service: InventoryService,
  playerId: DomainPlayerId,
  event: SlotClicked
) =>
  service
    .setSelectedSlot(playerId, slotIndexToNumber(event.slot))
    .pipe(Effect.mapError(toDomainFailure))

const handleItemDropped = (
  service: InventoryService,
  playerId: DomainPlayerId,
  event: ItemDropped
) =>
  service
    .moveItem(
      playerId,
      slotIndexToNumber(event.sourceSlot),
      slotIndexToNumber(event.targetSlot)
    )
    .pipe(Effect.mapError(toDomainFailure))

const handleDragEnd = (
  service: InventoryService,
  playerId: DomainPlayerId,
  event: ItemDragEnd
) =>
  pipe(
    event.result,
    Option.match({
      onNone: () => Effect.unit,
      onSome: (payload) =>
        makeDropResult(payload).pipe(
          Effect.mapError(renderSchemaError),
          Effect.flatMap((drop) =>
            pipe(
              drop.action,
              Match.value,
              Match.when('move', () =>
                service
                  .moveItem(
                    playerId,
                    slotIndexToNumber(drop.sourceSlot),
                    slotIndexToNumber(drop.targetSlot),
                    drop.amount
                  )
                  .pipe(Effect.mapError(toDomainFailure))
              ),
              Match.when('swap', () =>
                service
                  .swapItems(
                    playerId,
                    slotIndexToNumber(drop.sourceSlot),
                    slotIndexToNumber(drop.targetSlot)
                  )
                  .pipe(Effect.mapError(toDomainFailure))
              ),
              Match.when('merge', () =>
                service
                  .mergeStacks(
                    playerId,
                    slotIndexToNumber(drop.sourceSlot),
                    slotIndexToNumber(drop.targetSlot)
                  )
                  .pipe(Effect.mapError(toDomainFailure))
              ),
              Match.when('split', () =>
                service
                  .splitStack(
                    playerId,
                    slotIndexToNumber(drop.sourceSlot),
                    slotIndexToNumber(drop.targetSlot),
                    drop.amount
                  )
                  .pipe(Effect.mapError(toDomainFailure))
              ),
              Match.when('rejected', () =>
                Effect.fail<InventoryGUIError>(
                  InvalidDropError({ reason: 'Drop rejected' })
                )
              ),
              Match.exhaustive
            )
          )
        ),
    })
  )

const findEmptyHotbarSlot = (
  service: InventoryService,
  playerId: DomainPlayerId,
  indices: ReadonlyArray<number>
): Effect.Effect<Option.Option<number>, InventoryGUIError> =>
  pipe(
    indices.length,
    Match.value,
    Match.when(0, () => Effect.succeed(Option.none<number>())),
    Match.orElse(() =>
      Effect.gen(function* () {
        const [head, ...tail] = indices
        const slotItem = yield* service
          .getSlotItem(playerId, head)
          .pipe(Effect.mapError(toDomainFailure))
        return yield* pipe(
          Option.fromNullable(slotItem),
          Option.match({
            onSome: () => findEmptyHotbarSlot(service, playerId, tail),
            onNone: () => Effect.succeed(Option.some(head)),
          })
        )
      })
    )
  )

const handleQuickMove = (
  service: InventoryService,
  playerId: DomainPlayerId,
  event: QuickMove
) =>
  Effect.gen(function* () {
    const inventory = yield* service.getInventory(playerId)
    const candidate = yield* findEmptyHotbarSlot(service, playerId, inventory.hotbar)
    const fallbackHotbarIndex = pipe(
      inventory.hotbar.at(0),
      Option.fromNullable,
      Option.getOrElse(() => 0)
    )
    return yield* pipe(
      candidate,
      Option.match({
        onNone: () =>
          service
            .transferToHotbar(
              playerId,
              slotIndexToNumber(event.slot),
              fallbackHotbarIndex
            )
            .pipe(Effect.mapError(toDomainFailure)),
        onSome: (index) =>
          service
            .transferToHotbar(
              playerId,
              slotIndexToNumber(event.slot),
              index
            )
            .pipe(Effect.mapError(toDomainFailure)),
      })
    )
  })

const handleQuickDrop = (
  service: InventoryService,
  playerId: DomainPlayerId,
  event: QuickDrop
) =>
  pipe(
    event.all,
    Match.value,
    Match.when(true, () =>
      service.dropAllItems(playerId).pipe(Effect.mapError(toDomainFailure), Effect.asVoid)
    ),
    Match.orElse(() =>
      service
        .dropItem(playerId, slotIndexToNumber(event.slot))
        .pipe(Effect.mapError(toDomainFailure), Effect.asVoid)
    )
  )

const handleHotbarSelected = (
  service: InventoryService,
  playerId: DomainPlayerId,
  slot: SlotClicked['slot']
) =>
  service
    .setSelectedSlot(playerId, slotIndexToNumber(slot))
    .pipe(Effect.mapError(toDomainFailure))

export const InventoryViewModelLive = Layer.effect(
  InventoryViewModelTag,
  Effect.gen(function* () {
    const service = yield* InventoryService
    const configRef = yield* Ref.make(defaultInventoryGUIConfig)
    const openPlayersRef = yield* Ref.make(HashSet.empty<InventoryView['playerId']>())

    const viewOf = (playerId: InventoryView['playerId']) =>
      Effect.gen(function* () {
        const config = yield* Ref.get(configRef)
        const inventory = yield* service.getInventory(toDomainPlayerId(playerId))
        return yield* toInventoryView(inventory, config)
      })

    const panelModel = (playerId: InventoryView['playerId']) =>
      Effect.gen(function* () {
        const config = yield* Ref.get(configRef)
        const inventoryView = yield* viewOf(playerId)
        const isOpen = yield* isOpenInventory(playerId)
        return {
          playerId,
          inventory: inventoryView,
          config,
          isOpen,
        }
      })

    const isOpenInventory = (playerId: InventoryView['playerId']) =>
      Ref.get(openPlayersRef).pipe(Effect.map((set) => HashSet.has(set, playerId)))

    const openInventory = (playerId: InventoryView['playerId']) =>
      Ref.update(openPlayersRef, (set) => HashSet.add(set, playerId)).pipe(Effect.asVoid)

    const closeInventory = (playerId: InventoryView['playerId']) =>
      Ref.update(openPlayersRef, (set) => HashSet.remove(set, playerId)).pipe(Effect.asVoid)

    const getConfig = () => Ref.get(configRef)

    const setConfig = (patch: Partial<InventoryGUIConfig>) =>
      Ref.get(configRef).pipe(
        Effect.flatMap((current) => applyConfigPatch(current, patch)),
        Effect.tap((next) => Ref.set(configRef, next))
      )

    const streamOf = (playerId: InventoryView['playerId']) =>
      Stream.repeatEffectWith(
        viewOf(playerId),
        Schedule.spaced(Duration.millis(100))
      )

    const handleEvent = (
      playerId: InventoryView['playerId'],
      event: InventoryGUIEvent
    ): Effect.Effect<void, InventoryGUIError> =>
      pipe(
        event,
        Match.value,
        Match.tags({
          SlotClicked: (payload) => handleSlotClicked(service, toDomainPlayerId(playerId), payload),
          SlotHovered: () => Effect.unit,
          SlotUnhovered: () => Effect.unit,
          ItemDragStart: () => Effect.unit,
          ItemDragEnd: (payload) => handleDragEnd(service, toDomainPlayerId(playerId), payload),
          ItemDropped: (payload) => handleItemDropped(service, toDomainPlayerId(playerId), payload),
          HotbarSelected: (payload) => handleHotbarSelected(service, toDomainPlayerId(playerId), payload.index),
          InventoryOpened: () => openInventory(playerId),
          InventoryClosed: () => closeInventory(playerId),
          QuickMove: (payload) => handleQuickMove(service, toDomainPlayerId(playerId), payload),
          QuickDrop: (payload) => handleQuickDrop(service, toDomainPlayerId(playerId), payload),
        }),
        Match.orElse(() => Effect.unit)
      )

    return InventoryViewModelTag.of({
      handleEvent,
      viewOf,
      streamOf,
      panelModel,
      getConfig,
      setConfig,
      open: openInventory,
      close: closeInventory,
      isOpen: isOpenInventory,
      handler: (playerId) => (event) => handleEvent(playerId, event),
    })
  })
)
