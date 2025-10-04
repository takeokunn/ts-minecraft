
import { describe, expect, it } from '@effect/vitest'
import { Chunk, Effect, Fiber, HashMap, Match, Option, Schema, Stream, pipe } from 'effect'
import * as FastCheck from 'effect/FastCheck'
import { InventoryStateStoreLive, InventoryStateStoreTag } from './store'
import {
  InventoryView,
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
      Effect.provide(InventoryStateStoreLive)
    )
  )

  it.effect('emits updates via streamByPlayer', () =>
    sampleView.pipe(
      Effect.flatMap(({ playerId, view }) =>
        Effect.gen(function* () {
          const store = yield* InventoryStateStoreTag
          const fiber = yield* store
            .streamByPlayer(playerId)
            .pipe(Stream.take(1), Stream.runCollect, Effect.fork)
          yield* store.set(playerId, view)
          const chunk = yield* Fiber.join(fiber)
          const first = pipe(
            Chunk.head(chunk),
            Option.getOrElse(() => {
              throw new Error('no emission received')
            })
          )
          expect(first.playerId).toStrictEqual(playerId)
        })
      ),
      Effect.provide(InventoryStateStoreLive)
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
      Effect.provide(InventoryStateStoreLive)
    )
  )

  it.effect('clear eliminates residual state regardless of operation sequences (property)', () =>
    sampleView.pipe(
      Effect.flatMap(({ playerId, view }) =>
        Effect.gen(function* () {
          const operationsArb = FastCheck.array(FastCheck.boolean(), {
            minLength: 1,
            maxLength: 12,
          })

          yield* Effect.sync(() =>
            FastCheck.assert(
              FastCheck.property(operationsArb, (toggles) => {
                const exit = Effect.runSyncExit(
                  pipe(
                    Effect.gen(function* () {
                      const store = yield* InventoryStateStoreTag
                      yield* store.clear()
                      yield* Effect.forEach(toggles, (flag) =>
                        pipe(
                          flag,
                          Match.value,
                          Match.when(true, () => store.set(playerId, view)),
                          Match.orElse(() => store.remove(playerId))
                        )
                      )
                      yield* store.clear()
                      return yield* store.snapshot()
                    }),
                    Effect.provide(InventoryStateStoreLive)
                  )
                )
                expect(exit._tag).toBe('Success')
                expect(HashMap.size(exit.value)).toBe(0)
              }),
              { numRuns: 50 }
            )
          )
        })
      )
    )
  )
})
