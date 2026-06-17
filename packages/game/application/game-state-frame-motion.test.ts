import { describe, expect, it } from 'vitest'
import { MetersPerSec } from '@ts-minecraft/core'
import {
  blendFrameVelocityInto,
  resolveFrameMotionState,
  type FrameMotionState,
  type ResolveFrameMotionStateArgs,
  type Vec3,
} from '../domain/player-motion'

const makeArgs = (overrides: Partial<ResolveFrameMotionStateArgs>): ResolveFrameMotionStateArgs => ({
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

describe('resolveFrameMotionState', () => {
  it('forces flying for spectators and disables sneaking while flying', () => {
    const state = resolveFrameMotionState(makeArgs({
      isSpectator: true,
      jumpPressed: true,
      sneakPressed: false,
      inputVelocity: { x: 0, y: 1, z: 0 },
    }))

    expect(state).toEqual<FrameMotionState>({
      flying: true,
      flightVy: MetersPerSec.toNumber(MetersPerSec.make(7.5)),
      sneaking: false,
      jumped: true,
    })
  })

  it('only enables flight toggling in creative mode', () => {
    const creative = resolveFrameMotionState(makeArgs({
      currentFlying: false,
      isCreative: true,
      flightTogglePressed: true,
    }))
    const survival = resolveFrameMotionState(makeArgs({
      currentFlying: true,
      isCreative: false,
      flightTogglePressed: true,
    }))

    expect(creative.flying).toBe(true)
    expect(survival.flying).toBe(false)
  })
})

describe('blendFrameVelocityInto', () => {
  it('uses flight velocity when flying', () => {
    const target: Vec3 = { x: 0, y: 0, z: 0 }
    const state: FrameMotionState = {
      flying: true,
      flightVy: 6,
      sneaking: false,
      jumped: true,
    }

    const result = blendFrameVelocityInto(target, makeArgs({
      isGrounded: false,
      inputVelocity: { x: 1, y: 2, z: 3 },
      currentVelocity: { x: 9, y: 9, z: 9 },
    }), state)

    expect(result).toBe(target)
    expect(result).toEqual({ x: 1, y: 6, z: 3 })
  })

  it('preserves momentum on slippery ground when there is no move input', () => {
    const target: Vec3 = { x: 0, y: 0, z: 0 }
    const currentVelocity: Vec3 = { x: 4, y: -1, z: -2 }
    const state: FrameMotionState = {
      flying: false,
      flightVy: 0,
      sneaking: false,
      jumped: false,
    }

    const result = blendFrameVelocityInto(target, makeArgs({
      isGrounded: true,
      inputVelocity: { x: 0, y: 0, z: 0 },
      currentVelocity,
      surfaceFriction: 0.8,
    }), state)

    expect(result.x).toBeCloseTo(4 * 0.8 * 0.91, 6)
    expect(result.y).toBe(-1)
    expect(result.z).toBeCloseTo(-2 * 0.8 * 0.91, 6)
  })
})
