import { Effect } from 'effect/Effect'
import { Layer } from 'effect/Layer'
import { Match } from 'effect/Match'
import { pipe } from 'effect/Function'

export type LayerFactory<R, E, A> = () => Layer<Readonly<A>, E, R>

export const ensureEffect = <A, E, R>(options: {
  readonly candidate: unknown
  readonly fallback?: Effect<A, E, R>
  readonly onInvalid?: () => Effect<A, E, R>
}): Effect<A, E, R> =>
  pipe(
    options.candidate,
    Match.value,
    Match.when(
      (value): value is Effect<A, E, R> => Effect.isEffect(value),
      (effect) => effect
    ),
    Match.when(undefined, () => options.fallback ?? Effect.void as Effect<A, E, R>),
    Match.when(null, () => options.fallback ?? Effect.void as Effect<A, E, R>),
    Match.orElse(() =>
      options.onInvalid?.() ?? (options.fallback ?? (Effect.void as Effect<A, E, R>))
    )
  )
