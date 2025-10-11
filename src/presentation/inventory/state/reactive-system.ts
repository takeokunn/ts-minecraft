import { Context, Duration, Effect, Fiber, HashSet, Layer, Ref, Schedule, Stream } from 'effect'
import type { InventoryGUIError, PlayerId } from '../adt'
import { InventoryViewModelTag } from '../view-model'
import { InventoryStateStoreTag } from './store'

export interface InventoryReactiveSystem {
  readonly register: (playerId: PlayerId) => Effect.Effect<void, InventoryGUIError>
  readonly unregister: (playerId: PlayerId) => Effect.Effect<void>
  readonly start: (tickMillis: number) => Effect.Effect<Fiber.RuntimeFiber<void, InventoryGUIError>>
  readonly stop: (fiber: Fiber.RuntimeFiber<void, InventoryGUIError>) => Effect.Effect<void>
  readonly forceSync: () => Effect.Effect<void, InventoryGUIError>
}

export const InventoryReactiveSystemTag = Context.GenericTag<InventoryReactiveSystem>(
  '@minecraft/presentation/inventory/InventoryReactiveSystem'
)

export const InventoryReactiveSystemLive = Layer.scoped(
  InventoryReactiveSystemTag,
  Effect.gen(function* () {
    const viewModel = yield* InventoryViewModelTag
    const stateStore = yield* InventoryStateStoreTag
    const trackedRef = yield* Ref.make(HashSet.empty<PlayerId>())

    const syncPlayer = (playerId: PlayerId) =>
      viewModel.viewOf(playerId).pipe(Effect.tap((view) => stateStore.set(playerId, view)))

    const syncAll = () =>
      Ref.get(trackedRef).pipe(
        Effect.flatMap((set) =>
          Effect.forEach(HashSet.values(set), syncPlayer, {
            concurrency: 4,
          })
        ),
        Effect.asVoid
      )

    const register = (playerId: PlayerId) =>
      Ref.update(trackedRef, (set) => HashSet.add(set, playerId)).pipe(Effect.flatMap(() => syncPlayer(playerId)))

    const unregister = (playerId: PlayerId) =>
      Ref.update(trackedRef, (set) => HashSet.remove(set, playerId)).pipe(
        Effect.tap(() => stateStore.remove(playerId)),
        Effect.asVoid
      )

    const start = (tickMillis: number) =>
      Stream.repeatEffect(syncAll)
        .pipe(Stream.schedule(Schedule.spaced(Duration.millis(tickMillis))))
        .pipe(Stream.runDrain)
        .pipe(Effect.forkScoped)

    const stop = (fiber: Fiber.RuntimeFiber<void, InventoryGUIError>) => Fiber.interrupt(fiber)

    const forceSync = () => syncAll()

    return InventoryReactiveSystemTag.of({
      register,
      unregister,
      start,
      stop,
      forceSync,
    })
  })
)
