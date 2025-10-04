
import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Option, Ref, Stream } from 'effect'
import { InventoryReactiveSystemLive, InventoryReactiveSystemTag } from './reactive-system'
import {
  InventoryEventHandler,
  InventoryPanelModel,
  InventoryView,
  defaultInventoryGUIConfig,
  makeInventorySlot,
  parsePlayerId,
  slotGridPosition,
  SlotIndexSchema,
  SlotTypeSchema,
} from '../adt/inventory-adt'
import { InventoryViewModelTag } from '../view-model/inventory-view-model'
import { InventoryStateStoreLive, InventoryStateStoreTag } from './store'
import { Schema } from 'effect'

const sampleViewEffect = Effect.gen(function* () {
  const playerId = yield* parsePlayerId('player-reactive')
  const slotIndex = yield* Schema.decode(SlotIndexSchema)(0)
  const slotType = yield* Schema.decode(SlotTypeSchema)('normal')
  const position = yield* slotGridPosition({ index: 0, columns: 9, spacing: 2, slotSize: 32 })
  const slot = makeInventorySlot({
    index: slotIndex,
    section: 'main',
    slotType,
    position,
    item: Option.none(),
    isDisabled: false,
    isHighlighted: false,
  })
  const view: InventoryView = {
    playerId,
    slots: [slot],
    hotbar: [slotIndex],
    selectedSlot: slotIndex,
    armor: {
      helmet: Option.none(),
      chestplate: Option.none(),
      leggings: Option.none(),
      boots: Option.none(),
    },
    offhand: Option.none(),
  }
  const model: InventoryPanelModel = {
    playerId,
    inventory: view,
    config: defaultInventoryGUIConfig,
    isOpen: true,
  }
  return { playerId, view, model }
})

describe('presentation/inventory/state/reactive-system', () => {
  const makeLayer = Effect.gen(function* () {
    const { playerId, view, model } = yield* sampleViewEffect
    const viewModelLayer = Layer.succeed(InventoryViewModelTag, {
      handleEvent: (): Effect.Effect<void, never> => Effect.unit,
      viewOf: () => Effect.succeed(view),
      streamOf: () => Stream.succeed(view),
      panelModel: () => Effect.succeed(model),
      getConfig: () => Effect.succeed(defaultInventoryGUIConfig),
      setConfig: () => Effect.unit,
      open: () => Effect.unit,
      close: () => Effect.unit,
      isOpen: () => Effect.succeed(true),
      handler: (): InventoryEventHandler => () => Effect.unit,
    })
    const layer = Layer.mergeAll(InventoryStateStoreLive, viewModelLayer, InventoryReactiveSystemLive)
    return { layer, playerId }
  })

  it.effect('registers players and synchronizes views', () =>
    makeLayer.pipe(
      Effect.flatMap(({ layer, playerId }) =>
        Effect.gen(function* () {
          const system = yield* InventoryReactiveSystemTag
          const store = yield* InventoryStateStoreTag
          yield* system.register(playerId)
          yield* system.forceSync()
          const snapshot = yield* store.get(playerId)
          expect(Option.isSome(snapshot)).toBe(true)
        }).pipe(Effect.provideLayer(layer))
      )
    )
  )

  it.effect('unregister removes state after sync', () =>
    makeLayer.pipe(
      Effect.flatMap(({ layer, playerId }) =>
        Effect.gen(function* () {
          const system = yield* InventoryReactiveSystemTag
          const store = yield* InventoryStateStoreTag
          yield* system.register(playerId)
          yield* system.forceSync()
          yield* system.unregister(playerId)
          yield* system.forceSync()
          const snapshot = yield* store.get(playerId)
          expect(Option.isNone(snapshot)).toBe(true)
        }).pipe(Effect.provideLayer(layer))
      )
    )
  )
})
