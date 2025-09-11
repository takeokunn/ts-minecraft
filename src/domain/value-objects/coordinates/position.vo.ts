import * as S from 'effect/Schema'
import { pipe } from 'effect'

export const X = pipe(S.Number, S.finite, S.brand('X'))
export type X = S.Schema.Type<typeof X>

export const Y = pipe(S.Number, S.between(0, 256), S.brand('Y'))
export type Y = S.Schema.Type<typeof Y>

export const Z = pipe(S.Number, S.finite, S.brand('Z'))
export type Z = S.Schema.Type<typeof Z>

export const Position = S.Struct({
  _tag: S.Literal('Position'),
  x: X,
  y: Y,
  z: Z
})
export type Position = S.Schema.Type<typeof Position>

export const makePosition = (x: number, y: number, z: number) =>
  S.decodeSync(Position)({ _tag: 'Position', x, y, z })