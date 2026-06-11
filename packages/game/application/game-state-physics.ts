import type { Position } from '@ts-minecraft/core'
import { PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT } from '@ts-minecraft/core'
import { resolveBlockCollisions, clampSneakEdge, SNEAK_STEP_DOWN } from '../domain/aabb-collision'

export type Vec3 = { x: number; y: number; z: number }

export type BlockSolidFn = (wx: number, wy: number, wz: number) => boolean

export type CollisionResult = {
  readonly position: Position
  readonly velocity: Vec3
  readonly isGrounded: boolean
}

export const computeFlightPosition = (
  physPos: Position,
  prePosY: number,
  flightVy: number,
  deltaTime: number,
): Position => ({ ...physPos, y: prePosY + flightVy * deltaTime } as Position)

export const blendVelocityForInput = (
  inputVelocity: Vec3,
  currentVelocity: Vec3,
  opts: { flying: boolean; flightVy: number; jumped: boolean; isGrounded: boolean },
): Vec3 => {
  const { flying, flightVy, jumped, isGrounded } = opts
  const airborneControl = !flying && !isGrounded
  const hasMoveInput = inputVelocity.x !== 0 || inputVelocity.z !== 0
  return {
    x: airborneControl ? (hasMoveInput ? inputVelocity.x : currentVelocity.x) : inputVelocity.x,
    y: flying ? flightVy : jumped ? inputVelocity.y : currentVelocity.y,
    z: airborneControl ? (hasMoveInput ? inputVelocity.z : currentVelocity.z) : inputVelocity.z,
  }
}

export const resolveCollisionOrNoclip = (
  position: Position,
  velocity: Vec3,
  isBlockSolid: BlockSolidFn,
  isSpectator: boolean,
): CollisionResult =>
  isSpectator
    ? { position, velocity, isGrounded: false }
    : resolveBlockCollisions(position, velocity, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT, isBlockSolid)

export const applySneakEdgeClamp = (
  prePos: Position,
  collidedPos: Position,
  collidedVel: Vec3,
  isBlockSolid: BlockSolidFn,
  sneaking: boolean,
  wasGrounded: boolean,
): { position: Position; velocity: Vec3 } => {
  if (!sneaking || !wasGrounded) {
    return { position: collidedPos, velocity: collidedVel }
  }

  const sneakClamp = clampSneakEdge(prePos, collidedPos, (x, z) => {
    const feetY = collidedPos.y - PLAYER_HALF_HEIGHT
    for (const cx of [x - PLAYER_HALF_WIDTH, x + PLAYER_HALF_WIDTH]) {
      for (const cz of [z - PLAYER_HALF_WIDTH, z + PLAYER_HALF_WIDTH]) {
        if (isBlockSolid(cx, feetY - 0.1, cz)
          || isBlockSolid(cx, feetY - 0.1 - SNEAK_STEP_DOWN, cz)) {
          return true
        }
      }
    }
    return false
  })

  return {
    position: { ...collidedPos, x: sneakClamp.x, z: sneakClamp.z } as Position,
    velocity: {
      x: sneakClamp.x !== collidedPos.x ? 0 : collidedVel.x,
      y: collidedVel.y,
      z: sneakClamp.z !== collidedPos.z ? 0 : collidedVel.z,
    },
  }
}
