import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

const mergeLayers = (layers: ReadonlyArray<Layer.Layer.Any>): Layer.Layer.Any | undefined =>
  layers.length === 0 ? undefined : layers.length === 1 ? layers[0] : Layer.mergeAll(layers[0], ...layers.slice(1))

const applyLayers = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layers: ReadonlyArray<Layer.Layer.Any>
): Effect.Effect<A, E, never> => {
  const merged = mergeLayers(layers)
  if (!merged) {
    return effect as Effect.Effect<A, E, never>
  }

  return Effect.provide(effect, merged) as Effect.Effect<A, E, never>
}

const applyLayersScoped = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layers: ReadonlyArray<Layer.Layer.Any>
): Effect.Effect<A, E, never> => {
  const merged = mergeLayers(layers)
  if (!merged) {
    return effect as Effect.Effect<A, E, never>
  }

  return Effect.scoped(Effect.provide(effect, merged)) as Effect.Effect<A, E, never>
}

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
    return applyLayers(first, rest)
  }

  const layers = [first, ...rest]
  return <A, E, R>(effect: Effect.Effect<A, E, R>) => applyLayers(effect, layers)
}

export function provideLayersScoped<Layers extends readonly Layer.Layer.Any[], A, E, R>(
  effect: Effect.Effect<A, E, R>,
  ...layers: Layers
): Effect.Effect<A, E, never>
export function provideLayersScoped<Layers extends readonly Layer.Layer.Any[]>(
  ...layers: Layers
): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, never>
export function provideLayersScoped(
  first: Effect.Effect<any, any, any> | Layer.Layer.Any,
  ...rest: ReadonlyArray<Layer.Layer.Any>
): Effect.Effect<any, any, never> | (<A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, never>) {
  if (Effect.isEffect(first)) {
    return applyLayersScoped(first, rest)
  }

  const layers = [first, ...rest]
  return <A, E, R>(effect: Effect.Effect<A, E, R>) => applyLayersScoped(effect, layers)
}
