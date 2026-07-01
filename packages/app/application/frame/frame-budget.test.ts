import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TARGET_FPS,
  TargetFps,
  computeChunkSyncBudgetMs,
  computeFrameBudgetMs,
  computeMaxChunkUpdatesPerFrame,
  computeMaxDirtyChunkUpdatesPerFrame,
} from './frame-budget'

// ─── computeFrameBudgetMs ─────────────────────────────────────────────────────
describe('computeFrameBudgetMs', () => {
  it('returns ~16.67ms at 60 FPS', () => {
    expect(computeFrameBudgetMs(60)).toBeCloseTo(1000 / 60)
  })

  it('returns ~8.33ms at 120 FPS (double refresh halves budget)', () => {
    expect(computeFrameBudgetMs(120)).toBeCloseTo(1000 / 120)
  })

  it('accepts a branded TargetFps value', () => {
    expect(computeFrameBudgetMs(DEFAULT_TARGET_FPS)).toBeCloseTo(1000 / 60)
  })
})

// ─── computeChunkSyncBudgetMs ─────────────────────────────────────────────────
describe('computeChunkSyncBudgetMs', () => {
  it('returns 4ms at 60 FPS (pinned baseline)', () => {
    expect(computeChunkSyncBudgetMs(60)).toBeCloseTo(4)
  })

  it('returns 2ms at 120 FPS', () => {
    expect(computeChunkSyncBudgetMs(120)).toBeCloseTo(2)
  })

  it('is approximately 25% of the total frame budget', () => {
    const fps = 60
    expect(computeChunkSyncBudgetMs(fps)).toBeCloseTo(computeFrameBudgetMs(fps) * 0.25, 0)
  })
})

// ─── computeMaxChunkUpdatesPerFrame ──────────────────────────────────────────
describe('computeMaxChunkUpdatesPerFrame', () => {
  it('returns 4 at 60 FPS', () => {
    expect(computeMaxChunkUpdatesPerFrame(60)).toBe(4)
  })

  it('returns 2 at 120 FPS', () => {
    expect(computeMaxChunkUpdatesPerFrame(120)).toBe(2)
  })

  it('returns at least 1 even at very high FPS', () => {
    expect(computeMaxChunkUpdatesPerFrame(1000)).toBeGreaterThanOrEqual(1)
  })
})

// ─── computeMaxDirtyChunkUpdatesPerFrame ──────────────────────────────────────
describe('computeMaxDirtyChunkUpdatesPerFrame', () => {
  it('returns 2 at 60 FPS', () => {
    expect(computeMaxDirtyChunkUpdatesPerFrame(60)).toBe(2)
  })

  it('returns 1 at 120 FPS', () => {
    expect(computeMaxDirtyChunkUpdatesPerFrame(120)).toBe(1)
  })

  it('is never greater than computeMaxChunkUpdatesPerFrame', () => {
    for (const fps of [30, 60, 90, 120, 144, 240]) {
      expect(computeMaxDirtyChunkUpdatesPerFrame(fps)).toBeLessThanOrEqual(computeMaxChunkUpdatesPerFrame(fps))
    }
  })

  it('is at least 1 at all realistic FPS values', () => {
    for (const fps of [30, 60, 120, 240, 360]) {
      expect(computeMaxDirtyChunkUpdatesPerFrame(fps)).toBeGreaterThanOrEqual(1)
    }
  })
})

// ─── DEFAULT_TARGET_FPS ───────────────────────────────────────────────────────
describe('DEFAULT_TARGET_FPS', () => {
  it('is 60 FPS', () => {
    expect(TargetFps.toNumber(DEFAULT_TARGET_FPS)).toBe(60)
  })
})
