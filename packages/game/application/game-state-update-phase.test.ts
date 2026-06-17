import { describe, expect, it } from 'vitest'
import type { Position } from '@ts-minecraft/core'
import type { ResolveFrameMotionStateArgs } from '../domain/player-motion'
import {
  resolveUpdateFrameContext,
  resolveUpdatePostPhysicsState,
} from '../domain/player-motion'
import type { PlayerPostPhysicsContactQuery, Vec3 } from '../domain/player-physics'

const makeFrameArgs = (overrides: Partial<ResolveFrameMotionStateArgs>): ResolveFrameMotionStateArgs => ({
  currentFlying: false,
  isCreative: false,
  isSpectator: false,
  flightTogglePressed: false,
  jumpPressed: false,
  sneakPressed: false,
  isGrounded: false,
  inputVelocity: { x: 0, y: 0, z: 0 },
  currentVelocity: { x: 0, y: 0, z: 0 },
  ...overrides,
})

const makeQueries = (overrides?: Partial<PlayerPostPhysicsContactQuery>): PlayerPostPhysicsContactQuery => ({
  isSolid: () => false,
  isInLadder: () => false,
  isInCobweb: () => false,
  isInWater: () => false,
  ...overrides,
})

describe('resolveUpdateFrameContext', () => {
  it('does not capture the pre-physics position when the player is grounded and not flying', () => {
    const result = resolveUpdateFrameContext(makeFrameArgs({
      isGrounded: true,
    }))

    expect(result.capturePrePos).toBe(false)
    expect(result.frameMotionState.flying).toBe(false)
  })

  it('captures the pre-physics position when flying', () => {
    const result = resolveUpdateFrameContext(makeFrameArgs({
      isCreative: true,
      flightTogglePressed: true,
    }))

    expect(result.capturePrePos).toBe(true)
    expect(result.frameMotionState.flying).toBe(true)
  })

  it('captures the pre-physics position when sneaking on the ground', () => {
    const result = resolveUpdateFrameContext(makeFrameArgs({
      isGrounded: true,
      sneakPressed: true,
    }))

    expect(result.capturePrePos).toBe(true)
    expect(result.frameMotionState.sneaking).toBe(true)
  })
})

describe('resolveUpdatePostPhysicsState', () => {
  it('reuses the physics position object and applies flight height and vertical velocity', () => {
    const physPos: Vec3 = { x: 1, y: 2, z: 3 }
    const physVel: Vec3 = { x: 4, y: 5, z: 6 }
    const prePos: Position = { x: 1, y: 10, z: 3 }

    const result = resolveUpdatePostPhysicsState({
      physPos,
      physVel,
      prePos,
      deltaTime: 0.2,
      frameMotionState: {
        flying: true,
        flightVy: 7.5,
        sneaking: false,
        jumped: true,
      },
      queries: makeQueries(),
      canApplyEnvironmentEffects: false,
      sneaking: false,
      wasGrounded: false,
      isSpectator: false,
    })

    expect(result.effPos).toBe(physPos)
    expect(result.effPos).toEqual({ x: 1, y: 11.5, z: 3 })
    expect(physVel.y).toBe(7.5)
    expect(result.contactState).toEqual({
      isGrounded: false,
      onLadder: false,
      inCobweb: false,
      inWater: false,
    })
  })

  it('suppresses ladder, cobweb, and water effects when environment effects are disabled', () => {
    const physPos: Vec3 = { x: 0, y: 0, z: 0 }
    const physVel: Vec3 = { x: 0, y: 0, z: 0 }
    const queries: PlayerPostPhysicsContactQuery = makeQueries({
      isInLadder: () => true,
      isInCobweb: () => true,
      isInWater: () => true,
    })

    const result = resolveUpdatePostPhysicsState({
      physPos,
      physVel,
      prePos: { x: 0, y: 0, z: 0 },
      deltaTime: 0,
      frameMotionState: {
        flying: false,
        flightVy: 0,
        sneaking: false,
        jumped: false,
      },
      queries,
      canApplyEnvironmentEffects: false,
      sneaking: false,
      wasGrounded: false,
      isSpectator: false,
    })

    expect(result.contactState).toEqual({
      isGrounded: false,
      onLadder: false,
      inCobweb: false,
      inWater: false,
    })
  })

  it('honours ladder, cobweb, and water queries when environment effects are enabled', () => {
    const physPos: Vec3 = { x: 0, y: 0, z: 0 }
    const physVel: Vec3 = { x: 0, y: 0, z: 0 }
    const queries: PlayerPostPhysicsContactQuery = makeQueries({
      isInLadder: () => true,
      isInCobweb: () => true,
      isInWater: () => true,
    })

    const result = resolveUpdatePostPhysicsState({
      physPos,
      physVel,
      prePos: { x: 0, y: 0, z: 0 },
      deltaTime: 0,
      frameMotionState: {
        flying: false,
        flightVy: 0,
        sneaking: false,
        jumped: false,
      },
      queries,
      canApplyEnvironmentEffects: true,
      sneaking: false,
      wasGrounded: false,
      isSpectator: false,
    })

    expect(result.contactState.onLadder).toBe(true)
    expect(result.contactState.inCobweb).toBe(true)
    expect(result.contactState.inWater).toBe(true)
  })
})
