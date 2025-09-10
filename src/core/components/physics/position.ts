import * as S from 'effect/Schema'

/**
 * Position Component - Entity's position in 3D world space
 * Note: This is a component schema, different from the Position Value Object
 */

export const PositionComponent = S.Struct({
  x: S.Number.pipe(S.finite()),
  y: S.Number.pipe(S.finite()),
  z: S.Number.pipe(S.finite()),
})

export type PositionComponent = S.Schema.Type<typeof PositionComponent>