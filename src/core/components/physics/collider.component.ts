import * as S from 'effect/Schema'

/**
 * Collider Component
 * Defines the collision box for physics interactions
 */

export const ColliderComponent = S.Struct({
  width: S.Number.pipe(S.positive(), S.finite()),
  height: S.Number.pipe(S.positive(), S.finite()),
  depth: S.Number.pipe(S.positive(), S.finite()),
  offsetX: S.Number.pipe(S.finite()).pipe(S.withDefault(() => 0)),
  offsetY: S.Number.pipe(S.finite()).pipe(S.withDefault(() => 0)),
  offsetZ: S.Number.pipe(S.finite()).pipe(S.withDefault(() => 0)),
})

export type ColliderComponent = S.Schema.Type<typeof ColliderComponent>

// Common collider presets
export const PLAYER_COLLIDER: ColliderComponent = {
  width: 0.6,
  height: 1.8,
  depth: 0.6,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
}

export const BLOCK_COLLIDER: ColliderComponent = {
  width: 1.0,
  height: 1.0,
  depth: 1.0,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
}