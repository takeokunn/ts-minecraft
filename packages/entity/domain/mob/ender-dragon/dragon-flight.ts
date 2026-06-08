import { normalize, scale, subtract, type Position, type Vector3 } from '@ts-minecraft/core'

const toVector3 = (position: Position): Vector3 => ({
  x: position.x,
  y: position.y,
  z: position.z,
})

export const computeCirclingVelocity = (
  center: Position,
  radius: number,
  height: number,
  angle: number,
  speed: number,
): Vector3 => {
  const verticalBias = (height - center.y) / Math.max(1, Math.abs(radius))
  return scale(normalize({ x: -Math.sin(angle), y: verticalBias, z: Math.cos(angle) }), speed)
}

export const computeStrafingVelocity = (
  dragonPos: Position,
  playerPos: Position,
  speed: number,
): Vector3 => scale(normalize(subtract(toVector3(playerPos), toVector3(dragonPos))), speed)

export const computeLandingVelocity = (
  dragonPos: Position,
  portalPos: Position,
  speed: number,
): Vector3 => scale(normalize(subtract(toVector3(portalPos), toVector3(dragonPos))), speed)

export const computeTakeoffVelocity = (_currentPos: Position, speed: number): Vector3 =>
  scale({ x: 0, y: 1, z: 0 }, speed)
