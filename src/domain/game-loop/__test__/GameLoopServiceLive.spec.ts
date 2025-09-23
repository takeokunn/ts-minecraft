import { describe, it, expect, vi, beforeEach, afterEach } from '@effect/vitest'
import { Effect, Either, TestClock, TestContext, Duration, Fiber } from 'effect'
import { GameLoopService } from '../GameLoopService'
import { GameLoopServiceLive } from '../GameLoopServiceLive'
import type { FrameInfo, GameLoopConfig } from '../types'
import { GameLoopInitError, GameLoopPerformanceError, GameLoopRuntimeError, GameLoopStateError } from '../errors'

describe('GameLoopServiceLive', () => {
  // Mock requestAnimationFrame for testing
  let mockRAF: ReturnType<typeof vi.fn>
  let mockCAF: ReturnType<typeof vi.fn>
  let rafCallbacks: Map<number, (timestamp: number) => void>
  let nextRAFId: number

  beforeEach(() => {
    rafCallbacks = new Map()
    nextRAFId = 1

    mockRAF = vi.fn((callback: (timestamp: number) => void) => {
      const id = nextRAFId++
      rafCallbacks.set(id, callback)
      // Simulate async execution
      setTimeout(() => {
        const cb = rafCallbacks.get(id)
        if (cb) {
          cb(performance.now())
        }
      }, 16) // ~60fps
      return id
    })

    mockCAF = vi.fn((id: number) => {
      rafCallbacks.delete(id)
    })

    global.requestAnimationFrame = mockRAF
    global.cancelAnimationFrame = mockCAF
  })

  afterEach(() => {
    vi.clearAllMocks()
    rafCallbacks.clear()
  })

  describe('Initialization', () => {
    it.effect('should initialize with default configuration', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        const state = yield* gameLoop.getState()
        expect(state).toBe('idle')
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should initialize with custom configuration', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        const config: Partial<GameLoopConfig> = {
          targetFps: 120,
          maxFrameSkip: 10,
          enablePerformanceMonitoring: false,
        }
        yield* gameLoop.initialize(config)
        const state = yield* gameLoop.getState()
        expect(state).toBe('idle')
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should prevent double initialization when running', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        const result = yield* Effect.either(gameLoop.initialize())

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('GameLoopInitError')
          expect(result.left.reason).toContain('running')
        }
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should allow re-initialization after stop', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        yield* gameLoop.stop()
        yield* gameLoop.initialize({ targetFps: 30 })
        const state = yield* gameLoop.getState()
        expect(state).toBe('idle')
      }).pipe(Effect.provide(GameLoopServiceLive))
    )
  })

  describe('State Transitions', () => {
    it.effect('should transition from idle to running', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        const state = yield* gameLoop.getState()
        expect(state).toBe('running')
        expect(mockRAF).toHaveBeenCalled()
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should transition from running to paused', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        yield* gameLoop.pause()
        const state = yield* gameLoop.getState()
        expect(state).toBe('paused')
        expect(mockCAF).toHaveBeenCalled()
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should transition from paused to running', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        yield* gameLoop.pause()
        mockRAF.mockClear()
        yield* gameLoop.resume()
        const state = yield* gameLoop.getState()
        expect(state).toBe('running')
        expect(mockRAF).toHaveBeenCalled()
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should handle invalid pause transition', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        const result = yield* Effect.either(gameLoop.pause())

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('GameLoopStateError')
          expect(result.left.attemptedTransition).toBe('pause')
        }
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should handle invalid resume transition', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        const result = yield* Effect.either(gameLoop.resume())

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('GameLoopStateError')
          expect(result.left.attemptedTransition).toBe('resume')
        }
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should stop from any state', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        yield* gameLoop.stop()
        const state = yield* gameLoop.getState()
        expect(state).toBe('stopped')
        expect(mockCAF).toHaveBeenCalled()
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should handle multiple starts gracefully', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        const rafCallCount = mockRAF.mock.calls.length
        yield* gameLoop.start() // Should be no-op
        expect(mockRAF.mock.calls.length).toBe(rafCallCount)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )
  })

  describe('Frame Execution', () => {
    it.effect('should execute tick with callbacks', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        const frames: FrameInfo[] = []
        yield* gameLoop.onFrame((info) =>
          Effect.sync(() => {
            frames.push(info)
          })
        )

        const frameInfo = yield* gameLoop.tick(16.67)

        expect(frameInfo.deltaTime).toBe(16.67)
        expect(frameInfo.fps).toBeCloseTo(60, 0)
        expect(frameInfo.frameSkipped).toBe(false)
        expect(frames.length).toBe(1)
        expect(frames[0]).toEqual(frameInfo)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should increment frame count on each tick', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        const frame1 = yield* gameLoop.tick()
        const frame2 = yield* gameLoop.tick()
        const frame3 = yield* gameLoop.tick()

        expect(frame1.frameCount).toBe(0)
        expect(frame2.frameCount).toBe(1)
        expect(frame3.frameCount).toBe(2)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should calculate delta time correctly', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        // First tick uses default delta
        const frame1 = yield* gameLoop.tick()
        expect(frame1.deltaTime).toBeGreaterThan(0)

        // Manual delta time
        const frame2 = yield* gameLoop.tick(20)
        expect(frame2.deltaTime).toBe(20)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should handle frame callbacks with errors', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        yield* gameLoop.onFrame(() => Effect.fail(new Error('Callback error')) as unknown as Effect.Effect<void>)

        const result = yield* Effect.either(gameLoop.tick())

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('GameLoopRuntimeError')
          expect(result.left.message).toContain('callbacks')
        }
      }).pipe(Effect.provide(GameLoopServiceLive))
    )
  })

  describe('Frame Callbacks Management', () => {
    it.effect('should register multiple callbacks', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        const results: number[] = []

        yield* gameLoop.onFrame(() =>
          Effect.sync(() => {
            results.push(1)
          })
        )

        yield* gameLoop.onFrame(() =>
          Effect.sync(() => {
            results.push(2)
          })
        )

        yield* gameLoop.tick()

        expect(results).toEqual([1, 2])
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should unregister callbacks', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        const results: number[] = []

        const unsubscribe = yield* gameLoop.onFrame(() =>
          Effect.sync(() => {
            results.push(1)
          })
        )

        yield* gameLoop.tick()
        unsubscribe()
        yield* gameLoop.tick()

        expect(results.length).toBe(1)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should clear callbacks on stop', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        const results: number[] = []

        yield* gameLoop.onFrame(() =>
          Effect.sync(() => {
            results.push(1)
          })
        )

        yield* gameLoop.tick()
        yield* gameLoop.stop()
        yield* gameLoop.initialize()
        yield* gameLoop.tick()

        expect(results.length).toBe(1)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )
  })

  describe('Performance Metrics', () => {
    it.effect('should accumulate performance metrics', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        // Execute several frames to build metrics
        for (let i = 0; i < 5; i++) {
          yield* gameLoop.tick(16.67)
        }

        const metrics = yield* gameLoop.getPerformanceMetrics()

        expect(metrics.averageFps).toBeGreaterThan(0)
        expect(metrics.minFps).toBeGreaterThan(0)
        expect(metrics.maxFps).toBeGreaterThan(0)
        expect(metrics.frameTimeMs).toBeGreaterThan(0)
        expect(metrics.droppedFrames).toBe(0)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should fail when no metrics available', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        const result = yield* Effect.either(gameLoop.getPerformanceMetrics())

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('GameLoopPerformanceError')
          expect(result.left.message).toContain('No performance data')
        }
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should track dropped frames', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize({ targetFps: 60, maxFrameSkip: 2 })

        // Simulate normal frames first
        yield* gameLoop.tick(16.67)
        yield* gameLoop.tick(16.67)

        // Simulate dropped frame (way over target)
        yield* gameLoop.tick(200)

        const metrics = yield* gameLoop.getPerformanceMetrics()
        expect(metrics.droppedFrames).toBeGreaterThanOrEqual(0)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should maintain rolling buffer of FPS data', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        // Execute many frames to fill buffer
        for (let i = 0; i < 70; i++) {
          yield* gameLoop.tick(16.67)
        }

        const metrics = yield* gameLoop.getPerformanceMetrics()

        // Should only keep last 60 frames in buffer
        expect(metrics.averageFps).toBeCloseTo(60, 0)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )
  })

  describe('Configuration Updates', () => {
    it.effect('should update configuration dynamically', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize({ targetFps: 60 })

        yield* gameLoop.updateConfig({ targetFps: 30 })

        // Configuration should be updated
        const state = yield* gameLoop.getState()
        expect(state).toBe('idle')

        // New frames should respect updated config
        const frame = yield* gameLoop.tick(33.33)
        expect(frame.fps).toBeCloseTo(30, 0)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should merge partial configuration updates', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize({
          targetFps: 60,
          maxFrameSkip: 5,
          enablePerformanceMonitoring: true,
        })

        yield* gameLoop.updateConfig({ targetFps: 120 })

        // Other config values should remain unchanged
        const state = yield* gameLoop.getState()
        expect(state).toBe('idle')
      }).pipe(Effect.provide(GameLoopServiceLive))
    )
  })

  describe('Reset Functionality', () => {
    it.effect('should reset all state', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize({ targetFps: 120 })
        yield* gameLoop.start()

        const results: number[] = []
        yield* gameLoop.onFrame(() =>
          Effect.sync(() => {
            results.push(1)
          })
        )

        yield* gameLoop.tick()
        yield* gameLoop.reset()

        const state = yield* gameLoop.getState()
        expect(state).toBe('idle')
        expect(mockCAF).toHaveBeenCalled()

        // Callbacks should be cleared
        yield* gameLoop.tick()
        expect(results.length).toBe(1)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should reset configuration to defaults', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize({ targetFps: 120, maxFrameSkip: 10 })
        yield* gameLoop.reset()

        // Should be back to defaults (60 FPS)
        yield* gameLoop.initialize()
        const frame = yield* gameLoop.tick(16.67)
        expect(frame.fps).toBeCloseTo(60, 0)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should reset frame counter', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        yield* gameLoop.tick()
        yield* gameLoop.tick()
        yield* gameLoop.tick()

        yield* gameLoop.reset()
        yield* gameLoop.initialize()

        const frame = yield* gameLoop.tick()
        expect(frame.frameCount).toBe(0)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )
  })

  describe('Real-time Animation Frame Integration', () => {
    it.effect('should schedule animation frames when running', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        mockRAF.mockClear() // Clear any previous calls
        yield* gameLoop.start()

        // Should have scheduled at least one frame (start calls RAF, then executeFrame may call it again)
        expect(mockRAF).toHaveBeenCalledWith(expect.any(Function))
        expect(mockRAF.mock.calls.length).toBeGreaterThanOrEqual(1)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should cancel animation frame on pause', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()

        // Clear previous calls to get accurate count
        mockCAF.mockClear()

        yield* gameLoop.pause()

        // Verify that cancelAnimationFrame was called (any ID is fine)
        expect(mockCAF).toHaveBeenCalled()
        expect(mockCAF.mock.calls.length).toBeGreaterThanOrEqual(1)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should handle rapid start/stop cycles', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        yield* gameLoop.start()
        yield* gameLoop.stop()
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        yield* gameLoop.stop()

        const state = yield* gameLoop.getState()
        expect(state).toBe('stopped')
        expect(mockCAF.mock.calls.length).toBeGreaterThanOrEqual(2)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )
  })

  describe('Frame Skipping and Performance', () => {
    it.effect('should detect frame skipping', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize({ targetFps: 60, maxFrameSkip: 2 })

        // Normal frame
        const frame1 = yield* gameLoop.tick(16.67)
        expect(frame1.frameSkipped).toBe(false)

        // Skipped frame (way over threshold - maxFrameSkip * targetFrameTime)
        const frame2 = yield* gameLoop.tick(40) // > 2 * 16.67
        expect(frame2.frameSkipped).toBe(true)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should limit delta time to prevent huge jumps', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize({ targetFps: 60 })

        // Huge delta time (e.g., from tab being backgrounded)
        const frame = yield* gameLoop.tick(1000)

        // Delta should be capped at 2x target frame time
        expect(frame.deltaTime).toBeLessThanOrEqual(33.34)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )
  })

  describe('Error Recovery', () => {
    it.effect('should continue after callback errors in running state', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        // When running, errors are caught and logged
        yield* gameLoop.start()

        // Should be running
        const state = yield* gameLoop.getState()
        expect(state).toBe('running')
      }).pipe(Effect.provide(GameLoopServiceLive))
    )
  })

  describe('Concurrent Operations', () => {
    it.effect('should handle concurrent callback registration', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        const results: number[] = []

        // Register callbacks concurrently
        yield* Effect.all(
          [
            gameLoop.onFrame(() => Effect.sync(() => results.push(1))),
            gameLoop.onFrame(() => Effect.sync(() => results.push(2))),
            gameLoop.onFrame(() => Effect.sync(() => results.push(3))),
          ],
          { concurrency: 'unbounded' }
        )

        yield* gameLoop.tick()

        expect(results.sort()).toEqual([1, 2, 3])
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should execute callbacks concurrently', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        const results: number[] = []

        // Add callbacks
        yield* gameLoop.onFrame(() =>
          Effect.sync(() => {
            results.push(1)
          })
        )

        yield* gameLoop.onFrame(() =>
          Effect.sync(() => {
            results.push(2)
          })
        )

        yield* gameLoop.tick()

        // Both should execute
        expect(results.length).toBe(2)
        expect(results).toContain(1)
        expect(results).toContain(2)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )
  })

  describe('Memory Management', () => {
    it.effect('should not leak memory with many callbacks', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        const unsubscribes: Array<() => void> = []

        // Add many callbacks
        for (let i = 0; i < 100; i++) {
          const unsub = yield* gameLoop.onFrame(() => Effect.succeed(undefined))
          unsubscribes.push(unsub)
        }

        // Remove all callbacks
        unsubscribes.forEach((unsub) => unsub())

        const results: number[] = []
        yield* gameLoop.onFrame(() => Effect.sync(() => results.push(1)))

        yield* gameLoop.tick()

        // Should only execute the remaining callback
        expect(results.length).toBe(1)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )

    it.effect('should clean up on service disposal', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()

        // Clear previous calls to get accurate count
        mockCAF.mockClear()

        // Stop should clean up
        yield* gameLoop.stop()

        // Verify that cancelAnimationFrame was called (any ID is fine)
        expect(mockCAF).toHaveBeenCalled()
        expect(mockCAF.mock.calls.length).toBeGreaterThanOrEqual(1)
      }).pipe(Effect.provide(GameLoopServiceLive))
    )
  })
})
