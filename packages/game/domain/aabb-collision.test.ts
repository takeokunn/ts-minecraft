import { describe, it, expect } from 'vitest'
import {
  resolveBlockCollisions,
  clampSneakEdge,
  FULL_BLOCK_COLLISION_SHAPE,
  SLAB_COLLISION_HEIGHT,
  PRESSURE_PLATE_COLLISION_HEIGHT,
  CACTUS_COLLISION_INSET,
} from './aabb-collision'

const HW = 0.3 // PLAYER_HALF_WIDTH
const HH = 0.9 // PLAYER_HALF_HEIGHT

// A flat ground layer: blocks at by=0 span y=0→1 (top at y=1).
const flatGround = (_bx: number, by: number, _bz: number): boolean => by === 0

// A two-block-tall wall at x=0, spanning by=2 and by=3 (y=2→4),
// leaving the floor area (by=0) solid only if combined with flatGround.
const wallAtX0 = (_bx: number, by: number, _bz: number): boolean =>
  _bx === 0 && (by === 2 || by === 3)

describe('collision shape constants', () => {
  it('FULL_BLOCK spans 0→1 on all axes', () => {
    expect(FULL_BLOCK_COLLISION_SHAPE.minX).toBe(0)
    expect(FULL_BLOCK_COLLISION_SHAPE.maxX).toBe(1)
    expect(FULL_BLOCK_COLLISION_SHAPE.minY).toBe(0)
    expect(FULL_BLOCK_COLLISION_SHAPE.maxY).toBe(1)
    expect(FULL_BLOCK_COLLISION_SHAPE.minZ).toBe(0)
    expect(FULL_BLOCK_COLLISION_SHAPE.maxZ).toBe(1)
  })

  it('SLAB_COLLISION_HEIGHT is exactly 0.5', () => {
    expect(SLAB_COLLISION_HEIGHT).toBe(0.5)
  })

  it('PRESSURE_PLATE_COLLISION_HEIGHT is 1/16', () => {
    expect(PRESSURE_PLATE_COLLISION_HEIGHT).toBeCloseTo(1 / 16)
  })

  it('CACTUS_COLLISION_INSET is 1/16 on each side', () => {
    expect(CACTUS_COLLISION_INSET).toBeCloseTo(1 / 16)
  })
})

describe('resolveBlockCollisions — empty space', () => {
  it('does not change position when no solid blocks exist', () => {
    const pos = { x: 0, y: 5, z: 0 }
    const vel = { x: 1, y: -2, z: 0.5 }
    const result = resolveBlockCollisions(pos, vel, HW, HH, () => false)
    expect(result.position).toEqual(pos)
    expect(result.velocity).toEqual(vel)
    expect(result.isGrounded).toBe(false)
  })
})

describe('resolveBlockCollisions — Y axis (floor and ceiling)', () => {
  it('pushes player up when feet penetrate a solid floor block', () => {
    // feet at 0.95 (inside block at by=0 whose top is at y=1)
    const pos = { x: 0, y: 1.85, z: 0 }
    const vel = { x: 0, y: -2, z: 0 }
    const result = resolveBlockCollisions(pos, vel, HW, HH, flatGround)
    // player center lands at blockTop + HH = 1 + 0.9 = 1.9
    expect(result.position.y).toBeCloseTo(1.9)
    expect(result.velocity.y).toBe(0)
    expect(result.isGrounded).toBe(true)
  })

  it('stops upward velocity when head penetrates a ceiling block', () => {
    // head at 3.05 (inside block at by=3 whose bottom is at y=3)
    const ceiling = (_bx: number, by: number, _bz: number) => by === 3
    const pos = { x: 0, y: 2.15, z: 0 }
    const vel = { x: 0, y: 2, z: 0 }
    const result = resolveBlockCollisions(pos, vel, HW, HH, ceiling)
    // player center must be ≤ ceilY - HH = 3 - 0.9 = 2.1
    expect(result.position.y).toBeCloseTo(2.1)
    expect(result.velocity.y).toBe(0)
    expect(result.isGrounded).toBe(false)
  })

  it('returns isGrounded false for a player in mid-air with no floor below', () => {
    const pos = { x: 0, y: 10, z: 0 }
    const vel = { x: 0, y: -5, z: 0 }
    const result = resolveBlockCollisions(pos, vel, HW, HH, flatGround)
    // flatGround is at by=0 (y=0→1), player feet at 9.1 — far above ground
    expect(result.isGrounded).toBe(false)
    expect(result.position.y).toBe(10)
  })

  it('catches a fast-falling player before they tunnel through a floor (FALL_VELOCITY_THRESHOLD path)', () => {
    // Fast fall (|vy|=12 > FALL_VELOCITY_THRESHOLD=8): the "overCenter OR fast fall" branch
    // fires even when feetY is above blockTop, preventing tunnel-through.
    const pos = { x: 0, y: 1.85, z: 0 }
    const vel = { x: 0, y: -12, z: 0 }
    const result = resolveBlockCollisions(pos, vel, HW, HH, flatGround)
    expect(result.position.y).toBeCloseTo(1.9)
    expect(result.isGrounded).toBe(true)
  })
})

describe('resolveBlockCollisions — X axis (horizontal walls)', () => {
  it('stops leftward vx when player moves into a wall to the left', () => {
    // Player at x=1.25 (left edge at 0.95), wall at bx=0 (right face at x=1).
    // Player is airborne at y=3.0 so no floor interference.
    const pos = { x: 1.25, y: 3.0, z: 0 }
    const vel = { x: -5, y: 0, z: 0 }
    const result = resolveBlockCollisions(pos, vel, HW, HH, wallAtX0)
    // player pushed to wallFace + HW = 1 + 0.3 = 1.3
    expect(result.position.x).toBeCloseTo(1.3)
    expect(result.velocity.x).toBe(0)
  })

  it('stops rightward vx when player moves into a wall to the right', () => {
    // Wall at bx=2 (left face at x=2), player at x=1.75 (right edge at 2.05).
    const wallAtX2 = (bx: number, by: number, _bz: number) => bx === 2 && (by === 2 || by === 3)
    const pos = { x: 1.75, y: 3.0, z: 0 }
    const vel = { x: 5, y: 0, z: 0 }
    const result = resolveBlockCollisions(pos, vel, HW, HH, wallAtX2)
    // player pushed to wallFace - HW = 2 - 0.3 = 1.7
    expect(result.position.x).toBeCloseTo(1.7)
    expect(result.velocity.x).toBe(0)
  })
})

describe('resolveBlockCollisions — Z axis (horizontal walls)', () => {
  it('stops negative vz when player moves into a wall behind them', () => {
    const wallAtZ0 = (_bx: number, by: number, bz: number) => bz === 0 && (by === 2 || by === 3)
    const pos = { x: 0, y: 3.0, z: 1.25 }
    const vel = { x: 0, y: 0, z: -5 }
    const result = resolveBlockCollisions(pos, vel, HW, HH, wallAtZ0)
    expect(result.position.z).toBeCloseTo(1.3)
    expect(result.velocity.z).toBe(0)
  })
})

describe('clampSneakEdge', () => {
  // hasGroundSupport returns true only when x≥0 and z≥0 (simulates a platform edge)
  const hasSupport = (x: number, z: number): boolean => x >= 0 && z >= 0

  it('allows movement when ground support exists at the destination', () => {
    const prev = { x: 0.5, z: 0.5 }
    const next = { x: 0.6, z: 0.5 }
    const result = clampSneakEdge(prev, next, hasSupport)
    expect(result.x).toBeCloseTo(0.6)
    expect(result.z).toBeCloseTo(0.5)
  })

  it('clamps X back to prev.x when moving to unsupported X', () => {
    const prev = { x: 0.5, z: 0.5 }
    const next = { x: -0.1, z: 0.5 }
    const result = clampSneakEdge(prev, next, hasSupport)
    expect(result.x).toBeCloseTo(prev.x)
    expect(result.z).toBeCloseTo(next.z)
  })

  it('clamps Z back to prev.z when moving to unsupported Z', () => {
    const prev = { x: 0.5, z: 0.5 }
    const next = { x: 0.5, z: -0.1 }
    const result = clampSneakEdge(prev, next, hasSupport)
    expect(result.x).toBeCloseTo(next.x)
    expect(result.z).toBeCloseTo(prev.z)
  })

  it('clamps both axes independently when both destinations are unsupported', () => {
    const prev = { x: 0.5, z: 0.5 }
    const next = { x: -0.1, z: -0.1 }
    const result = clampSneakEdge(prev, next, hasSupport)
    expect(result.x).toBeCloseTo(prev.x)
    expect(result.z).toBeCloseTo(prev.z)
  })

  it('returns next unchanged when x and z do not move', () => {
    const prev = { x: 0.5, z: 0.5 }
    const next = { x: 0.5, z: 0.5 }
    const result = clampSneakEdge(prev, next, hasSupport)
    expect(result).toEqual(next)
  })

  it('skips X clamp when X coordinate does not change', () => {
    // prev and next have the same X — no X movement, so X clamp is unconditionally skipped.
    const allSupport = () => true
    const prev = { x: 0.5, z: 0.5 }
    const next = { x: 0.5, z: 0.8 }
    const result = clampSneakEdge(prev, next, allSupport)
    expect(result.x).toBeCloseTo(0.5)
    expect(result.z).toBeCloseTo(0.8)
  })
})
