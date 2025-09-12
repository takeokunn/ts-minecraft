import * as S from 'effect/Schema'
import { Effect, pipe } from 'effect'
import type { ParseResult } from 'effect/ParseResult'

export const Velocity = S.Struct({
  _tag: S.Literal('Velocity'),
  dx: S.Number,
  dy: S.Number,
  dz: S.Number,
})
export type Velocity = S.Schema.Type<typeof Velocity>

export const makeVelocity = (dx: number, dy: number, dz: number): Effect.Effect<Velocity, ParseResult.ParseError> =>
  pipe(
    { _tag: 'Velocity' as const, dx, dy, dz },
    S.decode(Velocity)
  )

export const fromUnknown = (value: unknown): Effect.Effect<Velocity, ParseResult.ParseError> =>
  pipe(
    value,
    S.decode(Velocity)
  )
