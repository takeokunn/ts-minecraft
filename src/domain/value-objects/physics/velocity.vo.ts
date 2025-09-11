import * as S from 'effect/Schema'

export const Velocity = S.Struct({
  _tag: S.Literal('Velocity'),
  dx: S.Number,
  dy: S.Number,
  dz: S.Number,
})
export type Velocity = S.Schema.Type<typeof Velocity>

export const makeVelocity = (dx: number, dy: number, dz: number) => S.decodeSync(Velocity)({ _tag: 'Velocity', dx, dy, dz })
