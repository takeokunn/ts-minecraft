import { Clock, Context, Effect, Layer, Schema } from 'effect'
import type { Brand } from 'effect'
import { pipe } from 'effect/Function'

export type EpochMillis = number & Brand<'EpochMillis'>

const EpochMillisSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('EpochMillis')
)

export interface DomainClock {
  readonly now: () => Effect.Effect<EpochMillis, Schema.ParseError>
  readonly monotonic: () => Effect.Effect<bigint>
  readonly measure: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<{ readonly duration: bigint; readonly value: A }, E, R>
}

export const DomainClock = Context.Tag<DomainClock>('DomainClock')

const domainClockLive: DomainClock = {
  now: () =>
    pipe(
      Clock.currentTimeMillis,
      Effect.flatMap((millis) => Schema.decodeEffect(EpochMillisSchema)(millis))
    ),
  monotonic: () => Clock.currentTimeNanos,
  measure: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.gen(function* () {
      const start = yield* Clock.currentTimeNanos
      const value = yield* effect
      const end = yield* Clock.currentTimeNanos

      return { duration: end - start, value }
    }),
}

export const DomainClockLive = Layer.succeed(DomainClock, domainClockLive)
