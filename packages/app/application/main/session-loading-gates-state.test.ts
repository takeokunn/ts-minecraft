import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'

import {
  INITIAL_FPS_GATE_POLL_MS,
  INITIAL_FPS_GATE_STABLE_SAMPLES,
  INITIAL_FPS_GATE_TARGET,
  INITIAL_FPS_GATE_TIMEOUT_MS,
  MIN_LOADING_SCREEN_DURATION_MS,
  advanceInitialFrameRateGate,
  getRemainingLoadingScreenDurationMs,
  isLoadingGateTimedOut,
  readDisplayedFps,
} from './session-loading-gates-state'

describe('session-loading-gates-state', () => {
  it('parses displayed fps text defensively', () => {
    expect(readDisplayedFps('120.5')).toBe(120.5)
    expect(readDisplayedFps('not-a-number')).toBe(0)
    expect(readDisplayedFps(null)).toBe(0)
  })

  it('advances the initial frame rate gate only for sustained target fps', () => {
    expect(advanceInitialFrameRateGate(0, INITIAL_FPS_GATE_TARGET - 1)).toBe(0)
    expect(advanceInitialFrameRateGate(0, INITIAL_FPS_GATE_TARGET)).toBe(1)
    expect(advanceInitialFrameRateGate(INITIAL_FPS_GATE_STABLE_SAMPLES - 1, INITIAL_FPS_GATE_TARGET)).toBe(
      INITIAL_FPS_GATE_STABLE_SAMPLES,
    )
  })

  it('reports timeouts and remaining loading duration with clamping', () => {
    expect(isLoadingGateTimedOut(1_000, 1_000 + INITIAL_FPS_GATE_TIMEOUT_MS - 1)).toBe(false)
    expect(isLoadingGateTimedOut(1_000, 1_000 + INITIAL_FPS_GATE_TIMEOUT_MS)).toBe(true)
    expect(getRemainingLoadingScreenDurationMs(1_000, 1_000 + MIN_LOADING_SCREEN_DURATION_MS - 1)).toBe(1)
    expect(getRemainingLoadingScreenDurationMs(1_000, 1_000 + MIN_LOADING_SCREEN_DURATION_MS)).toBe(0)
    expect(getRemainingLoadingScreenDurationMs(1_000, 1_000 + MIN_LOADING_SCREEN_DURATION_MS + INITIAL_FPS_GATE_POLL_MS)).toBe(0)
  })
})
