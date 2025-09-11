/**
 * Clock Adapter - Implements time operations using browser performance API
 *
 * This adapter provides concrete implementation for time-related operations
 * using browser's performance.now() API, implementing the IClockPort interface
 * to isolate the domain layer from browser-specific time implementations.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as Ref from 'effect/Ref'
import { IClockPort } from '/ports/clock.port'

/**
 * Clock state interface
 */
interface ClockState {
  readonly startTime: number
  readonly lastFrameTime: number
  readonly deltaTime: number
  readonly frameCount: number
  readonly fps: number
  readonly isPaused: boolean
  readonly timeScale: number
  readonly pausedTime: number
}

/**
 * Browser Clock Adapter implementation
 */
export interface IBrowserClockAdapter extends IClockPort {
  readonly tick: () => Effect.Effect<void, never, never>
  readonly reset: () => Effect.Effect<void, never, never>
}

export class BrowserClockAdapter extends Context.GenericTag('BrowserClockAdapter')<BrowserClockAdapter, IBrowserClockAdapter>() {}

/**
 * Browser Clock Adapter Layer
 */
export const BrowserClockAdapterLive = Layer.sync(BrowserClockAdapter, () => {
  const currentTime = performance.now()
  const clockState = Ref.unsafeMake<ClockState>({
    startTime: currentTime,
    lastFrameTime: currentTime,
    deltaTime: 0,
    frameCount: 0,
    fps: 0,
    isPaused: false,
    timeScale: 1.0,
    pausedTime: 0,
  })

  const now = (): Effect.Effect<number, never, never> => Effect.sync(() => performance.now())

  const deltaTime = (): Effect.Effect<number, never, never> => Ref.get(clockState).pipe(Effect.map((state) => state.deltaTime * state.timeScale))

  const frameTime = (): Effect.Effect<number, never, never> => Ref.get(clockState).pipe(Effect.map((state) => state.deltaTime))

  const fps = (): Effect.Effect<number, never, never> => Ref.get(clockState).pipe(Effect.map((state) => state.fps))

  const pause = (): Effect.Effect<void, never, never> =>
    Effect.gen(function* (_) {
      const currentTime = yield* _(now())
      yield* _(
        Ref.update(clockState, (state) => ({
          ...state,
          isPaused: true,
          pausedTime: currentTime,
        })),
      )
    })

  const resume = (): Effect.Effect<void, never, never> =>
    Effect.gen(function* (_) {
      const currentTime = yield* _(now())
      yield* _(
        Ref.get(clockState).pipe(
          Effect.flatMap((state) => {
            if (state.isPaused) {
              const pauseDuration = currentTime - state.pausedTime
              return Ref.set(clockState, {
                ...state,
                isPaused: false,
                startTime: state.startTime + pauseDuration,
                lastFrameTime: currentTime,
                pausedTime: 0,
              })
            }
            return Effect.void
          }),
        ),
      )
    })

  const isPaused = (): Effect.Effect<boolean, never, never> => Ref.get(clockState).pipe(Effect.map((state) => state.isPaused))

  const setTimeScale = (scale: number): Effect.Effect<void, never, never> =>
    Ref.update(clockState, (state) => ({
      ...state,
      timeScale: Math.max(0, scale), // Ensure non-negative time scale
    }))

  const getTimeScale = (): Effect.Effect<number, never, never> => Ref.get(clockState).pipe(Effect.map((state) => state.timeScale))

  const tick = (): Effect.Effect<void, never, never> =>
    Effect.gen(function* (_) {
      const currentTime = yield* _(now())
      const state = yield* _(Ref.get(clockState))

      if (state.isPaused) {
        return
      }

      const rawDelta = (currentTime - state.lastFrameTime) / 1000 // Convert to seconds
      const clampedDelta = Math.min(rawDelta, 0.1) // Clamp to prevent huge deltas

      // Calculate FPS (using a simple moving average)
      const newFrameCount = state.frameCount + 1
      const currentFps = rawDelta > 0 ? 1 / rawDelta : 0
      const smoothedFps = newFrameCount === 1 ? currentFps : state.fps * 0.9 + currentFps * 0.1

      yield* _(
        Ref.set(clockState, {
          ...state,
          lastFrameTime: currentTime,
          deltaTime: clampedDelta,
          frameCount: newFrameCount,
          fps: smoothedFps,
        }),
      )
    })

  const reset = (): Effect.Effect<void, never, never> =>
    Effect.gen(function* (_) {
      const currentTime = yield* _(now())
      yield* _(
        Ref.set(clockState, {
          startTime: currentTime,
          lastFrameTime: currentTime,
          deltaTime: 0,
          frameCount: 0,
          fps: 0,
          isPaused: false,
          timeScale: 1.0,
          pausedTime: 0,
        }),
      )
    })

  return BrowserClockAdapter.of({
    now,
    deltaTime,
    frameTime,
    fps,
    pause,
    resume,
    isPaused,
    setTimeScale,
    getTimeScale,
    tick,
    reset,
  })
})

/**
 * Clock utilities for common operations
 */
export const ClockUtils = {
  /**
   * Create a clock that automatically ticks on animation frames
   */
  createAnimationFrameClock: (adapter: IBrowserClockAdapter) => {
    const animationLoop = () =>
      Effect.gen(function* (_) {
        yield* _(adapter.tick())
        yield* _(Effect.sync(() => requestAnimationFrame(() => Effect.runSync(animationLoop()))))
      })

    return animationLoop
  },

  /**
   * Create a fixed timestep clock for consistent updates
   */
  createFixedTimestepClock: (adapter: IBrowserClockAdapter, targetFps: number = 60) => {
    const targetDelta = 1000 / targetFps
    let lastTime = 0

    const fixedLoop = () =>
      Effect.gen(function* (_) {
        const currentTime = performance.now()
        if (currentTime - lastTime >= targetDelta) {
          yield* _(adapter.tick())
          lastTime = currentTime
        }
        yield* _(Effect.sync(() => setTimeout(() => Effect.runSync(fixedLoop()), 1)))
      })

    return fixedLoop
  },
}
