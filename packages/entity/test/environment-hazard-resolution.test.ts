import { describe, expect, it } from 'vitest'
import {
  isSuffocatingBlock,
  accrueHazardTicks,
  nextAirSecs,
} from '@ts-minecraft/entity/domain/environment-hazard-resolution'
import { MAX_AIR_SECS, NON_SUFFOCATING_BLOCKS } from '@ts-minecraft/entity/domain/environment-hazard.config'

// ─── isSuffocatingBlock ───────────────────────────────────────────────────────
describe('isSuffocatingBlock', () => {
  it('returns false for null (no block / air)', () => {
    expect(isSuffocatingBlock(null)).toBe(false)
  })

  it('returns false for AIR (non-suffocating)', () => {
    expect(isSuffocatingBlock('AIR')).toBe(false)
  })

  it('returns false for WATER (non-suffocating — players can breathe logic uses air supply)', () => {
    expect(isSuffocatingBlock('WATER')).toBe(false)
  })

  it('returns true for STONE (a solid block)', () => {
    expect(isSuffocatingBlock('STONE')).toBe(true)
  })

  it('returns true for DIRT (a solid block)', () => {
    expect(isSuffocatingBlock('DIRT')).toBe(true)
  })

  it('returns false for every member of NON_SUFFOCATING_BLOCKS', () => {
    for (const block of NON_SUFFOCATING_BLOCKS) {
      expect(isSuffocatingBlock(block)).toBe(false)
    }
  })
})

// ─── accrueHazardTicks ────────────────────────────────────────────────────────
describe('accrueHazardTicks', () => {
  it('produces 0 ticks when accumulator + dt is less than the interval', () => {
    const { acc, ticks } = accrueHazardTicks(0, 0.3, 0.5)
    expect(ticks).toBe(0)
    expect(acc).toBeCloseTo(0.3)
  })

  it('produces 1 tick when the threshold is exactly reached', () => {
    const { acc, ticks } = accrueHazardTicks(0, 0.5, 0.5)
    expect(ticks).toBe(1)
    expect(acc).toBeCloseTo(0)
  })

  it('produces 1 tick and carries the remainder', () => {
    const { acc, ticks } = accrueHazardTicks(0, 0.6, 0.5)
    expect(ticks).toBe(1)
    expect(acc).toBeCloseTo(0.1)
  })

  it('produces 2 ticks when double the interval elapses', () => {
    const { acc, ticks } = accrueHazardTicks(0, 1.0, 0.5)
    expect(ticks).toBe(2)
    expect(acc).toBeCloseTo(0)
  })

  it('accumulates across multiple calls (frame-rate independence)', () => {
    // Simulate 5 frames of 0.1s each with a 0.5s interval → 1 tick at frame 5
    let acc = 0
    let totalTicks = 0
    for (let i = 0; i < 5; i++) {
      const result = accrueHazardTicks(acc, 0.1, 0.5)
      acc = result.acc
      totalTicks += result.ticks
    }
    expect(totalTicks).toBe(1)
    expect(acc).toBeCloseTo(0)
  })

  it('produces the same total ticks for one large frame vs many small frames', () => {
    // One 2s frame at 0.5s interval
    const { ticks: bigFrameTicks } = accrueHazardTicks(0, 2.0, 0.5)

    // Twenty 0.1s frames
    let acc = 0
    let smallFrameTicks = 0
    for (let i = 0; i < 20; i++) {
      const result = accrueHazardTicks(acc, 0.1, 0.5)
      acc = result.acc
      smallFrameTicks += result.ticks
    }
    expect(bigFrameTicks).toBe(smallFrameTicks)
  })

  it('carries an existing accumulator into the next interval', () => {
    // Start with 0.4s accumulated, add 0.2s → total 0.6s → 1 tick, remainder 0.1s
    const { acc, ticks } = accrueHazardTicks(0.4, 0.2, 0.5)
    expect(ticks).toBe(1)
    expect(acc).toBeCloseTo(0.1)
  })
})

// ─── nextAirSecs ─────────────────────────────────────────────────────────────
describe('nextAirSecs', () => {
  it('returns maxAirSecs immediately when head is not submerged', () => {
    expect(nextAirSecs(10, false, 0.05)).toBe(MAX_AIR_SECS)
  })

  it('uses the passed maxAirSecs instead of the default when not submerged', () => {
    expect(nextAirSecs(5, false, 0.05, 30)).toBe(30)
  })

  it('drains air supply by dt when head is submerged', () => {
    expect(nextAirSecs(15, true, 0.5)).toBeCloseTo(14.5)
  })

  it('clamps air supply to 0 when drain exceeds current supply', () => {
    expect(nextAirSecs(0.1, true, 1.0)).toBe(0)
  })

  it('does not produce negative air supply', () => {
    expect(nextAirSecs(0, true, 5.0)).toBe(0)
  })

  it('starts refilling to maxAirSecs the moment the head surfaces', () => {
    const afterDrain = nextAirSecs(5, true, 1)
    const afterSurface = nextAirSecs(afterDrain, false, 0.05)
    expect(afterSurface).toBe(MAX_AIR_SECS)
  })
})
