import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

export const provideLayers = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  ...layers: ReadonlyArray<Layer.Layer.Any>
): Effect.Effect<A, E, never> =>
  layers.reduce<Effect.Effect<A, E, any>>(
    (acc, layer) => Effect.provide(layer)(acc),
    effect
  ) as Effect.Effect<A, E, never>
