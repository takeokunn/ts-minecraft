
import { describe, expect, it } from '@effect/vitest'
import { Effect, Fiber, HashMap, Option, Schema, Stream } from 'effect'
import { InventoryStateStoreLive, InventoryStateStoreTag } from './store'
import {
  InventoryView,
  defaultInventoryGUIConfig,
  makeInventorySlot,
  parsePlayerId,
  slotGridPosition,
  SlotIndexSchema,
  SlotTypeSchema,
} from '../adt/inventory-adt'

describe('presentation/inventory/state/store', () => {
  const sampleView = Effect.gen(function* () {
    const playerId = yield* parsePlayerId('player-test')
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
    return { playerId, view }
  })

  it.effect('stores and retrieves views', () =>
    sampleView.pipe(
      Effect.flatMap(({ playerId, view }) =>
        Effect.gen(function* () {
          const store = yield* InventoryStateStoreTag
          yield* store.set(playerId, view)
          const result = yield* store.get(playerId)
          expect(Option.isSome(result)).toBe(true)
          expect(result.value.selectedSlot).toStrictEqual(view.selectedSlot)
        })
      ),
      Effect.provideLayer(InventoryStateStoreLive)
    )
  )

  it.effect('emits updates via streamByPlayer', () =>
    sampleView.pipe(
      Effect.flatMap(({ playerId, view }) =>
        Effect.gen(function* () {
          const store = yield* InventoryStateStoreTag
          const collectedFiber = yield* store
            .streamByPlayer(playerId)
            .pipe(Stream.take(1), Stream.runCollect, Effect.forkScoped)
          yield* store.set(playerId, view)
          const chunk = yield* Fiber.join(collectedFiber)
          expect(chunk[0]?.playerId).toStrictEqual(playerId)
        })
      ),
      Effect.provideLayer(InventoryStateStoreLive)
    )
  )

  it.effect('removes individual entries and clears state', () =>
    sampleView.pipe(
      Effect.flatMap(({ playerId, view }) =>
        Effect.gen(function* () {
          const store = yield* InventoryStateStoreTag
          yield* store.set(playerId, view)
          yield* store.remove(playerId)
          expect(Option.isNone(yield* store.get(playerId))).toBe(true)
          yield* store.set(playerId, view)
          yield* store.clear()
          const snapshot = yield* store.snapshot()
          expect(HashMap.size(snapshot)).toBe(0)
        })
      ),
      Effect.provideLayer(InventoryStateStoreLive)
    )
  )
})
