import { describe, it, expect } from 'vitest'
import {
  getDepthStriderWaterDrag,
  blendVelocityForInput,
  blendVelocityInto,
  applyLadderVelocityInto,
  applyCobwebSlowdownInto,
  computeFlightPosition,
  resolveCollisionOrNoclip,
  applySneakEdgeClamp,
  DEFAULT_WATER_HORIZONTAL_DRAG,
  DEPTH_STRIDER_MAX_LEVEL,
  LADDER_CLIMB_SPEED,
  LADDER_DESCEND_SPEED,
  LADDER_HOLD_SPEED,
  COBWEB_HORIZONTAL_MULTIPLIER,
  COBWEB_VERTICAL_MULTIPLIER,
  DEFAULT_GROUND_FRICTION,
  SLIPPERY_SURFACE_DAMPING,
} from './player-physics'

// ─── helpers ──────────────────────────────────────────────────────────────────
const v3 = (x: number, y: number, z: number) => ({ x, y, z })
const noBlocks = () => false
const allBlocks = () => true

// ─── getDepthStriderWaterDrag ──────────────────────────────────────────────────
describe('getDepthStriderWaterDrag', () => {
  it('returns DEFAULT_WATER_HORIZONTAL_DRAG at level 0', () => {
    expect(getDepthStriderWaterDrag(0)).toBe(DEFAULT_WATER_HORIZONTAL_DRAG)
  })

  it('returns 1 (no drag) at max level', () => {
    expect(getDepthStriderWaterDrag(DEPTH_STRIDER_MAX_LEVEL)).toBeCloseTo(1)
  })

  it('interpolates linearly between level 0 and max', () => {
    const mid = DEPTH_STRIDER_MAX_LEVEL / 2
    const result = getDepthStriderWaterDrag(mid)
    expect(result).toBeGreaterThan(DEFAULT_WATER_HORIZONTAL_DRAG)
    expect(result).toBeLessThan(1)
  })

  it('clamps level above max to max', () => {
    expect(getDepthStriderWaterDrag(100)).toBeCloseTo(getDepthStriderWaterDrag(DEPTH_STRIDER_MAX_LEVEL))
  })

  it('clamps negative level to 0', () => {
    expect(getDepthStriderWaterDrag(-5)).toBe(DEFAULT_WATER_HORIZONTAL_DRAG)
  })

  it('truncates fractional levels', () => {
    // level 1.9 → truncated to 1
    expect(getDepthStriderWaterDrag(1.9)).toBeCloseTo(getDepthStriderWaterDrag(1))
  })

  it('treats Infinity as level 0', () => {
    expect(getDepthStriderWaterDrag(Infinity)).toBe(DEFAULT_WATER_HORIZONTAL_DRAG)
  })
})

// ─── blendVelocityForInput ─────────────────────────────────────────────────────
describe('blendVelocityForInput — grounded', () => {
  it('uses inputVelocity x/z directly when grounded with movement input', () => {
    const result = blendVelocityForInput(v3(3, 0, 2), v3(1, -5, 1), {
      flying: false, flightVy: 0, jumped: false, isGrounded: true,
    })
    expect(result.x).toBe(3)
    expect(result.z).toBe(2)
  })

  it('uses currentVelocity y when not jumped (gravity preserved)', () => {
    const result = blendVelocityForInput(v3(0, 0, 0), v3(0, -8, 0), {
      flying: false, flightVy: 0, jumped: false, isGrounded: true,
    })
    expect(result.y).toBe(-8)
  })

  it('uses inputVelocity y when jumped', () => {
    const result = blendVelocityForInput(v3(0, 6, 0), v3(0, 0, 0), {
      flying: false, flightVy: 0, jumped: true, isGrounded: true,
    })
    expect(result.y).toBe(6)
  })

  it('applies surface momentum when grounded on slippery surface with no input', () => {
    const slipFriction = 0.9  // > DEFAULT_GROUND_FRICTION = 0.6
    const result = blendVelocityForInput(v3(0, 0, 0), v3(4, 0, 3), {
      flying: false, flightVy: 0, jumped: false, isGrounded: true,
      surfaceFriction: slipFriction,
    })
    const expectedMomentum = Math.min(0.98, slipFriction * SLIPPERY_SURFACE_DAMPING)
    expect(result.x).toBeCloseTo(4 * expectedMomentum)
    expect(result.z).toBeCloseTo(3 * expectedMomentum)
  })

  it('does NOT apply surface momentum when surfaceFriction ≤ DEFAULT_GROUND_FRICTION', () => {
    const result = blendVelocityForInput(v3(0, 0, 0), v3(4, 0, 3), {
      flying: false, flightVy: 0, jumped: false, isGrounded: true,
      surfaceFriction: DEFAULT_GROUND_FRICTION,
    })
    // no momentum: falls through to inputVelocity (0, 0)
    expect(result.x).toBe(0)
    expect(result.z).toBe(0)
  })
})

describe('blendVelocityForInput — airborne', () => {
  it('preserves currentVelocity x/z when airborne with no move input', () => {
    const result = blendVelocityForInput(v3(0, 0, 0), v3(5, -3, 2), {
      flying: false, flightVy: 0, jumped: false, isGrounded: false,
    })
    expect(result.x).toBe(5)
    expect(result.z).toBe(2)
  })

  it('uses inputVelocity x/z when airborne with move input', () => {
    const result = blendVelocityForInput(v3(3, 0, 1), v3(5, -3, 2), {
      flying: false, flightVy: 0, jumped: false, isGrounded: false,
    })
    expect(result.x).toBe(3)
    expect(result.z).toBe(1)
  })
})

describe('blendVelocityForInput — flying', () => {
  it('sets y to flightVy and uses inputVelocity x/z when flying', () => {
    const result = blendVelocityForInput(v3(2, 0, 3), v3(0, 0, 0), {
      flying: true, flightVy: 4, jumped: false, isGrounded: false,
    })
    expect(result.x).toBe(2)
    expect(result.y).toBe(4)
    expect(result.z).toBe(3)
  })

  it('flying mode overrides jumped flag for y axis', () => {
    const result = blendVelocityForInput(v3(0, 6, 0), v3(0, -2, 0), {
      flying: true, flightVy: 1, jumped: true, isGrounded: false,
    })
    expect(result.y).toBe(1)  // flightVy wins over jumped
  })
})

describe('blendVelocityForInput vs blendVelocityInto equivalence', () => {
  it('produces identical results for grounded movement', () => {
    const input = v3(2, 0, 1)
    const current = v3(0, -4, 0)
    const opts = { flying: false, flightVy: 0, jumped: false, isGrounded: true }
    const allocResult = blendVelocityForInput(input, current, opts)
    const target = v3(0, 0, 0)
    blendVelocityInto(target, input, current, opts)
    expect(target).toEqual(allocResult)
  })

  it('produces identical results for airborne no-input scenario', () => {
    const input = v3(0, 0, 0)
    const current = v3(3, -7, 2)
    const opts = { flying: false, flightVy: 0, jumped: false, isGrounded: false }
    const allocResult = blendVelocityForInput(input, current, opts)
    const target = v3(0, 0, 0)
    blendVelocityInto(target, input, current, opts)
    expect(target).toEqual(allocResult)
  })
})

// ─── applyLadderVelocityInto ───────────────────────────────────────────────────
describe('applyLadderVelocityInto', () => {
  it('sets y to LADDER_CLIMB_SPEED when climbUp is true', () => {
    const target = v3(0, 0, 0)
    applyLadderVelocityInto(target, v3(1, -3, 2), { climbUp: true, climbDown: false })
    expect(target.y).toBe(LADDER_CLIMB_SPEED)
  })

  it('sets y to LADDER_DESCEND_SPEED when climbDown is true', () => {
    const target = v3(0, 0, 0)
    applyLadderVelocityInto(target, v3(1, 5, 2), { climbUp: false, climbDown: true })
    expect(target.y).toBe(LADDER_DESCEND_SPEED)
  })

  it('sets y to LADDER_HOLD_SPEED when neither climbUp nor climbDown', () => {
    const target = v3(0, 0, 0)
    applyLadderVelocityInto(target, v3(1, -3, 2), { climbUp: false, climbDown: false })
    expect(target.y).toBe(LADDER_HOLD_SPEED)
  })

  it('climbUp takes priority over climbDown', () => {
    const target = v3(0, 0, 0)
    applyLadderVelocityInto(target, v3(0, 0, 0), { climbUp: true, climbDown: true })
    expect(target.y).toBe(LADDER_CLIMB_SPEED)
  })

  it('always copies resolvedVelocity x and z unchanged', () => {
    const target = v3(0, 0, 0)
    applyLadderVelocityInto(target, v3(1.5, -3, 2.5), { climbUp: false, climbDown: false })
    expect(target.x).toBe(1.5)
    expect(target.z).toBe(2.5)
  })
})

// ─── applyCobwebSlowdownInto ───────────────────────────────────────────────────
describe('applyCobwebSlowdownInto', () => {
  it('multiplies x by COBWEB_HORIZONTAL_MULTIPLIER', () => {
    const target = v3(0, 0, 0)
    applyCobwebSlowdownInto(target, v3(4, 0, 0))
    expect(target.x).toBeCloseTo(4 * COBWEB_HORIZONTAL_MULTIPLIER)
  })

  it('multiplies y by COBWEB_VERTICAL_MULTIPLIER', () => {
    const target = v3(0, 0, 0)
    applyCobwebSlowdownInto(target, v3(0, -10, 0))
    expect(target.y).toBeCloseTo(-10 * COBWEB_VERTICAL_MULTIPLIER)
  })

  it('multiplies z by COBWEB_HORIZONTAL_MULTIPLIER', () => {
    const target = v3(0, 0, 0)
    applyCobwebSlowdownInto(target, v3(0, 0, 8))
    expect(target.z).toBeCloseTo(8 * COBWEB_HORIZONTAL_MULTIPLIER)
  })

  it('reduces both horizontal and vertical components simultaneously', () => {
    const input = v3(4, -10, 8)
    const target = v3(0, 0, 0)
    applyCobwebSlowdownInto(target, input)
    expect(target.x).toBeCloseTo(input.x * COBWEB_HORIZONTAL_MULTIPLIER)
    expect(target.y).toBeCloseTo(input.y * COBWEB_VERTICAL_MULTIPLIER)
    expect(target.z).toBeCloseTo(input.z * COBWEB_HORIZONTAL_MULTIPLIER)
  })
})

// ─── computeFlightPosition ────────────────────────────────────────────────────
describe('computeFlightPosition', () => {
  it('replaces y with prePosY + flightVy * deltaTime', () => {
    const physPos = { x: 1, y: 99, z: 2 } as any
    const result = computeFlightPosition(physPos, 5, 3, 0.016)
    expect(result.y).toBeCloseTo(5 + 3 * 0.016)
  })

  it('preserves x and z from physPos', () => {
    const physPos = { x: 7, y: 0, z: -3 } as any
    const result = computeFlightPosition(physPos, 5, 0, 0.016)
    expect(result.x).toBe(7)
    expect(result.z).toBe(-3)
  })

  it('descends when flightVy is negative', () => {
    const physPos = { x: 0, y: 0, z: 0 } as any
    const result = computeFlightPosition(physPos, 10, -5, 0.1)
    expect(result.y).toBeCloseTo(10 - 0.5)
  })
})

// ─── resolveCollisionOrNoclip ──────────────────────────────────────────────────
describe('resolveCollisionOrNoclip', () => {
  it('returns position/velocity unchanged for a spectator (noclip)', () => {
    const pos = { x: 1, y: 5, z: 2 } as any
    const vel = v3(3, -5, 1)
    const result = resolveCollisionOrNoclip(pos, vel, allBlocks, true)
    expect(result.position).toBe(pos)
    expect(result.velocity).toBe(vel)
    expect(result.isGrounded).toBe(false)
  })

  it('runs collision resolution for a non-spectator', () => {
    const pos = { x: 0, y: 1.85, z: 0 } as any
    const vel = v3(0, -2, 0)
    // block at by=0 is solid (ground)
    const result = resolveCollisionOrNoclip(pos, vel, (_bx, by) => by === 0, false)
    expect(result.isGrounded).toBe(true)
    expect(result.position.y).toBeCloseTo(1.9)
  })
})

// ─── applySneakEdgeClamp ───────────────────────────────────────────────────────
describe('applySneakEdgeClamp', () => {
  it('returns collidedPos/collidedVel unchanged when not sneaking', () => {
    const prePos = { x: 0, y: 1.9, z: 0 } as any
    const collidedPos = { x: 0.5, y: 1.9, z: 0.5 } as any
    const collidedVel = v3(1, 0, 1)
    const result = applySneakEdgeClamp(prePos, collidedPos, collidedVel, noBlocks, false, true)
    expect(result.position).toBe(collidedPos)
    expect(result.velocity).toBe(collidedVel)
  })

  it('returns collidedPos/collidedVel unchanged when not grounded', () => {
    const prePos = { x: 0, y: 5, z: 0 } as any
    const collidedPos = { x: 0.5, y: 5, z: 0.5 } as any
    const collidedVel = v3(1, 0, 1)
    const result = applySneakEdgeClamp(prePos, collidedPos, collidedVel, noBlocks, true, false)
    expect(result.position).toBe(collidedPos)
    expect(result.velocity).toBe(collidedVel)
  })

  it('clamps movement when sneaking and grounded with no ground support at destination', () => {
    const prePos = { x: 0, y: 1.9, z: 0 } as any
    const collidedPos = { x: 1.5, y: 1.9, z: 0 } as any
    const collidedVel = v3(5, 0, 0)
    // no support anywhere (simulates cliff edge)
    const result = applySneakEdgeClamp(prePos, collidedPos, collidedVel, noBlocks, true, true)
    expect(result.position.x).toBe(prePos.x)
    expect(result.velocity.x).toBe(0)
  })

  it('allows movement when sneaking and grounded with full ground support', () => {
    const prePos = { x: 0, y: 1.9, z: 0 } as any
    const collidedPos = { x: 0.5, y: 1.9, z: 0 } as any
    const collidedVel = v3(1, 0, 0)
    const result = applySneakEdgeClamp(prePos, collidedPos, collidedVel, allBlocks, true, true)
    expect(result.position.x).toBe(collidedPos.x)
    expect(result.velocity.x).toBe(collidedVel.x)
  })
})
