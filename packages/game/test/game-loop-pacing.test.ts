import { describe, expect, it } from 'vitest'
import {
  advanceFramePacing,
  TARGET_FRAME_RATE,
  MIN_FRAME_INTERVAL_MS,
} from '../application/game-loop-pacing'

// ─── constants ────────────────────────────────────────────────────────────────

describe('TARGET_FRAME_RATE and MIN_FRAME_INTERVAL_MS', () => {
  it('MIN_FRAME_INTERVAL_MS equals 1000 / TARGET_FRAME_RATE', () => {
    expect(MIN_FRAME_INTERVAL_MS).toBeCloseTo(1000 / TARGET_FRAME_RATE)
  })
})

// ─── advanceFramePacing ───────────────────────────────────────────────────────

describe('advanceFramePacing — no emit', () => {
  it('returns emit=false when accumulator is below the interval', () => {
    const { emit, accumulatedMs } = advanceFramePacing(0, 5, MIN_FRAME_INTERVAL_MS)
    expect(emit).toBe(false)
    expect(accumulatedMs).toBeCloseTo(5)
  })

  it('accumulates gap into accumulatedMs', () => {
    const { accumulatedMs } = advanceFramePacing(10, 5, MIN_FRAME_INTERVAL_MS)
    expect(accumulatedMs).toBeCloseTo(15)
  })
})

describe('advanceFramePacing — emits frame', () => {
  it('returns emit=true when accumulated reaches the interval', () => {
    const { emit } = advanceFramePacing(0, MIN_FRAME_INTERVAL_MS, MIN_FRAME_INTERVAL_MS)
    expect(emit).toBe(true)
  })

  it('subtracts one interval from accumulator after emitting', () => {
    const { accumulatedMs } = advanceFramePacing(0, MIN_FRAME_INTERVAL_MS + 5, MIN_FRAME_INTERVAL_MS)
    expect(accumulatedMs).toBeCloseTo(5)
  })
})

describe('advanceFramePacing — backlog cap', () => {
  it('caps accumulator to 2× intervalMs to prevent burst after pause', () => {
    // Large gap (background tab resumed)
    const { accumulatedMs } = advanceFramePacing(0, MIN_FRAME_INTERVAL_MS * 100, MIN_FRAME_INTERVAL_MS)
    expect(accumulatedMs).toBeLessThanOrEqual(MIN_FRAME_INTERVAL_MS * 2)
  })

  it('still emits after a large gap', () => {
    const { emit } = advanceFramePacing(0, MIN_FRAME_INTERVAL_MS * 100, MIN_FRAME_INTERVAL_MS)
    expect(emit).toBe(true)
  })
})
