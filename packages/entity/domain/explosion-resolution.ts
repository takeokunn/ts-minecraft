import type { Position } from '@ts-minecraft/core'

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
