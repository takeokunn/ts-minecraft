import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'
import { computeFlightVerticalVelocity, nextFlightState } from '@ts-minecraft/entity/domain/flight'
import { blendVelocityInto, type PlayerPostPhysicsContactQuery, type PlayerPostPhysicsContactState, type Vec3, computeFlightPositionInto, resolvePlayerPostPhysicsContactState } from './player-physics'

export type FrameMotionState = {
  readonly flying: boolean
  readonly flightVy: number
  readonly sneaking: boolean
  readonly jumped: boolean
}

export type ResolveFrameMotionStateArgs = {
  readonly currentFlying: boolean
  readonly isCreative: boolean
  readonly isSpectator: boolean
  readonly flightTogglePressed: boolean
  readonly jumpPressed: boolean
  readonly sneakPressed: boolean
  readonly isGrounded: boolean
  readonly inputVelocity: Vec3
  readonly currentVelocity: Vec3
  readonly surfaceFriction?: number | undefined
}

export const resolveFrameMotionState = (args: ResolveFrameMotionStateArgs): FrameMotionState => {
  const flying = args.isSpectator || nextFlightState(args.currentFlying, args.isCreative, args.flightTogglePressed)
  const flightVy = flying ? computeFlightVerticalVelocity(args.jumpPressed, args.sneakPressed) : 0
  const sneaking = !flying && args.sneakPressed
  const jumped = args.inputVelocity.y > 0

  return {
    flying,
    flightVy,
    sneaking,
    jumped,
  }
}

export const blendFrameVelocityInto = (
  target: Vec3,
  args: ResolveFrameMotionStateArgs,
  state: FrameMotionState,
): Vec3 => blendVelocityInto(target, args.inputVelocity, args.currentVelocity, {
  flying: state.flying,
  flightVy: state.flightVy,
  jumped: state.jumped,
  isGrounded: args.isGrounded,
  surfaceFriction: args.surfaceFriction,
})

export type UpdateFrameContext = {
  readonly frameMotionState: FrameMotionState
  readonly capturePrePos: boolean
}

export const resolveUpdateFrameContext = (args: ResolveFrameMotionStateArgs): UpdateFrameContext => {
  const frameMotionState = resolveFrameMotionState(args)

  return {
    frameMotionState,
    capturePrePos: frameMotionState.flying || (frameMotionState.sneaking && args.isGrounded),
  }
}

export type ResolveUpdatePostPhysicsStateArgs = {
  readonly physPos: Vec3
  readonly physVel: Vec3
  readonly prePos: Position
  readonly deltaTime: DeltaTimeSecs
  readonly frameMotionState: FrameMotionState
  readonly queries: PlayerPostPhysicsContactQuery
  readonly canApplyEnvironmentEffects: boolean
  readonly sneaking: boolean
  readonly wasGrounded: boolean
  readonly isSpectator: boolean
}

export type UpdatePostPhysicsState = {
  readonly effPos: Position
  readonly contactState: PlayerPostPhysicsContactState
}

export const resolveUpdatePostPhysicsState = (
  args: ResolveUpdatePostPhysicsStateArgs,
): UpdatePostPhysicsState => {
  const effPos: Position = args.frameMotionState.flying
    ? computeFlightPositionInto(args.physPos, args.prePos.y, args.frameMotionState.flightVy, args.deltaTime)
    : args.physPos

  if (args.frameMotionState.flying) {
    args.physVel.y = args.frameMotionState.flightVy
  }

  const contactState = resolvePlayerPostPhysicsContactState(
    args.physPos,
    args.physVel,
    args.prePos,
    effPos,
    args.physVel,
    args.queries,
    args.canApplyEnvironmentEffects,
    args.sneaking,
    args.wasGrounded,
    args.isSpectator,
  )

  return {
    effPos,
    contactState,
  }
}
