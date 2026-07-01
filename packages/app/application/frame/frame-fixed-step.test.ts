import { describe, expect, it } from 'vitest'
import { advanceFixedStep } from './frame-fixed-step'

// ─── advanceFixedStep ─────────────────────────────────────────────────────────
//
// Pure function: no ticks fire until the accumulator hits the interval.
// Returns [ticks, remainder] to avoid per-frame object allocation.
describe('advanceFixedStep', () => {
  it('produces 0 ticks when accumulated + dt is below the interval', () => {
    const [ticks, remainder] = advanceFixedStep(0, 0.03, 0.05)
    expect(ticks).toBe(0)
    expect(remainder).toBeCloseTo(0.03)
  })

  it('produces 1 tick when the interval is exactly reached', () => {
    const [ticks, remainder] = advanceFixedStep(0, 0.05, 0.05)
    expect(ticks).toBe(1)
    expect(remainder).toBeCloseTo(0)
  })

  it('produces 1 tick and carries the remainder', () => {
    const [ticks, remainder] = advanceFixedStep(0, 0.07, 0.05)
    expect(ticks).toBe(1)
    expect(remainder).toBeCloseTo(0.02)
  })

  it('produces 2 ticks when twice the interval elapses', () => {
    const [ticks, remainder] = advanceFixedStep(0, 0.10, 0.05)
    expect(ticks).toBe(2)
    expect(remainder).toBeCloseTo(0)
  })

  it('accumulates correctly across multiple calls (frame-rate independence)', () => {
    // Simulate 5 frames of 0.04s each with a 0.05s interval → 4 ticks total in ~0.2s
    let accumulated = 0
    let totalTicks = 0
    for (let i = 0; i < 5; i++) {
      const [ticks, next] = advanceFixedStep(accumulated, 0.04, 0.05)
      accumulated = next
      totalTicks += ticks
    }
    expect(totalTicks).toBe(4)
  })

  it('large dt fires many ticks at once (identical to incremental)', () => {
    const [bigFrameTicks] = advanceFixedStep(0, 1.0, 0.05)
    expect(bigFrameTicks).toBe(20)
  })

  it('carries an existing non-zero accumulator into the next interval', () => {
    // Start at 0.04s (close to threshold of 0.05s), add 0.02s → 0.06 → 1 tick, 0.01 remain
    const [ticks, remainder] = advanceFixedStep(0.04, 0.02, 0.05)
    expect(ticks).toBe(1)
    expect(remainder).toBeCloseTo(0.01)
  })

  it('returns [0, dt] when interval is very large (rare tick scenario)', () => {
    const [ticks, remainder] = advanceFixedStep(0, 0.016, 60)
    expect(ticks).toBe(0)
    expect(remainder).toBeCloseTo(0.016)
  })
})
