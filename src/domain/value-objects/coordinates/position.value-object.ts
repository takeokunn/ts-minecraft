import * as S from 'effect/Schema'
import { Effect, pipe } from 'effect'
import type { ParseResult } from 'effect/ParseResult'

export const X = S.Number.pipe(S.finite(), S.brand('X'))
export type X = S.Schema.Type<typeof X>

export const Y = S.Number.pipe(S.between(0, 256), S.brand('Y'))
export type Y = S.Schema.Type<typeof Y>

export const Z = S.Number.pipe(S.finite(), S.brand('Z'))
export type Z = S.Schema.Type<typeof Z>

export const Position = S.Struct({
  _tag: S.Literal('Position'),
  x: X,
  y: Y,
  z: Z,
})
export type Position = S.Schema.Type<typeof Position>

export const makePosition = (x: number, y: number, z: number): Effect.Effect<Position, ParseResult.ParseError> =>
  pipe(
    { _tag: 'Position' as const, x, y, z },
    S.decode(Position)
  )

export const fromUnknown = (value: unknown): Effect.Effect<Position, ParseResult.ParseError> =>
  pipe(
    value,
    S.decode(Position)
  )
