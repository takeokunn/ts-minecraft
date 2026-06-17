import { EXHAUSTION_JUMP, EXHAUSTION_SPRINT_JUMP, EXHAUSTION_SPRINT_PER_BLOCK, EXHAUSTION_WALK_PER_BLOCK } from '@ts-minecraft/entity'

export const resolveIsSprinting = (
  sprintLeftPressed: boolean,
  sprintRightPressed: boolean,
  forwardPressed: boolean,
  sneakPressed: boolean,
  canSprint: boolean,
): boolean => (sprintLeftPressed || sprintRightPressed) && forwardPressed && !sneakPressed && canSprint

export const shouldApplyMovementExhaustion = (distanceMoved: number, isSneaking: boolean): boolean =>
  distanceMoved > 0 && !isSneaking

export const resolveMovementExhaustionRate = (isSprinting: boolean): number =>
  isSprinting ? EXHAUSTION_SPRINT_PER_BLOCK : EXHAUSTION_WALK_PER_BLOCK

export const shouldApplyJumpExhaustion = (inCreative: boolean, wasGrounded: boolean, isGrounded: boolean): boolean =>
  !inCreative && wasGrounded && !isGrounded

export const resolveJumpExhaustion = (isSprinting: boolean): number => (isSprinting ? EXHAUSTION_SPRINT_JUMP : EXHAUSTION_JUMP)
