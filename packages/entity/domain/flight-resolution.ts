import { MetersPerSec } from '@ts-minecraft/core'
import { DEFAULT_FLY_VERTICAL_SPEED } from './flight'

/**
 * Vertical velocity for creative flight from the held ascend (JUMP) / descend
 * (SNEAK) keys. Pure: no Effect, no side effects.
 *
 * - ascend only  → +speed
 * - descend only → −speed
 * - both / neither → 0 (hover; opposing inputs cancel, matching vanilla)
 */
export const computeFlightVerticalVelocity = (ascend: boolean, descend: boolean, speed: MetersPerSec = DEFAULT_FLY_VERTICAL_SPEED): number => {
  const s = MetersPerSec.toNumber(speed)
  return (ascend ? s : 0) - (descend ? s : 0)
}

/**
 * Resolves the next flight state for a frame.
 *
 * - Flight is only available in creative mode; switching out of creative force-
 *   disables it (so a survival player never keeps flying).
 * - A consumed TOGGLE_FLIGHT key press flips the state while in creative.
 */
export const nextFlightState = (current: boolean, isCreative: boolean, togglePressed: boolean): boolean => {
  if (!isCreative) return false
  return togglePressed ? !current : current
}
