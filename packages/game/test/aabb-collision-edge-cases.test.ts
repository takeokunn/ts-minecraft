/**
 * Additional edge-case tests for resolveBlockCollisions.
 * The primary happy-path suite lives in aabb-collision.test.ts;
 * this file adds boundary, diagonal-corner, and combined-axis scenarios.
 *
 * Geometry note: the AABB resolver detects a floor when
 *   feetY < blockTop  (i.e. feet OVERLAP the block by at least EPSILON).
 * A player positioned with feetY === blockTop exactly does NOT trigger grounding.
 * Use `centerYInsideBlock` (feet slightly penetrating) for grounded tests.
 */

import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { resolveBlockCollisions } from '@ts-minecraft/game'
import { PLAYER_HALF_W, PLAYER_HALF_H } from './physics-builders'

// ---------------------------------------------------------------------------
// Position helpers (named to avoid magic numbers in each test)
// ---------------------------------------------------------------------------

/**
 * Returns a center Y such that the player's feet are 0.01 units INSIDE the
 * top of `blockY` — just enough to trigger the floor resolver.
 */
const centerYGroundedOn = (blockY: number): number =>
  blockY + 1 + PLAYER_HALF_H - 0.01

/**
 * Returns a center Y such that the player's head is 0.05 units INSIDE the
 * bottom of `blockY` — just enough to trigger the ceiling resolver.
 */
const centerYHeadInsideCeiling = (blockY: number): number =>
  blockY - PLAYER_HALF_H + 0.05

// ---------------------------------------------------------------------------
// Shared predicates
// ---------------------------------------------------------------------------

/** Predicate that treats every coordinate as solid. */
const allSolid = (_bx: number, _by: number, _bz: number): boolean => true

/** Predicate that treats every coordinate as empty (no blocks). */
const noBlocks = (_bx: number, _by: number, _bz: number): boolean => false

// ---------------------------------------------------------------------------
// Zero-velocity scenarios (static player)
// ---------------------------------------------------------------------------

describe('resolveBlockCollisions — zero velocity (no movement)', () => {
  it('static player floating in air stays put (not grounded, no velocity change)', () => {
    const pos = { x: 0, y: 20, z: 0 }
    const vel = { x: 0, y: 0, z: 0 }

    const result = resolveBlockCollisions(pos, vel, PLAYER_HALF_W, PLAYER_HALF_H, noBlocks)

    expect(result.isGrounded).toBe(false)
    expect(result.position.x).toBe(0)
    expect(result.position.y).toBe(20)
    expect(result.position.z).toBe(0)
    expect(result.velocity.x).toBe(0)
    expect(result.velocity.y).toBe(0)
    expect(result.velocity.z).toBe(0)
  })

  it('static player (vy=0) with feet inside a block is pushed up and grounded', () => {
    // Feet must penetrate the block surface slightly — see geometry note above.
    const BLOCK_Y = 5
    const pos = { x: 0, y: centerYGroundedOn(BLOCK_Y), z: 0 }
    const vel = { x: 0, y: 0, z: 0 }
    const solid = (_bx: number, by: number, _bz: number): boolean => by === BLOCK_Y

    const result = resolveBlockCollisions(pos, vel, PLAYER_HALF_W, PLAYER_HALF_H, solid)

    expect(result.isGrounded).toBe(true)
    expect(result.velocity.y).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Simultaneous multi-axis movement
// ---------------------------------------------------------------------------

describe('resolveBlockCollisions — simultaneous multi-axis movement', () => {
  it('player moving diagonally (+X +Z) into a wall at the correct height stops in X', () => {
    // Place a wall block at bx=5, by=10, bz=0.
    // Player is at the same height so X resolver finds the wall.
    const WALL_BX = 5; const WALL_BY = 10
    const pos = {
      x: 4.75,
      y: centerYGroundedOn(WALL_BY - 1), // feet inside block at by=9 → grounded one below wall
      z: 0,
    }
    const vel = { x: 1, y: 0, z: 1 }
    const solid = (bx: number, by: number, _bz: number): boolean =>
      (bx === WALL_BX && by >= WALL_BY - 1) || by === WALL_BY - 1

    const result = resolveBlockCollisions(pos, vel, PLAYER_HALF_W, PLAYER_HALF_H, solid)

    // Y grounded resolves first; X wall is still in player's bounding box after Y.
    expect(result.velocity.x).toBe(0)
  })

  it('player moving diagonally (-X -Z) away from all blocks has no X or Z change', () => {
    const pos = { x: 0, y: 20, z: 0 }
    const vel = { x: -2, y: -1, z: -2 }

    const result = resolveBlockCollisions(pos, vel, PLAYER_HALF_W, PLAYER_HALF_H, noBlocks)

    expect(result.velocity.x).toBe(-2)
    expect(result.velocity.z).toBe(-2)
    expect(result.velocity.y).toBe(-1)
  })

  it('player falling while moving in X resolves both floor and wall correctly', () => {
    // Floor at FLOOR_BY=9 (player feet overlap it) and wall at WALL_BX=5.
    const FLOOR_BY = 9; const WALL_BX = 5
    const pos = {
      x: 4.75,
      y: centerYGroundedOn(FLOOR_BY), // feet inside FLOOR_BY block
      z: 0,
    }
    const vel = { x: 1, y: -5, z: 0 }
    const solid = (bx: number, by: number, _bz: number): boolean =>
      by === FLOOR_BY || bx === WALL_BX

    const result = resolveBlockCollisions(pos, vel, PLAYER_HALF_W, PLAYER_HALF_H, solid)

    expect(result.isGrounded).toBe(true)
    expect(result.velocity.y).toBe(0)
    // After Y snaps the player, X wall must still be in range for vx to stop.
    expect(result.velocity.x).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Large position values (world far from origin)
// ---------------------------------------------------------------------------

describe('resolveBlockCollisions — large world coordinates', () => {
  it('behaves correctly when block and player are at very large positive coordinates', () => {
    const LARGE_OFFSET = 10_000
    const BLOCK_Y = LARGE_OFFSET + 5
    // Feet slightly inside block (overlap triggers resolver)
    const pos = { x: LARGE_OFFSET, y: centerYGroundedOn(BLOCK_Y), z: LARGE_OFFSET }
    const vel = { x: 0, y: -1, z: 0 }
    const solid = (_bx: number, by: number, _bz: number): boolean => by === BLOCK_Y

    const result = resolveBlockCollisions(pos, vel, PLAYER_HALF_W, PLAYER_HALF_H, solid)

    expect(result.isGrounded).toBe(true)
    expect(result.velocity.y).toBe(0)
  })

  it('behaves correctly when block and player are at large negative X/Z coordinates', () => {
    const LARGE_NEG = -500
    const BLOCK_Y = 10
    const pos = { x: LARGE_NEG, y: centerYGroundedOn(BLOCK_Y), z: LARGE_NEG }
    const vel = { x: 0, y: -1, z: 0 }
    const solid = (_bx: number, by: number, _bz: number): boolean => by === BLOCK_Y

    const result = resolveBlockCollisions(pos, vel, PLAYER_HALF_W, PLAYER_HALF_H, solid)

    expect(result.isGrounded).toBe(true)
    expect(result.velocity.y).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// All-solid world
// ---------------------------------------------------------------------------

describe('resolveBlockCollisions — all-solid world', () => {
  it('player inside all-solid world is pushed to highest floor by Y resolver', () => {
    const pos = { x: 0, y: 5, z: 0 }
    const vel = { x: 0, y: -1, z: 0 }

    const result = resolveBlockCollisions(pos, vel, PLAYER_HALF_W, PLAYER_HALF_H, allSolid)

    // Grounded must be true — the Y resolver found at least one floor.
    expect(result.isGrounded).toBe(true)
    expect(result.velocity.y).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Ceiling-only scenarios (jumping up)
// ---------------------------------------------------------------------------

describe('resolveBlockCollisions — ceiling collision (vy > 0)', () => {
  it('player jumping into ceiling stops vertical velocity and is NOT grounded', () => {
    // Head must be slightly inside the ceiling block (blockBot = CEIL_BY).
    const CEIL_BY = 7
    const pos = { x: 0, y: centerYHeadInsideCeiling(CEIL_BY), z: 0 }
    const vel = { x: 0, y: 5, z: 0 }
    const solid = (_bx: number, by: number, _bz: number): boolean => by === CEIL_BY

    const result = resolveBlockCollisions(pos, vel, PLAYER_HALF_W, PLAYER_HALF_H, solid)

    expect(result.isGrounded).toBe(false)
    expect(result.velocity.y).toBe(0)
  })

  it('player jumping in open air has unchanged velocity', () => {
    const pos = { x: 0, y: 5, z: 0 }
    const vel = { x: 0, y: 8, z: 0 }

    const result = resolveBlockCollisions(pos, vel, PLAYER_HALF_W, PLAYER_HALF_H, noBlocks)

    expect(result.isGrounded).toBe(false)
    expect(result.velocity.y).toBe(8)
    expect(result.position.y).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// Y-axis resolution ordering: Y resolved before X
// ---------------------------------------------------------------------------

describe('resolveBlockCollisions — separation-axis ordering', () => {
  it('Y axis is resolved before X — player falling onto a ledge does not embed sideways', () => {
    // Block at by=9 only. Player falls vertically with small vx.
    // Y must clamp vy first; X finds no wall after Y resolution.
    const BLOCK_Y = 9
    const pos = { x: 0, y: centerYGroundedOn(BLOCK_Y), z: 0 }
    const vel = { x: 0.5, y: -3, z: 0 }
    const solid = (_bx: number, by: number, _bz: number): boolean => by === BLOCK_Y

    const result = resolveBlockCollisions(pos, vel, PLAYER_HALF_W, PLAYER_HALF_H, solid)

    // Y resolves: player grounded, vy = 0.
    expect(result.isGrounded).toBe(true)
    expect(result.velocity.y).toBe(0)
    // X was not blocked (no wall at x-adjacent positions).
    expect(result.velocity.x).toBe(0.5)
  })
})

// ---------------------------------------------------------------------------
// Custom (non-player) AABB extents
// ---------------------------------------------------------------------------

describe('resolveBlockCollisions — custom AABB extents', () => {
  it('tiny AABB (halfW=0.1, halfH=0.1) resolves grounding when feet overlap a block', () => {
    const TINY_HALF_W = 0.1
    const TINY_HALF_H = 0.1
    const BLOCK_Y = 5
    // Feet inside block: center = BLOCK_Y + 1 + TINY_HALF_H - 0.01
    const pos = { x: 0, y: BLOCK_Y + 1 + TINY_HALF_H - 0.01, z: 0 }
    const vel = { x: 0, y: -1, z: 0 }
    const solid = (_bx: number, by: number, _bz: number): boolean => by === BLOCK_Y

    const result = resolveBlockCollisions(pos, vel, TINY_HALF_W, TINY_HALF_H, solid)

    expect(result.isGrounded).toBe(true)
    expect(result.velocity.y).toBe(0)
  })

  it('wide AABB (halfW=1.0) triggers wall collision farther from block face', () => {
    const WIDE_HALF_W = 1.0
    const BLOCK_Y = 10
    const WALL_BX = 3
    // Player at x=1.5, rightEdge = 1.5 + 1.0 - 0.001 = 2.499 → bxFace = 2 → no hit
    // Player at x=2.5, rightEdge = 2.5 + 1.0 - 0.001 = 3.499 → bxFace = 3 → hit!
    const pos = { x: 2.5, y: centerYGroundedOn(BLOCK_Y - 1), z: 0 }
    const vel = { x: 1, y: 0, z: 0 }
    const solid = (bx: number, by: number, _bz: number): boolean =>
      (bx === WALL_BX && by >= BLOCK_Y - 1) || by === BLOCK_Y - 1

    const result = resolveBlockCollisions(pos, vel, WIDE_HALF_W, PLAYER_HALF_H, solid)

    expect(result.velocity.x).toBe(0)
  })
})
