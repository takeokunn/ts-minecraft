import * as S from 'effect/Schema'

/**
 * Player Component
 * Marks an entity as a player with player-specific state
 */

export const PlayerComponent = S.Struct({
  isGrounded: S.Boolean,
  isSprinting: S.Boolean.pipe(S.withDefault(() => false)),
  isCrouching: S.Boolean.pipe(S.withDefault(() => false)),
  isFlying: S.Boolean.pipe(S.withDefault(() => false)),
  health: S.Number.pipe(S.finite(), S.clamp(0, 20)).pipe(S.withDefault(() => 20)),
  hunger: S.Number.pipe(S.finite(), S.clamp(0, 20)).pipe(S.withDefault(() => 20)),
  experience: S.Number.pipe(S.int(), S.nonNegative()).pipe(S.withDefault(() => 0)),
})

export type PlayerComponent = S.Schema.Type<typeof PlayerComponent>

// Helper functions
export const createPlayer = (): PlayerComponent => ({
  isGrounded: false,
  isSprinting: false,
  isCrouching: false,
  isFlying: false,
  health: 20,
  hunger: 20,
  experience: 0,
})

export const takeDamage = (amount: number) => 
  (player: PlayerComponent): PlayerComponent => ({
    ...player,
    health: Math.max(0, player.health - amount),
  })

export const heal = (amount: number) =>
  (player: PlayerComponent): PlayerComponent => ({
    ...player,
    health: Math.min(20, player.health + amount),
  })