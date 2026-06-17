import type { Effect } from 'effect'

export type ApplyPlayerDamage = (amount: number) => Effect.Effect<boolean, never>

export type SurvivalMovementState = {
  readonly inCreative: boolean
  readonly isGrounded: boolean
  readonly isSprinting: boolean
  readonly isSneaking: boolean
  readonly distanceMoved: number
}
