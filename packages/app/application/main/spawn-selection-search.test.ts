import { describe, expect, it } from 'vitest'
import {
  clampAboveWater,
  keyOf,
  scoreSpawnCandidate,
} from './spawn-selection-search'
import { PLAYER_HALF_HEIGHT, SEA_LEVEL } from '@ts-minecraft/core'

// ─── keyOf ───────────────────────────────────────────────────────────────────
describe('keyOf', () => {
  it('returns the expected "cx,cz" string format', () => {
    expect(keyOf(3, 5)).toBe('3,5')
  })

  it('handles negative coordinates', () => {
    expect(keyOf(-1, -2)).toBe('-1,-2')
  })

  it('handles zero coordinates', () => {
    expect(keyOf(0, 0)).toBe('0,0')
  })

  it('produces distinct keys for transposed (cx,cz) pairs', () => {
    expect(keyOf(1, 2)).not.toBe(keyOf(2, 1))
  })
})

// ─── scoreSpawnCandidate ──────────────────────────────────────────────────────
describe('scoreSpawnCandidate', () => {
  it('prefers more open surfaces (higher openness = higher score)', () => {
    const open = scoreSpawnCandidate({ openness: 20, distanceSq: 100 })
    const closed = scoreSpawnCandidate({ openness: 5, distanceSq: 100 })
    expect(open).toBeGreaterThan(closed)
  })

  it('prefers closer candidates when openness is equal', () => {
    const near = scoreSpawnCandidate({ openness: 10, distanceSq: 1 })
    const far = scoreSpawnCandidate({ openness: 10, distanceSq: 900 })
    expect(near).toBeGreaterThan(far)
  })

  it('returns NEGATIVE_INFINITY for a zero-openness far candidate (worst possible)', () => {
    const score = scoreSpawnCandidate({ openness: 0, distanceSq: 10000 })
    expect(score).toBeLessThan(0)
  })
})

// ─── clampAboveWater ──────────────────────────────────────────────────────────
const MIN_SPAWN_BODY_Y = SEA_LEVEL + 1 + PLAYER_HALF_HEIGHT

describe('clampAboveWater', () => {
  it('returns the selection unchanged when already above water', () => {
    const sel = { position: { x: 0, y: MIN_SPAWN_BODY_Y + 5, z: 0 }, yaw: 0 }
    expect(clampAboveWater(sel)).toBe(sel) // identity (same object reference)
  })

  it('lifts a submerged spawn to MIN_SPAWN_BODY_Y', () => {
    const sel = { position: { x: 10, y: MIN_SPAWN_BODY_Y - 5, z: 10 }, yaw: 1.5 }
    const clamped = clampAboveWater(sel)
    expect(clamped.position.y).toBe(MIN_SPAWN_BODY_Y)
    expect(clamped.position.x).toBe(10)
    expect(clamped.yaw).toBe(1.5)
  })

  it('lifts a spawn exactly 0.1 below the limit', () => {
    const sel = { position: { x: 0, y: MIN_SPAWN_BODY_Y - 0.1, z: 0 }, yaw: 0 }
    const clamped = clampAboveWater(sel)
    expect(clamped.position.y).toBe(MIN_SPAWN_BODY_Y)
  })

  it('passes through a spawn at exactly MIN_SPAWN_BODY_Y (boundary = safe)', () => {
    const sel = { position: { x: 0, y: MIN_SPAWN_BODY_Y, z: 0 }, yaw: 0 }
    expect(clampAboveWater(sel)).toBe(sel)
  })
})

describe('scoreSpawnCandidate — grass surface preference', () => {
  it('prefers a grass column over an equally-open stone column', () => {
    const grass = scoreSpawnCandidate({ openness: 10, distanceSq: 100, isGrassSurface: true })
    const stone = scoreSpawnCandidate({ openness: 10, distanceSq: 100, isGrassSurface: false })
    expect(grass).toBeGreaterThan(stone)
  })

  it('grass bonus equals 5 openness points — a dramatically more open non-grass column still wins', () => {
    const grass = scoreSpawnCandidate({ openness: 10, distanceSq: 0, isGrassSurface: true })
    const veryOpenStone = scoreSpawnCandidate({ openness: 16, distanceSq: 0, isGrassSurface: false })
    expect(veryOpenStone).toBeGreaterThan(grass)
  })

  it('treats a missing isGrassSurface as non-grass (back-compat)', () => {
    expect(scoreSpawnCandidate({ openness: 10, distanceSq: 100 }))
      .toBe(scoreSpawnCandidate({ openness: 10, distanceSq: 100, isGrassSurface: false }))
  })
})
