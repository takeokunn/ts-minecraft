import { describe, it, expect } from 'vitest'
import { advanceFramePacing, TARGET_FRAME_RATE } from '@ts-minecraft/game'

// Pure frame-pacing function behind the FPS cap. Interval for 60fps ≈ 16.667ms.
const INTERVAL = 1000 / TARGET_FRAME_RATE

// Drives the accumulator across a stream of equal inter-callback gaps (simulating
// a display refreshing every `gapMs`), returning how many frames were emitted.
const runFeed = (gapMs: number, callbacks: number): number => {
  let acc = 0
  let emitted = 0
  for (let i = 0; i < callbacks; i++) {
    const r = advanceFramePacing(acc, gapMs, INTERVAL)
    acc = r.accumulatedMs
    if (r.emit) emitted++
  }
  return emitted
}

describe('advanceFramePacing — FPS cap pacing', () => {
  it('does not emit until a full interval has accumulated', () => {
    const r = advanceFramePacing(0, INTERVAL / 2, INTERVAL)
    expect(r.emit).toBe(false)
    expect(r.accumulatedMs).toBeCloseTo(INTERVAL / 2, 6)
  })

  it('emits once a full interval is reached and carries the remainder', () => {
    const r = advanceFramePacing(INTERVAL * 0.6, INTERVAL * 0.6, INTERVAL)
    expect(r.emit).toBe(true)
    // 1.2 intervals accumulated → emit one, carry 0.2 interval.
    expect(r.accumulatedMs).toBeCloseTo(INTERVAL * 0.2, 5)
  })

  it('a 60Hz feed emits ~one frame per callback (never halves under matched rate)', () => {
    // 100 callbacks at the target interval should emit ~100 frames, not ~50.
    const emitted = runFeed(INTERVAL, 100)
    expect(emitted).toBeGreaterThanOrEqual(99)
  })

  it('a 120Hz feed is capped to ~half the callbacks (≈60fps)', () => {
    const emitted = runFeed(INTERVAL / 2, 240) // 120Hz for ~2s
    expect(emitted).toBeGreaterThanOrEqual(118)
    expect(emitted).toBeLessThanOrEqual(122)
  })

  it('a 144Hz feed converges to ~60fps via carry-over (no undershoot)', () => {
    // 144Hz → 6.944ms gaps. Over 144 callbacks (~1s) expect ~60 emits.
    const emitted = runFeed(1000 / 144, 144)
    expect(emitted).toBeGreaterThanOrEqual(58)
    expect(emitted).toBeLessThanOrEqual(62)
  })

  it('clamps backlog so a long pause cannot unleash a burst', () => {
    // A 1-second gap (e.g. background tab) accumulates far more than 2 intervals,
    // but the accumulator is clamped — at most one emit, and ≤ one interval carried.
    const r = advanceFramePacing(0, 1000, INTERVAL)
    expect(r.emit).toBe(true)
    expect(r.accumulatedMs).toBeLessThanOrEqual(INTERVAL)
  })
})
