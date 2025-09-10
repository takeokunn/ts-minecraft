import * as S from 'effect/Schema'

/**
 * Velocity Component - Entity's velocity in 3D space
 * Note: This is a component schema, different from the Velocity Value Object
 */

export const VelocityComponent = S.Struct({
  dx: S.Number.pipe(S.finite()),
  dy: S.Number.pipe(S.finite()),
  dz: S.Number.pipe(S.finite()),
})

export type VelocityComponent = S.Schema.Type<typeof VelocityComponent>