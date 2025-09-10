import * as S from 'effect/Schema'

/**
 * Position Component
 * Represents the 3D position of an entity in the world
 */

export const PositionComponent = S.Struct({
  x: S.Number.pipe(S.finite()),
  y: S.Number.pipe(S.finite(), S.clamp(0, 255)),
  z: S.Number.pipe(S.finite()),
})

export type PositionComponent = S.Schema.Type<typeof PositionComponent>

// Helper functions
export const createPosition = (x: number, y: number, z: number): PositionComponent => ({
  x,
  y: Math.max(0, Math.min(255, y)),
  z,
})