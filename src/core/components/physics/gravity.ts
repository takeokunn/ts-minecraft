import * as S from 'effect/Schema'

/**
 * Gravity Component - Gravity force applied to entity
 */

export const GravityComponent = S.Struct({
  value: S.Number.pipe(S.finite()),
})

export type GravityComponent = S.Schema.Type<typeof GravityComponent>