import { describe, expect, it, vi } from 'vitest'
import {
  SKELETON_SHOT_SOURCE_EYE_HEIGHT,
  SKELETON_SHOT_TARGET_HEIGHT,
  PROJECTILE_PATH_SAMPLE_STEP,
  makeSkeletonShotSourcePosition,
  makeSkeletonShotTargetPosition,
  isShotPathBlocked,
} from '@ts-minecraft/entity/application/mob/entity-manager-projectile'
import type { ManagedEntity } from '@ts-minecraft/entity/domain/mob/entity-internal'
import type { Position } from '@ts-minecraft/core'

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeEntity = (x: number, y: number, z: number): ManagedEntity =>
  ({ position: { x, y, z } }) as unknown as ManagedEntity

const pos = (x: number, y: number, z: number): Position => ({ x, y, z })

// ─── makeSkeletonShotSourcePosition ──────────────────────────────────────────
describe('makeSkeletonShotSourcePosition', () => {
  it('elevates y by SKELETON_SHOT_SOURCE_EYE_HEIGHT', () => {
    const entity = makeEntity(0, 64, 0)
    const result = makeSkeletonShotSourcePosition(entity)
    expect(result.y).toBeCloseTo(64 + SKELETON_SHOT_SOURCE_EYE_HEIGHT)
  })

  it('preserves x and z from the entity position', () => {
    const entity = makeEntity(10, 64, -5)
    const result = makeSkeletonShotSourcePosition(entity)
    expect(result.x).toBe(10)
    expect(result.z).toBe(-5)
  })

  it('works at the origin', () => {
    const entity = makeEntity(0, 0, 0)
    const result = makeSkeletonShotSourcePosition(entity)
    expect(result).toEqual({
      x: 0,
      y: SKELETON_SHOT_SOURCE_EYE_HEIGHT,
      z: 0,
    })
  })

  it('produces a different y than the entity foot-level position', () => {
    const entity = makeEntity(0, 64, 0)
    const result = makeSkeletonShotSourcePosition(entity)
    expect(result.y).not.toBe(entity.position.y)
  })
})

// ─── makeSkeletonShotTargetPosition ──────────────────────────────────────────
describe('makeSkeletonShotTargetPosition', () => {
  it('elevates y by SKELETON_SHOT_TARGET_HEIGHT', () => {
    const result = makeSkeletonShotTargetPosition(pos(0, 64, 0))
    expect(result.y).toBeCloseTo(64 + SKELETON_SHOT_TARGET_HEIGHT)
  })

  it('preserves x and z from the player position', () => {
    const result = makeSkeletonShotTargetPosition(pos(-10, 70, 20))
    expect(result.x).toBe(-10)
    expect(result.z).toBe(20)
  })

  it('target height is less than source eye height (shoots slightly downward)', () => {
    expect(SKELETON_SHOT_TARGET_HEIGHT).toBeLessThan(SKELETON_SHOT_SOURCE_EYE_HEIGHT)
  })
})

// ─── isShotPathBlocked ────────────────────────────────────────────────────────
describe('isShotPathBlocked', () => {
  it('returns false when no blocker function is provided', () => {
    const result = isShotPathBlocked(pos(0, 0, 0), pos(10, 0, 0))
    expect(result).toBe(false)
  })

  it('returns false for a zero-length shot (from === to)', () => {
    const blocker = vi.fn(() => true)
    const result = isShotPathBlocked(pos(5, 5, 5), pos(5, 5, 5), blocker)
    expect(result).toBe(false)
    expect(blocker).not.toHaveBeenCalled()
  })

  it('returns false when no intermediate point is blocked', () => {
    const neverBlock = vi.fn(() => false)
    const result = isShotPathBlocked(pos(0, 0, 0), pos(1, 0, 0), neverBlock)
    expect(result).toBe(false)
  })

  it('returns true when a midpoint is blocked', () => {
    // from (0,0,0) to (1,0,0): with sampleStep=0.25, steps=4
    // i=1 → t=0.25 → (0.25, 0, 0); i=2 → t=0.5 → (0.5, 0, 0); i=3 → t=0.75 → (0.75, 0, 0)
    const blockAtHalf = vi.fn((p: Position) => Math.abs(p.x - 0.5) < 0.1)
    const result = isShotPathBlocked(pos(0, 0, 0), pos(1, 0, 0), blockAtHalf)
    expect(result).toBe(true)
  })

  it('does not sample the start or end point (endpoints excluded)', () => {
    const calls: Position[] = []
    const blocker = vi.fn((p: Position) => {
      calls.push({ ...p })
      return false
    })
    isShotPathBlocked(pos(0, 0, 0), pos(1, 0, 0), blocker, 0.25)
    // steps = ceil(1 / 0.25) = 4; loop i=1,2,3 → t=0.25,0.5,0.75 (never t=0 or t=1)
    for (const p of calls) {
      expect(p.x).not.toBeCloseTo(0)
      expect(p.x).not.toBeCloseTo(1)
    }
  })

  it('samples the expected number of interior points', () => {
    const blocker = vi.fn(() => false)
    // distance = 1, sampleStep = 0.25 → steps=4, loop i=1,2,3 → 3 calls
    isShotPathBlocked(pos(0, 0, 0), pos(1, 0, 0), blocker, 0.25)
    expect(blocker).toHaveBeenCalledTimes(3)
  })

  it('stops as soon as a blocked point is found (short-circuits)', () => {
    const blocker = vi.fn((p: Position) => p.x > 0.2)
    isShotPathBlocked(pos(0, 0, 0), pos(1, 0, 0), blocker, 0.25)
    // First interior point at x=0.25 → blocked immediately; second point never sampled
    expect(blocker).toHaveBeenCalledTimes(1)
  })

  it('handles a 3D diagonal shot with the default sample step', () => {
    // 3D diagonal from (0,0,0) to (2,2,2): √12 ≈ 3.46 → steps = ceil(3.46/0.25) = 14
    const neverBlock = vi.fn(() => false)
    const result = isShotPathBlocked(pos(0, 0, 0), pos(2, 2, 2), neverBlock)
    expect(result).toBe(false)
    expect(neverBlock.mock.calls.length).toBeGreaterThan(0)
  })

  it('uses PROJECTILE_PATH_SAMPLE_STEP as the default step', () => {
    expect(PROJECTILE_PATH_SAMPLE_STEP).toBe(0.25)
  })
})
