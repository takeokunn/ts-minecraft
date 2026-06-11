import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import {
  computeFrameBudgetMs,
  computeChunkSyncBudgetMs,
  computeMaxChunkUpdatesPerFrame,
  computeMaxDirtyChunkUpdatesPerFrame,
  DEFAULT_TARGET_FPS,
  TargetFps,
} from '../application/frame/frame-budget'
import {
  MAX_CHUNK_UPDATES_PER_FRAME,
  WORLD_RENDERER_TIME_BUDGET_MS,
} from '@ts-minecraft/rendering'
import { MAX_DIRTY_CHUNK_UPDATES_PER_FRAME } from '@ts-minecraft/app/frame-handler.config'

const SIXTY_FPS = TargetFps.make(60)
const ONE_TWENTY_FPS = TargetFps.make(120)
const TWO_FORTY_FPS = TargetFps.make(240)
const THIRTY_FPS = TargetFps.make(30)

describe('frame-budget — FR-1.1 dynamic frame budgets', () => {
  describe('computeFrameBudgetMs', () => {
    it('returns 1000/fps', () => {
      expect(computeFrameBudgetMs(SIXTY_FPS)).toBeCloseTo(1000 / 60, 6)
      expect(computeFrameBudgetMs(ONE_TWENTY_FPS)).toBeCloseTo(1000 / 120, 6)
      expect(computeFrameBudgetMs(TWO_FORTY_FPS)).toBeCloseTo(1000 / 240, 6)
    })

    it('120 FPS → ~8.333 ms (the canonical "half a 60-FPS frame")', () => {
      expect(computeFrameBudgetMs(ONE_TWENTY_FPS)).toBeCloseTo(8.333333, 4)
    })

    it('accepts plain numbers as well as branded TargetFps', () => {
      expect(computeFrameBudgetMs(60)).toBe(computeFrameBudgetMs(SIXTY_FPS))
    })
  })

  describe('computeChunkSyncBudgetMs', () => {
    it('60 FPS → exactly 4 ms', () => {
      expect(computeChunkSyncBudgetMs(SIXTY_FPS)).toBe(4)
    })

    it('120 FPS → 2 ms; 240 FPS → 1 ms', () => {
      expect(computeChunkSyncBudgetMs(ONE_TWENTY_FPS)).toBe(2)
      expect(computeChunkSyncBudgetMs(TWO_FORTY_FPS)).toBe(1)
    })

    it('30 FPS → 8 ms (still ~25% of the 33 ms frame)', () => {
      expect(computeChunkSyncBudgetMs(THIRTY_FPS)).toBe(8)
    })

    it('stays roughly proportional to the frame budget (≈25%)', () => {
      const ratio = computeChunkSyncBudgetMs(ONE_TWENTY_FPS) / computeFrameBudgetMs(ONE_TWENTY_FPS)
      expect(ratio).toBeCloseTo(0.24, 2)
    })
  })

  describe('computeMaxChunkUpdatesPerFrame', () => {
    it('60 FPS → 8', () => {
      expect(computeMaxChunkUpdatesPerFrame(SIXTY_FPS)).toBe(8)
    })

    it('120 FPS → 16; 240 FPS → 32', () => {
      expect(computeMaxChunkUpdatesPerFrame(ONE_TWENTY_FPS)).toBe(16)
      expect(computeMaxChunkUpdatesPerFrame(TWO_FORTY_FPS)).toBe(32)
    })

    it('30 FPS → 4', () => {
      expect(computeMaxChunkUpdatesPerFrame(THIRTY_FPS)).toBe(4)
    })

    it('always integer (Math.ceil)', () => {
      expect(Number.isInteger(computeMaxChunkUpdatesPerFrame(TargetFps.make(75)))).toBe(true)
      expect(Number.isInteger(computeMaxChunkUpdatesPerFrame(TargetFps.make(144)))).toBe(true)
    })
  })

  describe('computeMaxDirtyChunkUpdatesPerFrame', () => {
    it('60 FPS → 4', () => {
      expect(computeMaxDirtyChunkUpdatesPerFrame(SIXTY_FPS)).toBe(4)
    })

    it('120 FPS → 8; 240 FPS → 16', () => {
      expect(computeMaxDirtyChunkUpdatesPerFrame(ONE_TWENTY_FPS)).toBe(8)
      expect(computeMaxDirtyChunkUpdatesPerFrame(TWO_FORTY_FPS)).toBe(16)
    })

    it('30 FPS → 2', () => {
      expect(computeMaxDirtyChunkUpdatesPerFrame(THIRTY_FPS)).toBe(2)
    })
  })

  describe('exported frame-budget constants', () => {
    it('exported MAX_CHUNK_UPDATES_PER_FRAME equals helper at DEFAULT_TARGET_FPS', () => {
      expect(MAX_CHUNK_UPDATES_PER_FRAME).toBe(computeMaxChunkUpdatesPerFrame(DEFAULT_TARGET_FPS))
    })

    it('exported WORLD_RENDERER_TIME_BUDGET_MS equals helper at DEFAULT_TARGET_FPS', () => {
      expect(WORLD_RENDERER_TIME_BUDGET_MS).toBe(computeChunkSyncBudgetMs(DEFAULT_TARGET_FPS))
    })

    it('exported MAX_DIRTY_CHUNK_UPDATES_PER_FRAME equals helper at DEFAULT_TARGET_FPS', () => {
      expect(MAX_DIRTY_CHUNK_UPDATES_PER_FRAME).toBe(computeMaxDirtyChunkUpdatesPerFrame(DEFAULT_TARGET_FPS))
    })

    it('60 FPS reproduces the historical hard-coded values exactly', () => {
      expect(computeChunkSyncBudgetMs(SIXTY_FPS)).toBe(4)
      expect(computeMaxChunkUpdatesPerFrame(SIXTY_FPS)).toBe(8)
      expect(computeMaxDirtyChunkUpdatesPerFrame(SIXTY_FPS)).toBe(4)
    })
  })

  describe('TargetFps brand', () => {
    it('rejects zero and negative values', () => {
      expect(() => TargetFps.make(0)).toThrow()
      expect(() => TargetFps.make(-60)).toThrow()
    })

    it('rejects non-finite values', () => {
      expect(() => TargetFps.make(Number.POSITIVE_INFINITY)).toThrow()
      expect(() => TargetFps.make(Number.NaN)).toThrow()
    })

    it('TargetFps.toNumber round-trips', () => {
      expect(TargetFps.toNumber(ONE_TWENTY_FPS)).toBe(120)
    })

    it('DEFAULT_TARGET_FPS is 60 (tracks the game loop TARGET_FRAME_RATE cap; R-perf-2)', () => {
      expect(TargetFps.toNumber(DEFAULT_TARGET_FPS)).toBe(60)
    })
  })
})
