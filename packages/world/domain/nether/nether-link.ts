import { Option } from 'effect'
import type { Position } from '@ts-minecraft/core'

/**
 * Nether dimension linking (pure domain — Phase 17 foundation).
 *
 * Minecraft links the Overworld and the Nether at an 8:1 horizontal ratio: one
 * block travelled in the Nether corresponds to eight blocks in the Overworld.
 * The vertical coordinate is carried across unchanged (callers clamp it to the
 * destination dimension's build height). When a player steps through a portal the
 * game scales their position into the target dimension, looks for an existing
 * portal near that scaled point, and otherwise creates one — {@link findNearestPortal}
 * models that search.
 */

export const NETHER_HORIZONTAL_RATIO = 8

/** Scales an Overworld position into the Nether (horizontal axes divided by 8, floored). */
export const overworldToNether = (pos: Position): Position => ({
  x: Math.floor(pos.x / NETHER_HORIZONTAL_RATIO),
  y: pos.y,
  z: Math.floor(pos.z / NETHER_HORIZONTAL_RATIO),
})

/** Scales a Nether position back into the Overworld (horizontal axes multiplied by 8). */
export const netherToOverworld = (pos: Position): Position => ({
  x: pos.x * NETHER_HORIZONTAL_RATIO,
  y: pos.y,
  z: pos.z * NETHER_HORIZONTAL_RATIO,
})

const distanceSquared = (a: Position, b: Position): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz
}

/**
 * Finds the existing portal nearest to `target` within `maxDistance` (Euclidean),
 * or None when no candidate is in range. Ties resolve to the earliest candidate,
 * matching "reuse the first portal found" linking behaviour.
 */
export const findNearestPortal = (
  candidates: ReadonlyArray<Position>,
  target: Position,
  maxDistance: number,
): Option.Option<Position> => {
  const maxSq = maxDistance * maxDistance
  return candidates.reduce<Option.Option<Position>>((best, candidate) => {
    const dSq = distanceSquared(candidate, target)
    if (dSq > maxSq) return best
    const b = Option.getOrNull(best)
    if (b === null) return Option.some(candidate)
    return distanceSquared(b, target) <= dSq ? best : Option.some(candidate)
  }, Option.none())
}
