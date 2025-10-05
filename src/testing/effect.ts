import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

const mergeLayers = (layers: ReadonlyArray<Layer.Layer.Any>): Layer.Layer.Any | undefined => {
  if (layers.length === 0) {
    return undefined
  }

  if (layers.length === 1) {
    return layers[0]
  }

  return Layer.mergeAll(layers[0], ...layers.slice(1))
}

const provideContext = <A, E, R extends Context.Context<any>>(
  effect: Effect.Effect<A, E, R>,
  context: Context.Context<any>
) => Effect.provide(effect, context)

const provideLayer = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layer: Layer.Layer.Any | undefined
): Effect.Effect<A, E, never> => {
  if (!layer) {
    return effect as Effect.Effect<A, E, never>
  }

  return Effect.scoped(
    Layer.build(layer).pipe(
      Effect.flatMap((context) => provideContext(effect, context))
    )
  ) as Effect.Effect<A, E, never>
}

const provideLayersInternal = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layers: ReadonlyArray<Layer.Layer.Any>
): Effect.Effect<A, E, never> => provideLayer(effect, mergeLayers(layers))

export function provideLayers<Layers extends readonly Layer.Layer.Any[], A, E, R>(
  effect: Effect.Effect<A, E, R>,
  ...layers: Layers
): Effect.Effect<A, E, never>
export function provideLayers<Layers extends readonly Layer.Layer.Any[]>(
  ...layers: Layers
): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, never>
export function provideLayers(
  first: Effect.Effect<any, any, any> | Layer.Layer.Any,
  ...rest: ReadonlyArray<Layer.Layer.Any>
): Effect.Effect<any, any, never> | (<A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, never>) {
  if (Effect.isEffect(first)) {
    return provideLayersInternal(first, rest)
  }

  const layers = [first, ...rest]
  return <A, E, R>(effect: Effect.Effect<A, E, R>) => provideLayersInternal(effect, layers)
}

export const provideLayersScoped = provideLayers
