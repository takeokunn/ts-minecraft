import type { Position } from '@ts-minecraft/core'
import { PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT } from '@ts-minecraft/core'
import type { BlockCollisionShapeFn } from './aabb-collision'
import { resolveBlockCollisions, resolveBlockCollisionsInto, clampSneakEdge, SNEAK_STEP_DOWN } from './aabb-collision'

export type Vec3 = { x: number; y: number; z: number }

export type BlockSolidFn = (wx: number, wy: number, wz: number) => boolean

export type CollisionResult = {
  readonly position: Position
  readonly velocity: Vec3
  readonly isGrounded: boolean
}

export const LADDER_CLIMB_SPEED = 2.35
export const LADDER_DESCEND_SPEED = -2.35
export const LADDER_HOLD_SPEED = 0
export const COBWEB_HORIZONTAL_MULTIPLIER = 0.25
export const COBWEB_VERTICAL_MULTIPLIER = 0.05
export const DEFAULT_GROUND_FRICTION = 0.6
export const SLIPPERY_SURFACE_DAMPING = 0.91
export const DEFAULT_WATER_HORIZONTAL_DRAG = 0.4
export const DEPTH_STRIDER_MAX_LEVEL = 3
const MOVE_INPUT_EPSILON = 1e-6

export const getDepthStriderWaterDrag = (level: number): number => {
  const normalizedLevel = Number.isFinite(level) ? Math.trunc(level) : 0
  const clampedLevel = Math.max(0, Math.min(DEPTH_STRIDER_MAX_LEVEL, normalizedLevel))
  return DEFAULT_WATER_HORIZONTAL_DRAG
    + (1 - DEFAULT_WATER_HORIZONTAL_DRAG) * (clampedLevel / DEPTH_STRIDER_MAX_LEVEL)
}

type BlendVelocityOptions = {
  readonly flying: boolean
  readonly flightVy: number
  readonly jumped: boolean
  readonly isGrounded: boolean
  readonly surfaceFriction?: number | undefined
}

export const computeFlightPosition = (
  physPos: Position,
  prePosY: number,
  flightVy: number,
  deltaTime: number,
): Position => ({ ...physPos, y: prePosY + flightVy * deltaTime } as Position)

// Zero-allocation variant for the hot path: mutates `target` in-place instead
// of creating a new Position via spread. `target` should be the same object
// that holds the pre-flight position (typically `_scratchPosB`).
export const computeFlightPositionInto = (
  target: { x: number; y: number; z: number },
  prePosY: number,
  flightVy: number,
  deltaTime: number,
): Position => {
  target.y = prePosY + flightVy * deltaTime
  return target as unknown as Position
}

export const blendVelocityForInput = (
  inputVelocity: Vec3,
  currentVelocity: Vec3,
  opts: BlendVelocityOptions,
): Vec3 => {
  const { flying, flightVy, jumped, isGrounded, surfaceFriction = DEFAULT_GROUND_FRICTION } = opts
  const airborneControl = !flying && !isGrounded
  const hasMoveInput = Math.abs(inputVelocity.x) > MOVE_INPUT_EPSILON || Math.abs(inputVelocity.z) > MOVE_INPUT_EPSILON
  const keepSurfaceMomentum = isGrounded && !flying && !hasMoveInput && surfaceFriction > DEFAULT_GROUND_FRICTION
  const surfaceMomentum = Math.min(0.98, Math.max(0, surfaceFriction) * SLIPPERY_SURFACE_DAMPING)
  return {
    x: airborneControl ? (hasMoveInput ? inputVelocity.x : currentVelocity.x)
      : keepSurfaceMomentum ? currentVelocity.x * surfaceMomentum
      : inputVelocity.x,
    y: flying ? flightVy : jumped ? inputVelocity.y : currentVelocity.y,
    z: airborneControl ? (hasMoveInput ? inputVelocity.z : currentVelocity.z)
      : keepSurfaceMomentum ? currentVelocity.z * surfaceMomentum
      : inputVelocity.z,
  }
}

// Zero-allocation variant: writes result into `target` and returns it (allows
// chaining while avoiding the per-frame object literal on the hot path).
export const blendVelocityInto = (
  target: Vec3,
  inputVelocity: Vec3,
  currentVelocity: Vec3,
  opts: BlendVelocityOptions,
): Vec3 => {
  const { flying, flightVy, jumped, isGrounded, surfaceFriction = DEFAULT_GROUND_FRICTION } = opts
  const airborneControl = !flying && !isGrounded
  const hasMoveInput = Math.abs(inputVelocity.x) > MOVE_INPUT_EPSILON || Math.abs(inputVelocity.z) > MOVE_INPUT_EPSILON
  const keepSurfaceMomentum = isGrounded && !flying && !hasMoveInput && surfaceFriction > DEFAULT_GROUND_FRICTION
  const surfaceMomentum = Math.min(0.98, Math.max(0, surfaceFriction) * SLIPPERY_SURFACE_DAMPING)
  target.x = airborneControl ? (hasMoveInput ? inputVelocity.x : currentVelocity.x)
    : keepSurfaceMomentum ? currentVelocity.x * surfaceMomentum
    : inputVelocity.x
  target.y = flying ? flightVy : jumped ? inputVelocity.y : currentVelocity.y
  target.z = airborneControl ? (hasMoveInput ? inputVelocity.z : currentVelocity.z)
    : keepSurfaceMomentum ? currentVelocity.z * surfaceMomentum
    : inputVelocity.z
  return target
}

export const applyLadderVelocityInto = (
  target: Vec3,
  resolvedVelocity: Vec3,
  opts: { climbUp: boolean; climbDown: boolean },
): Vec3 => {
  target.x = resolvedVelocity.x
  target.y = opts.climbUp ? LADDER_CLIMB_SPEED : opts.climbDown ? LADDER_DESCEND_SPEED : LADDER_HOLD_SPEED
  target.z = resolvedVelocity.z
  return target
}

export const applyCobwebSlowdownInto = (
  target: Vec3,
  resolvedVelocity: Vec3,
): Vec3 => {
  target.x = resolvedVelocity.x * COBWEB_HORIZONTAL_MULTIPLIER
  target.y = resolvedVelocity.y * COBWEB_VERTICAL_MULTIPLIER
  target.z = resolvedVelocity.z * COBWEB_HORIZONTAL_MULTIPLIER
  return target
}

export const resolveCollisionOrNoclip = (
  position: Position,
  velocity: Vec3,
  isBlockSolid: BlockSolidFn,
  isSpectator: boolean,
  getBlockCollisionShape?: BlockCollisionShapeFn,
): CollisionResult =>
  isSpectator
    ? { position, velocity, isGrounded: false }
    : resolveBlockCollisions(position, velocity, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT, isBlockSolid, getBlockCollisionShape)

// Zero-allocation variant: writes resolved position into outPos, velocity
// into outVel. Safe to alias outPos/outVel with position/velocity because
// the collision logic reads all inputs into locals before writing outputs.
// Returns isGrounded.
export const resolveCollisionOrNoclipInto = (
  outPos: Vec3,
  outVel: Vec3,
  position: Position,
  velocity: Vec3,
  isBlockSolid: BlockSolidFn,
  isSpectator: boolean,
  getBlockCollisionShape?: BlockCollisionShapeFn,
): boolean => {
  if (isSpectator) {
    outPos.x = position.x; outPos.y = position.y; outPos.z = position.z
    outVel.x = velocity.x; outVel.y = velocity.y; outVel.z = velocity.z
    return false
  }
  return resolveBlockCollisionsInto(outPos, outVel, position, velocity, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT, isBlockSolid, getBlockCollisionShape)
}

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

  // Inline 4-corner ground-support check to avoid per-frame array allocations
  // (previously: for (const cx of [x-W, x+W]) for (const cz of [z-W, z+W])).
  const sneakClamp = clampSneakEdge(prePos, collidedPos, (x, z) => {
    const feetY = collidedPos.y - PLAYER_HALF_HEIGHT
    const xL = x - PLAYER_HALF_WIDTH
    const xR = x + PLAYER_HALF_WIDTH
    const zL = z - PLAYER_HALF_WIDTH
    const zR = z + PLAYER_HALF_WIDTH
    const d0 = feetY - 0.1
    const d1 = feetY - 0.1 - SNEAK_STEP_DOWN
    return isBlockSolid(xL, d0, zL) || isBlockSolid(xL, d1, zL)
        || isBlockSolid(xL, d0, zR) || isBlockSolid(xL, d1, zR)
        || isBlockSolid(xR, d0, zL) || isBlockSolid(xR, d1, zL)
        || isBlockSolid(xR, d0, zR) || isBlockSolid(xR, d1, zR)
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

// Zero-allocation variant: writes clamped position into outPos and velocity
// into outVel. outPos/outVel can alias collidedPos/collidedVel — the function
// reads all inputs via locals before writing outputs.
export const applySneakEdgeClampInto = (
  outPos: Vec3,
  outVel: Vec3,
  prePos: Position,
  collidedPos: Position,
  collidedVel: Vec3,
  isBlockSolid: BlockSolidFn,
  sneaking: boolean,
  wasGrounded: boolean,
): Vec3 => {
  if (!sneaking || !wasGrounded) {
    outPos.x = collidedPos.x; outPos.y = collidedPos.y; outPos.z = collidedPos.z
    outVel.x = collidedVel.x; outVel.y = collidedVel.y; outVel.z = collidedVel.z
    return outPos
  }

  // Inline ALL logic — zero closures, zero allocations.
  const feetY = collidedPos.y - PLAYER_HALF_HEIGHT
  const d0 = feetY - 0.1
  const d1 = feetY - 0.1 - SNEAK_STEP_DOWN

  const collidedX = collidedPos.x
  const collidedZ = collidedPos.z
  const collidedVx = collidedVel.x
  const collidedVz = collidedVel.z
  const preX = prePos.x
  const preZ = prePos.z

  // X-axis edge check: ground support at (newX, prevZ) using 4 corners × 2 depths
  const xL = collidedX - PLAYER_HALF_WIDTH
  const xR = collidedX + PLAYER_HALF_WIDTH
  const zSupportX = preZ
  const zLx = zSupportX - PLAYER_HALF_WIDTH
  const zRx = zSupportX + PLAYER_HALF_WIDTH
  const xClamp = collidedX !== preX
    && !(isBlockSolid(xL, d0, zLx) || isBlockSolid(xL, d1, zLx)
      || isBlockSolid(xL, d0, zRx) || isBlockSolid(xL, d1, zRx)
      || isBlockSolid(xR, d0, zLx) || isBlockSolid(xR, d1, zLx)
      || isBlockSolid(xR, d0, zRx) || isBlockSolid(xR, d1, zRx))

  outPos.x = xClamp ? preX : collidedX

  // Z-axis edge check: ground support at (prevX, newZ)
  const zL = collidedZ - PLAYER_HALF_WIDTH
  const zR = collidedZ + PLAYER_HALF_WIDTH
  const xSupportZ = preX
  const xLz = xSupportZ - PLAYER_HALF_WIDTH
  const xRz = xSupportZ + PLAYER_HALF_WIDTH
  const zClamp = collidedZ !== preZ
    && !(isBlockSolid(xLz, d0, zL) || isBlockSolid(xLz, d1, zL)
      || isBlockSolid(xLz, d0, zR) || isBlockSolid(xLz, d1, zR)
      || isBlockSolid(xRz, d0, zL) || isBlockSolid(xRz, d1, zL)
      || isBlockSolid(xRz, d0, zR) || isBlockSolid(xRz, d1, zR))

  outPos.z = zClamp ? preZ : collidedZ
  outPos.y = collidedPos.y  // Y unchanged by sneak clamp
  outVel.x = outPos.x !== collidedX ? 0 : collidedVx
  outVel.y = collidedVel.y
  outVel.z = outPos.z !== collidedZ ? 0 : collidedVz
  return outPos
}

export type PlayerPostPhysicsContactQuery = {
  readonly isSolid: BlockSolidFn
  readonly getCollisionShape?: BlockCollisionShapeFn
  readonly isInLadder: (wx: number, wy: number, wz: number) => boolean
  readonly isInCobweb: (wx: number, wy: number, wz: number) => boolean
  readonly isInWater: (wx: number, wy: number, wz: number) => boolean
}

export type PlayerPostPhysicsContactState = {
  readonly isGrounded: boolean
  readonly onLadder: boolean
  readonly inCobweb: boolean
  readonly inWater: boolean
}

export const resolvePlayerPostPhysicsContactState = (
  physPos: Vec3,
  physVel: Vec3,
  prePos: Position,
  effPos: Position,
  effVel: Vec3,
  queries: PlayerPostPhysicsContactQuery,
  canApplyEnvironmentEffects: boolean,
  sneaking: boolean,
  wasGrounded: boolean,
  isSpectator: boolean,
): PlayerPostPhysicsContactState => {
  const isGrounded = resolveCollisionOrNoclipInto(physPos, physVel, effPos, effVel, queries.isSolid, isSpectator, queries.getCollisionShape)
  applySneakEdgeClampInto(physPos, physVel, prePos, physPos, physVel, queries.isSolid, sneaking, wasGrounded)

  const onLadder = canApplyEnvironmentEffects
    && (queries.isInLadder(physPos.x, physPos.y, physPos.z)
      || queries.isInLadder(physPos.x, physPos.y + 1, physPos.z))
  const inCobweb = canApplyEnvironmentEffects
    && (queries.isInCobweb(physPos.x, physPos.y, physPos.z)
      || queries.isInCobweb(physPos.x, physPos.y + 1, physPos.z))
  const inWater = canApplyEnvironmentEffects
    && (queries.isInWater(physPos.x, physPos.y, physPos.z)
      || queries.isInWater(physPos.x, physPos.y + 1, physPos.z))

  return { isGrounded, onLadder, inCobweb, inWater }
}
