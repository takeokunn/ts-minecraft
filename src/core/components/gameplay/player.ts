import * as S from 'effect/Schema'

/**
 * Player Component - Marks entity as a player with player-specific state
 */

export const PlayerComponent = S.Struct({
  isGrounded: S.Boolean,
})

export type PlayerComponent = S.Schema.Type<typeof PlayerComponent>