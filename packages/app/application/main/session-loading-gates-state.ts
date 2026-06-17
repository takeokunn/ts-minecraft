const MIN_LOADING_SCREEN_DURATION_MS = 2500
const INITIAL_FPS_GATE_TARGET = 120
const INITIAL_FPS_GATE_TIMEOUT_MS = 8_000
const INITIAL_FPS_GATE_POLL_MS = 100
const INITIAL_FPS_GATE_STABLE_SAMPLES = 10

const readDisplayedFps = (textContent: string | null | undefined): number => {
  const fps = Number.parseFloat(textContent ?? '0')
  return Number.isFinite(fps) ? fps : 0
}

const advanceInitialFrameRateGate = (stableSamples: number, displayedFps: number): number =>
  displayedFps >= INITIAL_FPS_GATE_TARGET ? stableSamples + 1 : 0

const isLoadingGateTimedOut = (startedAtMs: number, nowMs: number, timeoutMs = INITIAL_FPS_GATE_TIMEOUT_MS): boolean =>
  nowMs - startedAtMs >= timeoutMs

const getRemainingLoadingScreenDurationMs = (loadingStartedAtMs: number, nowMs: number): number =>
  Math.max(0, MIN_LOADING_SCREEN_DURATION_MS - (nowMs - loadingStartedAtMs))

export {
  MIN_LOADING_SCREEN_DURATION_MS,
  INITIAL_FPS_GATE_TARGET,
  INITIAL_FPS_GATE_TIMEOUT_MS,
  INITIAL_FPS_GATE_POLL_MS,
  INITIAL_FPS_GATE_STABLE_SAMPLES,
  readDisplayedFps,
  advanceInitialFrameRateGate,
  isLoadingGateTimedOut,
  getRemainingLoadingScreenDurationMs,
}
