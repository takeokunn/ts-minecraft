import * as S from 'effect/Schema'

/**
 * Velocity Component
 * Represents the velocity/movement vector of an entity
 */

export const VelocityComponent = S.Struct({
  dx: S.Number.pipe(S.finite(), S.clamp(-100, 100)),
  dy: S.Number.pipe(S.finite(), S.clamp(-100, 100)),
  dz: S.Number.pipe(S.finite(), S.clamp(-100, 100)),
})

export type VelocityComponent = S.Schema.Type<typeof VelocityComponent>

// Helper functions
export const createVelocity = (dx: number, dy: number, dz: number): VelocityComponent => ({
  dx: Math.max(-100, Math.min(100, dx)),
  dy: Math.max(-100, Math.min(100, dy)),
  dz: Math.max(-100, Math.min(100, dz)),
})

export const ZERO_VELOCITY: VelocityComponent = {
  dx: 0,
  dy: 0,
  dz: 0,
}