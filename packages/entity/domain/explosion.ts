import type { Position } from '@ts-minecraft/core'

/**
 * Explosion damage model (Phase 13+). Pure functions — no Effect, no randomness.
 *
 * Faithful to vanilla Minecraft's entity explosion formula. An explosion of a
 * given `power` damages entities within a blast radius of `2 × power` blocks. For
 * an entity at distance `d` with `exposure` ∈ [0,1] (the fraction of explosion
 * rays reaching it unobstructed; 1 = full line of sight):
 *
 *   impact = (1 − d / (2·power)) · exposure
 *   damage = ⌊ (impact² + impact) / 2 · 7 · (2·power) + 1 ⌋
 *
 * Entities outside the blast radius take no damage. The shared core for creeper
 * detonation, TNT, and any future blast source.
 */

/** Vanilla explosion powers. */
export const CREEPER_EXPLOSION_POWER = 3
export const CHARGED_CREEPER_EXPLOSION_POWER = 6
export const TNT_EXPLOSION_POWER = 4

/** Blast radius in blocks within which entities take damage: 2 × power. */
export const explosionRadius = (power: number): number => power * 2

const distanceBetween = (a: Position, b: Position): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * Vanilla explosion damage for an entity at `distanceToCenter` from a blast of the
 * given `power` and `exposure` ∈ [0,1]. Returns 0 beyond the blast radius.
 */
export const computeExplosionDamage = (power: number, distanceToCenter: number, exposure: number): number => {
  const diameter = explosionRadius(power)
  const normalized = distanceToCenter / diameter
  if (normalized > 1) return 0
  const impact = (1 - normalized) * exposure
  return Math.floor(((impact * impact + impact) / 2) * 7 * diameter + 1)
}

/**
 * Explosion damage to a `target` from a blast centered at `center`. `exposure`
 * defaults to 1 (full line of sight); callers with block data can pass a
 * raycast-derived fraction.
 */
export const computeExplosionDamageAt = (
  center: Position,
  power: number,
  target: Position,
  exposure: number = 1,
): number => computeExplosionDamage(power, distanceBetween(center, target), exposure)
