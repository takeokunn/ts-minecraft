import { describe, expect, it } from 'vitest'
import type { Position } from '@ts-minecraft/core'
import {
  resolvePlayerPostPhysicsContactState,
  type PlayerPostPhysicsContactQuery,
  type Vec3,
} from '../domain/player-physics'

describe('resolvePlayerPostPhysicsContactState', () => {
  it('clamps sneak movement back to the previous position when grounded and unsupported', () => {
    const physPos: Vec3 = { x: 3, y: 64, z: 4 }
    const physVel: Vec3 = { x: 1.5, y: 0.2, z: -2 }
    const prePos: Position = { x: 1, y: 64, z: 2 }
    const queries: PlayerPostPhysicsContactQuery = {
      isSolid: () => false,
      isInLadder: () => false,
      isInCobweb: () => false,
      isInWater: () => false,
    }

    const result = resolvePlayerPostPhysicsContactState(
      physPos,
      physVel,
      prePos,
      physPos,
      physVel,
      queries,
      false,
      true,
      true,
      false,
    )

    expect(result.isGrounded).toBe(false)
    expect(result.onLadder).toBe(false)
    expect(result.inCobweb).toBe(false)
    expect(result.inWater).toBe(false)
    expect(physPos).toEqual({ x: prePos.x, y: 64, z: prePos.z })
    expect(physVel).toEqual({ x: 0, y: 0.2, z: 0 })
  })

  it('reads ladder, cobweb, and water contact from feet or head positions when enabled', () => {
    const physPos: Vec3 = { x: 10, y: 20, z: 30 }
    const physVel: Vec3 = { x: 0, y: 0, z: 0 }
    const prePos: Position = { x: 10, y: 20, z: 30 }
    const queries: PlayerPostPhysicsContactQuery = {
      isSolid: () => false,
      isInLadder: (_x, y, _z) => y === 21,
      isInCobweb: (_x, y, _z) => y === 20,
      isInWater: (_x, y, _z) => y === 21,
    }

    const enabled = resolvePlayerPostPhysicsContactState(
      physPos,
      physVel,
      prePos,
      physPos,
      physVel,
      queries,
      true,
      false,
      false,
      false,
    )

    expect(enabled.onLadder).toBe(true)
    expect(enabled.inCobweb).toBe(true)
    expect(enabled.inWater).toBe(true)

    const disabled = resolvePlayerPostPhysicsContactState(
      { x: 10, y: 20, z: 30 },
      { x: 0, y: 0, z: 0 },
      prePos,
      { x: 10, y: 20, z: 30 },
      { x: 0, y: 0, z: 0 },
      queries,
      false,
      false,
      false,
      false,
    )

    expect(disabled.onLadder).toBe(false)
    expect(disabled.inCobweb).toBe(false)
    expect(disabled.inWater).toBe(false)
  })
})
