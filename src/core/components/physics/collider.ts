import * as S from 'effect/Schema'

/**
 * Collider Component - Collision box dimensions for entity
 */

export const ColliderComponent = S.Struct({
  width: S.Number.pipe(S.finite(), S.positive()),
  height: S.Number.pipe(S.finite(), S.positive()),
  depth: S.Number.pipe(S.finite(), S.positive()),
})

export type ColliderComponent = S.Schema.Type<typeof ColliderComponent>