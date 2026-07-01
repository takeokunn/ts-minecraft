import type { Effect } from 'effect'
import type { PlayerDamageCause } from '@ts-minecraft/entity/domain/player-damage-cause'

export type ApplyPlayerDamage = (amount: number, cause?: PlayerDamageCause) => Effect.Effect<boolean, never>

export type SurvivalMovementState = {
  readonly inCreative: boolean
  readonly isGrounded: boolean
  readonly isSprinting: boolean
  readonly isSneaking: boolean
  readonly distanceMoved: number
}
