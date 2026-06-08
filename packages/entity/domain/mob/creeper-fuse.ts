import type { Position } from '@ts-minecraft/core'

/**
 * Creeper detonation timing (Phase 13+). Pure functions — no Effect, no randomness.
 *
 * A creeper's fuse ignites once the player is within {@link CREEPER_IGNITION_RANGE}
 * blocks and burns for {@link CREEPER_FUSE_SECONDS}; if the player escapes the range
 * before it completes, the fuse resets (the creeper stops hissing). On the step the
 * fuse completes the creeper detonates — the caller then applies explosion damage
 * (see `computeExplosionDamageAt`) and removes the creeper. The block-destruction
 * side of the blast is a separate, rendering-side concern.
 */

export const CREEPER_IGNITION_RANGE = 3
export const CREEPER_FUSE_SECONDS = 1.5

export type CreeperFuseState = {
  /** Seconds the fuse has burned so far (0 when not ignited). */
  readonly fuseSecs: number
  /** Whether the creeper is currently counting down to detonation. */
  readonly ignited: boolean
}

export const initialCreeperFuse: CreeperFuseState = { fuseSecs: 0, ignited: false }

export type CreeperFuseStep = {
  readonly state: CreeperFuseState
  /** True only on the step where the fuse reaches CREEPER_FUSE_SECONDS. */
  readonly detonate: boolean
}

const distanceBetween = (a: Position, b: Position): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * Advances a creeper's fuse by `dtSecs`: ignites/continues while the player is in
 * range, resets when the player escapes, and reports `detonate` on the step the
 * fuse completes.
 */
export const tickCreeperFuse = (
  creeperPos: Position,
  playerPos: Position,
  current: CreeperFuseState,
  dtSecs: number,
): CreeperFuseStep => {
  const inRange = distanceBetween(creeperPos, playerPos) <= CREEPER_IGNITION_RANGE
  if (!inRange) return { state: initialCreeperFuse, detonate: false }
  const fuseSecs = current.fuseSecs + dtSecs
  const detonate = fuseSecs >= CREEPER_FUSE_SECONDS
  return { state: { fuseSecs, ignited: true }, detonate }
}
