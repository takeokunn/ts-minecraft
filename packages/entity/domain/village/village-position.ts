import type { Position } from '@ts-minecraft/core'

export const distanceSq = (a: Position, b: Position): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = b.z - a.z
  return dx * dx + dy * dy + dz * dz
}

export const moveTowards = (from: Position, to: Position, maxDelta: number): Position => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dz = to.z - from.z
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

  if (distance === 0 || distance <= maxDelta) {
    return to
  }

  return {
    x: from.x + (dx / distance) * maxDelta,
    y: from.y + (dy / distance) * maxDelta,
    z: from.z + (dz / distance) * maxDelta,
  }
}
