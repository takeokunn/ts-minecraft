import { describe, expect, it } from '@effect/vitest'
import { Context, Effect, Layer, Match, Option, Schema, Stream, pipe } from 'effect'
import * as FastCheck from 'effect/FastCheck'
import {
  InventoryEventHandler,
  InventoryPanelModel,
  InventoryView,
  SlotIndexSchema,
  SlotTypeSchema,
  defaultInventoryGUIConfig,
  makeInventorySlot,
  parsePlayerId,
  slotGridPosition,
} from '../adt/inventory-adt'
import { InventoryViewModelTag } from '../view-model/inventory-view-model'
import { InventoryReactiveSystemLive, InventoryReactiveSystemTag } from './reactive-system'
import { InventoryStateStoreLive, InventoryStateStoreTag } from './store'

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
    return { viewModelLayer, playerId }
  })

  it.effect('registers players and synchronizes views', () =>
    makeLayer.pipe(
      Effect.flatMap(({ viewModelLayer, playerId }) =>
        Effect.scoped(
          Effect.gen(function* () {
            const storeLayer = InventoryStateStoreLive
            const systemLayer = InventoryReactiveSystemLive.pipe(
              Layer.provide(storeLayer),
              Layer.provide(viewModelLayer)
            )
            const context = yield* Layer.build(Layer.mergeAll(storeLayer, systemLayer))
            const system = Context.get(context, InventoryReactiveSystemTag)
            const store = Context.get(context, InventoryStateStoreTag)
            yield* system.register(playerId)
            yield* system.forceSync()
            const snapshot = yield* store.get(playerId)
            expect(Option.isSome(snapshot)).toBe(true)
          })
        )
      )
    )
  )

  it.effect('unregister removes state after sync', () =>
    makeLayer.pipe(
      Effect.flatMap(({ viewModelLayer, playerId }) =>
        Effect.scoped(
          Effect.gen(function* () {
            const storeLayer = InventoryStateStoreLive
            const systemLayer = InventoryReactiveSystemLive.pipe(
              Layer.provide(storeLayer),
              Layer.provide(viewModelLayer)
            )
            const context = yield* Layer.build(Layer.mergeAll(storeLayer, systemLayer))
            const system = Context.get(context, InventoryReactiveSystemTag)
            const store = Context.get(context, InventoryStateStoreTag)
            yield* system.register(playerId)
            yield* system.forceSync()
            yield* system.unregister(playerId)
            yield* system.forceSync()
            const snapshot = yield* store.get(playerId)
            expect(Option.isNone(snapshot)).toBe(true)
          })
        )
      )
    )
  )

  it.effect('registration workflow maintains membership invariants (property)', () =>
    makeLayer.pipe(
      Effect.flatMap(({ viewModelLayer, playerId }) =>
        Effect.gen(function* () {
          const togglesArb = FastCheck.array(FastCheck.boolean(), {
            minLength: 1,
            maxLength: 12,
          })

          yield* Effect.sync(() =>
            FastCheck.assert(
              FastCheck.property(togglesArb, (toggles) => {
                const exit = Effect.runSyncExit(
                  Effect.scoped(
                    Effect.gen(function* () {
                      const storeLayer = InventoryStateStoreLive
                      const systemLayer = InventoryReactiveSystemLive.pipe(
                        Layer.provide(storeLayer),
                        Layer.provide(viewModelLayer)
                      )
                      const context = yield* Layer.build(Layer.mergeAll(storeLayer, systemLayer))
                      const system = Context.get(context, InventoryReactiveSystemTag)
                      const store = Context.get(context, InventoryStateStoreTag)
                      yield* system.forceSync()
                      yield* Effect.forEach(toggles, (flag) =>
                        pipe(
                          flag,
                          Match.value,
                          Match.when(true, () => system.register(playerId)),
                          Match.orElse(() => system.unregister(playerId))
                        )
                      )
                      yield* system.forceSync()
                      return yield* store.get(playerId)
                    })
                  )
                )
                expect(exit._tag).toBe('Success')
                const expectedPresent = toggles.reduce(
                  (_present, flag) =>
                    pipe(
                      flag,
                      Match.value,
                      Match.when(true, () => true),
                      Match.orElse(() => false)
                    ),
                  false
                )
                pipe(
                  expectedPresent,
                  Match.value,
                  Match.when(true, () => expect(Option.isSome(exit.value)).toBe(true)),
                  Match.orElse(() => expect(Option.isNone(exit.value)).toBe(true))
                )
              }),
              { numRuns: 50 }
            )
          )
        })
      )
    )
  )
})
