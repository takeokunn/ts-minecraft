import { Context, Effect, Layer, Ref, Stream, SubscriptionRef } from 'effect'

import type { MenuRoute } from '../types'

export interface MenuStateStore {
  readonly get: Effect.Effect<MenuRoute>
  readonly set: (route: MenuRoute) => Effect.Effect<void>
  readonly close: () => Effect.Effect<void>
  readonly stream: () => Stream.Stream<MenuRoute>
}

export const MenuStateStoreTag = Context.GenericTag<MenuStateStore>(
  '@minecraft/presentation/menu/MenuStateStore'
)

const DEFAULT_ROUTE: MenuRoute = 'none'

export const MenuStateStoreLive = Layer.scoped(
  MenuStateStoreTag,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<MenuRoute>(DEFAULT_ROUTE)
    const subscription = yield* SubscriptionRef.make<MenuRoute>(DEFAULT_ROUTE)

    const publish = (route: MenuRoute) => SubscriptionRef.set(subscription, route)

    const get = Ref.get(stateRef)

    const set = (route: MenuRoute) => Ref.set(stateRef, route).pipe(Effect.tap(() => publish(route)))

    const close = () => set(DEFAULT_ROUTE)

    const stream = () => subscription.changes

    return MenuStateStoreTag.of({
      get,
      set,
      close,
      stream,
    })
  })
)
