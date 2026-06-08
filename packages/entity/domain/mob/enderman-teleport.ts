import type { Position } from '@ts-minecraft/core'

export const TELEPORT_MIN_RANGE = 8
export const TELEPORT_MAX_RANGE = 32
export const TELEPORT_ATTEMPTS = 16

const DAMAGE_TELEPORT_CHANCE = 0.3
const CHASE_TELEPORT_CHANCE = 0.05
const STUCK_TELEPORT_TICKS = 40

const clampRoll = (value: number): number => Math.max(0, Math.min(1, value))

const toOffset = (roll: number): number =>
  clampRoll(roll) * TELEPORT_MAX_RANGE * 2 - TELEPORT_MAX_RANGE

const distanceXZ = (a: Position, b: Position): number => {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}

const isValidTeleportTarget = (position: Position, targetPosition: Position): boolean => {
  const distance = distanceXZ(position, targetPosition)
  return distance >= TELEPORT_MIN_RANGE && distance <= TELEPORT_MAX_RANGE
}

export const computeEndermanTeleportTarget = (
  _position: Position,
  targetPosition: Position,
  randomAttempts: ReadonlyArray<number>,
): Position | null => {
  for (let attempt = 0; attempt < TELEPORT_ATTEMPTS; attempt++) {
    const xRoll = randomAttempts[attempt * 2]
    const zRoll = randomAttempts[attempt * 2 + 1]
    if (xRoll === undefined || zRoll === undefined) return null

    const candidate: Position = {
      x: targetPosition.x + toOffset(xRoll),
      y: targetPosition.y,
      z: targetPosition.z + toOffset(zRoll),
    }

    if (isValidTeleportTarget(candidate, targetPosition)) return candidate
  }

  return null
}

export const shouldEndermanTeleport = (
  damageTaken: boolean,
  stuckTicks: number,
  randomRoll: number,
): boolean => {
  if (damageTaken) return clampRoll(randomRoll) < DAMAGE_TELEPORT_CHANCE
  if (stuckTicks > STUCK_TELEPORT_TICKS) return true
  return clampRoll(randomRoll) < CHASE_TELEPORT_CHANCE
}
