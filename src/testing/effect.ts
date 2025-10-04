import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

/**
 * テストで複数の Layer を適用するための共通ヘルパー。
 * 指定された Layer 群をまとめて提供したスコープ付き Effect を返却する。
 */
export const provideLayers = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  ...layers: ReadonlyArray<Layer.Layer<any, any, any>>
): Effect.Effect<A, E, never> =>
  layers.reduce<Effect.Effect<A, E, any>>(
    (acc, layer) => Effect.provide(acc, layer as Layer.Layer.Any),
    effect
  ) as Effect.Effect<A, E, never>
