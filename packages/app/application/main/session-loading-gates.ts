import { Effect } from 'effect'
import {
  INITIAL_FPS_GATE_POLL_MS,
  INITIAL_FPS_GATE_STABLE_SAMPLES,
  INITIAL_FPS_GATE_TIMEOUT_MS,
  advanceInitialFrameRateGate,
  readDisplayedFps,
} from './session-loading-gates-state'
import { waitForPollingGate } from './session-loading-gates-polling'

export const waitForInitialFrameRate = (fpsElement: HTMLElement | null): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    if (fpsElement === null) return
    let stableSamples = 0
    yield* waitForPollingGate({
      pollMs: INITIAL_FPS_GATE_POLL_MS,
      timeoutMs: INITIAL_FPS_GATE_TIMEOUT_MS,
      step: () =>
        Effect.sync(() => {
          stableSamples = advanceInitialFrameRateGate(stableSamples, readDisplayedFps(fpsElement.textContent))
          return stableSamples >= INITIAL_FPS_GATE_STABLE_SAMPLES
        }),
    })
  })
