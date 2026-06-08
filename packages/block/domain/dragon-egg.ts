import type { Position } from '@ts-minecraft/core'

export const DRAGON_EGG_TELEPORT_RANGE = 15
const DRAGON_EGG_VERTICAL_RANGE = 7

export type DragonEggTeleportOffsets = {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly nearestSolidSurfaceY?: number
}

const clampInteger = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.trunc(value)))

export const computeDragonEggTeleport = (
  eggPosition: Position,
  randomOffsets: DragonEggTeleportOffsets,
): Position => {
  const target = {
    x: Math.floor(eggPosition.x) + clampInteger(randomOffsets.x, -DRAGON_EGG_TELEPORT_RANGE, DRAGON_EGG_TELEPORT_RANGE),
    y: Math.floor(eggPosition.y) + clampInteger(randomOffsets.y, -DRAGON_EGG_VERTICAL_RANGE, DRAGON_EGG_VERTICAL_RANGE),
    z: Math.floor(eggPosition.z) + clampInteger(randomOffsets.z, -DRAGON_EGG_TELEPORT_RANGE, DRAGON_EGG_TELEPORT_RANGE),
  }

  if (randomOffsets.nearestSolidSurfaceY === undefined) return target
  const restingY = randomOffsets.nearestSolidSurfaceY + 1
  return { ...target, y: target.y > restingY ? restingY : target.y }
}
