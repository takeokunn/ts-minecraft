import * as S from 'effect/Schema'

/**
 * Gravity Component
 * Defines gravity strength affecting an entity
 */

export const GravityComponent = S.Struct({
  value: S.Number.pipe(S.finite()).pipe(S.withDefault(() => -32)), // Default Minecraft gravity
  multiplier: S.Number.pipe(S.positive(), S.finite()).pipe(S.withDefault(() => 1.0)),
})

export type GravityComponent = S.Schema.Type<typeof GravityComponent>

// Common gravity presets
export const NORMAL_GRAVITY: GravityComponent = {
  value: -32,
  multiplier: 1.0,
}

export const LOW_GRAVITY: GravityComponent = {
  value: -32,
  multiplier: 0.5,
}

export const ZERO_GRAVITY: GravityComponent = {
  value: 0,
  multiplier: 0,
}

export const WATER_GRAVITY: GravityComponent = {
  value: -32,
  multiplier: 0.2,
}