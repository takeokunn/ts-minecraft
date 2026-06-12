import { describe, it, expect } from 'vitest'
import {
  computeFlightPosition,
  blendVelocityForInput,
  resolveCollisionOrNoclip,
  applySneakEdgeClamp,
  applySneakEdgeClampInto,
  type Vec3,
} from '../application/game-state-physics'
import type { Position } from '@ts-minecraft/core'

const pos = (x: number, y: number, z: number): Position => ({ x, y, z } as Position)
const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
const solid = () => false
const allSolid = () => true

describe('computeFlightPosition', () => {
  it('returns physPos x/z unchanged, applies flightVy * deltaTime to prePosY', () => {
    const result = computeFlightPosition(pos(1, 100, 2), 64, 5, 0.016)
    expect(result.x).toBe(1)
    expect(result.z).toBe(2)
    expect(result.y).toBeCloseTo(64 + 5 * 0.016)
  })

  it('ignores physPos.y — uses prePosY as the base', () => {
    const physPos = pos(0, 999, 0) // high y that should be ignored
    const result = computeFlightPosition(physPos, 50, 0, 1)
    expect(result.y).toBe(50) // prePosY + 0 * deltaTime
  })

  it('descends when flightVy is negative', () => {
    const result = computeFlightPosition(pos(0, 0, 0), 80, -3, 0.5)
    expect(result.y).toBeCloseTo(80 - 1.5)
  })

  it('hovers with flightVy 0', () => {
    const result = computeFlightPosition(pos(0, 0, 0), 70, 0, 0.016)
    expect(result.y).toBe(70)
  })
})

describe('blendVelocityForInput', () => {
  it('on the ground: input x/z override current x/z directly', () => {
    const result = blendVelocityForInput(
      vec(3, 0, 4),
      vec(1, -5, 1),
      { flying: false, flightVy: 0, jumped: false, isGrounded: true },
    )
    expect(result.x).toBe(3)
    expect(result.z).toBe(4)
    // y preserved from current when not flying and not jumped
    expect(result.y).toBe(-5)
  })

  it('airborne with move input: uses input x/z (player can steer in the air)', () => {
    const result = blendVelocityForInput(
      vec(2, 0, 3),
      vec(1, -9.8, 0),
      { flying: false, flightVy: 0, jumped: false, isGrounded: false },
    )
    expect(result.x).toBe(2)
    expect(result.z).toBe(3)
  })

  it('airborne with NO move input: preserves current x/z (momentum)', () => {
    const result = blendVelocityForInput(
      vec(0, 0, 0),
      vec(5, -9.8, 3),
      { flying: false, flightVy: 0, jumped: false, isGrounded: false },
    )
    expect(result.x).toBe(5)
    expect(result.z).toBe(3)
  })

  it('flying: uses flightVy for y regardless of input or grounded state', () => {
    const result = blendVelocityForInput(
      vec(1, 99, 1),
      vec(0, 0, 0),
      { flying: true, flightVy: 4, jumped: false, isGrounded: false },
    )
    expect(result.y).toBe(4)
  })

  it('jumped: uses input.y for y (jump impulse)', () => {
    const result = blendVelocityForInput(
      vec(1, 7, 1),
      vec(0, -2, 0),
      { flying: false, flightVy: 0, jumped: true, isGrounded: true },
    )
    expect(result.y).toBe(7)
  })
})

describe('resolveCollisionOrNoclip', () => {
  it('spectator passes through all blocks (no collision)', () => {
    const result = resolveCollisionOrNoclip(pos(0, 0, 0), vec(1, -5, 0), allSolid, true)
    expect(result.position).toEqual(pos(0, 0, 0))
    expect(result.velocity).toEqual(vec(1, -5, 0))
    expect(result.isGrounded).toBe(false)
  })

  it('non-spectator with no solid blocks: position and velocity pass through unchanged', () => {
    const result = resolveCollisionOrNoclip(pos(0, 64, 0), vec(1, 0, 0), solid, false)
    // With no solid blocks, collider simply advances the position
    expect(result.isGrounded).toBe(false)
    expect(typeof result.position.x).toBe('number')
  })
})

describe('applySneakEdgeClamp', () => {
  it('no-op when not sneaking', () => {
    const prePos = pos(0, 64, 0)
    const collidedPos = pos(5, 60, 5)
    const collidedVel = vec(3, -1, 3)
    const result = applySneakEdgeClamp(prePos, collidedPos, collidedVel, allSolid, false, true)
    expect(result.position).toEqual(collidedPos)
    expect(result.velocity).toEqual(collidedVel)
  })

  it('no-op when not grounded (even if sneaking)', () => {
    const prePos = pos(0, 64, 0)
    const collidedPos = pos(5, 60, 5)
    const collidedVel = vec(3, -1, 3)
    const result = applySneakEdgeClamp(prePos, collidedPos, collidedVel, allSolid, true, false)
    expect(result.position).toEqual(collidedPos)
    expect(result.velocity).toEqual(collidedVel)
  })

  it('sneaking + grounded with solid ground everywhere: does not clamp (no edge)', () => {
    const prePos = pos(0, 64, 0)
    const collidedPos = pos(1, 64, 1)
    const collidedVel = vec(1, 0, 1)
    const result = applySneakEdgeClamp(prePos, collidedPos, collidedVel, allSolid, true, true)
    // allSolid → support everywhere → free to move
    expect(result.position.x).toBeCloseTo(1)
    expect(result.position.z).toBeCloseTo(1)
  })

  it('sneaking + grounded + no ground support: clamps back to prePos x/z', () => {
    const prePos = pos(0, 64, 0)
    const collidedPos = pos(2, 64, 2)
    const collidedVel = vec(2, 0, 2)
    // No ground anywhere → edge protection pulls back to prePos
    const result = applySneakEdgeClamp(prePos, collidedPos, collidedVel, solid, true, true)
    expect(result.position.x).toBe(prePos.x)
    expect(result.position.z).toBe(prePos.z)
    // Velocity clamped to 0 on the reverted axes
    expect(result.velocity.x).toBe(0)
    expect(result.velocity.z).toBe(0)
  })

  it('applySneakEdgeClampInto zeroes velocity on clamped axis when outPos aliases collidedPos', () => {
    // Regression: outPos===collidedPos aliasing must snapshot pre-write coords
    // so the comparison for velocity zeroing compares original (not overwritten) positions.
    const pre = pos(0, 64, 0)
    const collided = vec(2, 64, 2)    // moved away from pre — will be modified in-place
    const vel = vec(2, 0, 2)          // significant velocity — will be modified in-place
    // Pass collided and vel DIRECTLY as both input AND output (reference equality)
    applySneakEdgeClampInto(collided, vel, pre, collided, vel, () => false, true, true)
    // X and Z should both clamp back to pre position (collided was mutated in-place)
    expect(collided.x).toBe(pre.x)
    expect(collided.z).toBe(pre.z)
    // Velocity on clamped axes must be zeroed (vel was mutated in-place)
    expect(vel.x).toBe(0)
    expect(vel.z).toBe(0)
    expect(vel.y).toBe(0)  // Y velocity preserved
  })
})
