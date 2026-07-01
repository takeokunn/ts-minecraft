import { describe, expect, it } from 'vitest'
import {
  isHorizontalBlocked,
  toHorizontalTarget,
  isSamePosition,
  isSameVelocity,
  isFinitePosition,
  isFiniteVelocity,
} from '@ts-minecraft/entity/domain/mob/entity-manager-utils'

const pos = (x: number, y: number, z: number) => ({ x, y, z })
const vec = (x: number, y: number, z: number) => ({ x, y, z })

// ─── isHorizontalBlocked ──────────────────────────────────────────────────────
describe('isHorizontalBlocked', () => {
  it('detects X-axis blocking (non-zero before, zero after)', () => {
    expect(isHorizontalBlocked(vec(1, 0, 0), vec(0, 0, 0))).toBe(true)
  })

  it('detects Z-axis blocking', () => {
    expect(isHorizontalBlocked(vec(0, 0, 1), vec(0, 0, 0))).toBe(true)
  })

  it('returns false when neither axis is blocked', () => {
    expect(isHorizontalBlocked(vec(1, 0, 1), vec(1, 0, 1))).toBe(false)
  })

  it('returns false when before velocity is already zero (not "stopped by wall")', () => {
    expect(isHorizontalBlocked(vec(0, 0, 0), vec(0, 0, 0))).toBe(false)
  })
})

// ─── toHorizontalTarget ───────────────────────────────────────────────────────
describe('toHorizontalTarget', () => {
  it('takes player X and Z, but entity Y', () => {
    const entity = pos(5, 10, 5)
    const player = pos(0, 0, 0)
    const result = toHorizontalTarget(entity, player)
    expect(result.x).toBe(player.x)
    expect(result.y).toBe(entity.y) // entity Y preserved
    expect(result.z).toBe(player.z)
  })
})

// ─── isSamePosition ───────────────────────────────────────────────────────────
describe('isSamePosition', () => {
  it('returns true for identical positions', () => {
    expect(isSamePosition(pos(1, 2, 3), pos(1, 2, 3))).toBe(true)
  })

  it('returns false when any axis differs', () => {
    expect(isSamePosition(pos(1, 2, 3), pos(1, 2, 4))).toBe(false)
  })
})

// ─── isSameVelocity ───────────────────────────────────────────────────────────
describe('isSameVelocity', () => {
  it('returns true for identical velocities', () => {
    expect(isSameVelocity(vec(1, 0, -1), vec(1, 0, -1))).toBe(true)
  })

  it('returns false when Y differs', () => {
    expect(isSameVelocity(vec(0, 1, 0), vec(0, 2, 0))).toBe(false)
  })
})

// ─── isFinitePosition ─────────────────────────────────────────────────────────
describe('isFinitePosition', () => {
  it('returns true for a normal position', () => {
    expect(isFinitePosition(pos(1, 64, 1))).toBe(true)
  })

  it('returns false when any coordinate is Infinity', () => {
    expect(isFinitePosition(pos(Infinity, 64, 0))).toBe(false)
  })

  it('returns false when any coordinate is NaN', () => {
    expect(isFinitePosition(pos(0, NaN, 0))).toBe(false)
  })
})

// ─── isFiniteVelocity ─────────────────────────────────────────────────────────
describe('isFiniteVelocity', () => {
  it('returns true for a normal velocity', () => {
    expect(isFiniteVelocity(vec(0, -9.8, 0))).toBe(true)
  })

  it('returns false for NaN velocity (physics blow-up guard)', () => {
    expect(isFiniteVelocity(vec(NaN, 0, 0))).toBe(false)
  })
})
