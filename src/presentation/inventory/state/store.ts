
import {
  Context,
  Effect,
  HashMap,
  Layer,
  Option,
  Ref,
  Stream,
  SubscriptionRef,
  pipe,
} from 'effect'
import type { InventoryView, PlayerId } from '../adt/inventory-adt'

export interface InventoryStateStore {
  readonly get: (
    playerId: PlayerId
  ) => Effect.Effect<Option.Option<InventoryView>>
  readonly set: (
    playerId: PlayerId,
    view: InventoryView
  ) => Effect.Effect<void>
  readonly remove: (
    playerId: PlayerId
  ) => Effect.Effect<void>
  readonly clear: () => Effect.Effect<void>
  readonly snapshot: () => Effect.Effect<HashMap.HashMap<PlayerId, InventoryView>>
  readonly streamAll: () => Stream.Stream<HashMap.HashMap<PlayerId, InventoryView>>
  readonly streamByPlayer: (
    playerId: PlayerId
  ) => Stream.Stream<InventoryView>
}

export const InventoryStateStoreTag = Context.GenericTag<InventoryStateStore>(
  '@minecraft/presentation/inventory/InventoryStateStore'
)

export const InventoryStateStoreLive = Layer.effect(
  InventoryStateStoreTag,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(HashMap.empty<PlayerId, InventoryView>())
    const subscription = yield* SubscriptionRef.make(HashMap.empty<PlayerId, InventoryView>())

    const publish = (map: HashMap.HashMap<PlayerId, InventoryView>) =>
      SubscriptionRef.set(subscription, map)

    const get = (playerId: PlayerId) =>
      Ref.get(stateRef).pipe(Effect.map((map) => HashMap.get(map, playerId)))

    const set = (playerId: PlayerId, view: InventoryView) =>
      Ref.updateAndGet(stateRef, (map) => HashMap.set(map, playerId, view)).pipe(
        Effect.tap(publish),
        Effect.andThen(Effect.void)
      )

    const remove = (playerId: PlayerId) =>
      Ref.updateAndGet(stateRef, (map) => HashMap.remove(map, playerId)).pipe(
        Effect.tap(publish),
        Effect.andThen(Effect.void)
      )

    const clear = () =>
      Ref.set(stateRef, HashMap.empty<PlayerId, InventoryView>()).pipe(
        Effect.tap(() => publish(HashMap.empty<PlayerId, InventoryView>())),
        Effect.andThen(Effect.void)
      )

    const snapshot = () => Ref.get(stateRef)

    const streamAll = () => subscription.changes

    const streamByPlayer = (playerId: PlayerId) =>
      streamAll().pipe(Stream.filterMap((map) => HashMap.get(map, playerId)))

    return InventoryStateStoreTag.of({
      get,
      set,
      remove,
      clear,
      snapshot,
      streamAll,
      streamByPlayer,
    })
  })
)
