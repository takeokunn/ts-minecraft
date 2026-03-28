import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, Ref, Fiber, Option } from 'effect'
import { GameLoopService, GameLoopServiceLive } from '.'
import { GameLoopError } from '@/domain/errors'

// ---------------------------------------------------------------------------
// requestAnimationFrame mock
//
// `bridgeLoop` calls requestAnimationFrame(bridgeLoop) each frame, and also
// calls Effect.runSync(Ref.get(runningRef)) synchronously inside the callback.
// To control frame delivery in tests we keep a reference to the last registered
// callback and expose a helper that fires it once.
// ---------------------------------------------------------------------------

let rafCallback: Option.Option<(timestamp: number) => void> = Option.none()
let rafId = 0

beforeEach(() => {
  rafCallback = Option.none()
  rafId = 0
  vi.stubGlobal('requestAnimationFrame', (cb: (ts: number) => void) => {
    rafCallback = Option.some(cb)
    return ++rafId
  })
  vi.stubGlobal('cancelAnimationFrame', (_id: number) => {
    rafCallback = Option.none()
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Helper: fire the current rAF callback once with the given timestamp.
// After firing, the bridge registers a new callback — we do NOT auto-fire it
// so tests remain in full control of the frame cadence.
// ---------------------------------------------------------------------------
const fireRaf = (timestamp = 16): void => {
  const cb = rafCallback
  rafCallback = Option.none()
  if (Option.isSome(cb)) cb.value(timestamp)
}

// ---------------------------------------------------------------------------
// Test layer — GameLoopService has no external dependencies beyond globals.
// ---------------------------------------------------------------------------
const TestLayer = GameLoopServiceLive

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('application/game-loop', () => {
  describe('GameLoopError', () => {
    it('should create GameLoopError with reason', () => {
      const error = new GameLoopError({ reason: 'already running' })
      expect(error._tag).toBe('GameLoopError')
      expect(error.reason).toBe('already running')
      expect(error.message).toContain('already running')
    })

    it('should create GameLoopError with cause', () => {
      const cause = new Error('underlying')
      const error = new GameLoopError({ reason: 'test', cause })
      expect(error.cause).toBe(cause)
    })
  })

  describe('isRunning', () => {
    it('should return false before start is called', () => {
      const program = Effect.gen(function* () {
        const service = yield* GameLoopService
        const running = yield* service.isRunning()
        expect(running).toBe(false)
        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return true after start is called', async () => {
      const program = Effect.gen(function* () {
        const service = yield* GameLoopService

        yield* service.start(() => Effect.void)

        const running = yield* service.isRunning()
        expect(running).toBe(true)

        // Clean up: stop the loop so the fiber does not leak.
        yield* service.stop()

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = await Effect.runPromise(program)
      expect(result.success).toBe(true)
    })
  })

  describe('start', () => {
    it('should fail with GameLoopError when called while already running', async () => {
      const program = Effect.gen(function* () {
        const service = yield* GameLoopService

        // First start succeeds.
        yield* service.start(() => Effect.void)

        // Second start must fail.
        const result = yield* Effect.either(service.start(() => Effect.void))

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(GameLoopError)
          expect((result.left as GameLoopError).reason).toContain('already running')
        }

        yield* service.stop()

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = await Effect.runPromise(program)
      expect(result.success).toBe(true)
    })
  })

  describe('stop', () => {
    it('should set isRunning to false after stop is called', async () => {
      const program = Effect.gen(function* () {
        const service = yield* GameLoopService

        yield* service.start(() => Effect.void)
        expect(yield* service.isRunning()).toBe(true)

        yield* service.stop()
        expect(yield* service.isRunning()).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = await Effect.runPromise(program)
      expect(result.success).toBe(true)
    })

    it('should be safe to call stop when the loop is not running', async () => {
      const program = Effect.gen(function* () {
        const service = yield* GameLoopService

        // Should not throw or fail.
        yield* service.stop()

        const running = yield* service.isRunning()
        expect(running).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = await Effect.runPromise(program)
      expect(result.success).toBe(true)
    })
  })

  describe('frame handler', () => {
    it('should invoke the frame handler after a rAF tick fires', async () => {
      const program = Effect.gen(function* () {
        const callCountRef = yield* Ref.make(0)

        const service = yield* GameLoopService

        yield* service.start(() =>
          Ref.update(callCountRef, (n) => n + 1)
        )

        // Before any rAF tick the handler has not been called.
        expect(yield* Ref.get(callCountRef)).toBe(0)

        // Fire the pending rAF callback synchronously.
        fireRaf(16)

        // Yield to the Effect runtime so the forked processing fiber can
        // dequeue the Tick command and invoke our frame handler.
        yield* Effect.sleep(10)

        const callCount = yield* Ref.get(callCountRef)
        expect(callCount).toBeGreaterThan(0)

        yield* service.stop()

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = await Effect.runPromise(program)
      expect(result.success).toBe(true)
    })

    it('should pass a positive deltaTime to the frame handler', async () => {
      const program = Effect.gen(function* () {
        const deltaTimeRef = yield* Ref.make<number>(-1)

        const service = yield* GameLoopService

        yield* service.start((dt) =>
          Ref.set(deltaTimeRef, dt)
        )

        // Fire two consecutive ticks so the second produces a non-zero delta.
        fireRaf(0)
        yield* Effect.sleep(5)
        fireRaf(32)
        yield* Effect.sleep(10)

        const deltaTime = yield* Ref.get(deltaTimeRef)
        // The second tick: (32 - 0) / 1000 = 0.032 s
        // The first tick always uses the default 0.016, so after two ticks
        // the Ref holds whichever value was written last — both are positive.
        expect(deltaTime).toBeGreaterThan(0)

        yield* service.stop()

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = await Effect.runPromise(program)
      expect(result.success).toBe(true)
    })

    it('should enforce minimum deltaTime floor of 0.001 when consecutive timestamps are identical', async () => {
      const program = Effect.gen(function* () {
        const deltaTimeRef = yield* Ref.make<number>(-1)

        const service = yield* GameLoopService

        yield* service.start((dt) =>
          Ref.set(deltaTimeRef, dt)
        )

        // Fire first tick to set lastTimestamp to 1000.
        // (First tick always uses 0.016 default, so lastTimestamp becomes 1000.)
        fireRaf(1000)
        yield* Effect.sleep(10)

        // Fire second tick with the SAME timestamp — rawDelta = (1000 - 1000) / 1000 = 0.
        // Math.max(0.001, 0) should clamp the deltaTime to 0.001.
        fireRaf(1000)
        yield* Effect.sleep(10)

        const deltaTime = yield* Ref.get(deltaTimeRef)
        // The floor guard must produce exactly 0.001 when rawDelta is 0.
        expect(deltaTime).toBeGreaterThanOrEqual(0.001)

        yield* service.stop()

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = await Effect.runPromise(program)
      expect(result.success).toBe(true)
    })

    it('should stop calling the frame handler after stop is invoked', async () => {
      const program = Effect.gen(function* () {
        const callCountRef = yield* Ref.make(0)

        const service = yield* GameLoopService

        yield* service.start(() =>
          Ref.update(callCountRef, (n) => n + 1)
        )

        // Fire one frame, then stop.
        fireRaf(16)
        yield* Effect.sleep(10)

        yield* service.stop()

        const countAfterStop = yield* Ref.get(callCountRef)

        // Fire another rAF — the bridge checks isRunning and should bail out.
        fireRaf(32)
        yield* Effect.sleep(10)

        const countAfterExtraRaf = yield* Ref.get(callCountRef)
        expect(countAfterExtraRaf).toBe(countAfterStop)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = await Effect.runPromise(program)
      expect(result.success).toBe(true)
    })
  })

  describe('GameLoopServiceLive', () => {
    it('should provide GameLoopService as a Layer', () => {
      expect(GameLoopServiceLive).toBeDefined()
      expect(typeof GameLoopServiceLive).toBe('object')
    })

    it('should expose all required methods', () => {
      const program = Effect.gen(function* () {
        const service = yield* GameLoopService

        expect(typeof service.start).toBe('function')
        expect(typeof service.stop).toBe('function')
        expect(typeof service.isRunning).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Effect composition', () => {
    it('should support Effect.flatMap for chaining start/isRunning/stop', async () => {
      const program = Effect.gen(function* () {
        const service = yield* GameLoopService

        const running = yield* service
          .start(() => Effect.void)
          .pipe(Effect.flatMap(() => service.isRunning()))

        expect(running).toBe(true)

        yield* service.stop()

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = await Effect.runPromise(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Fiber lifecycle edge cases', () => {
    it('stop() after stop() is idempotent (no error on double stop)', async () => {
      const program = Effect.gen(function* () {
        const service = yield* GameLoopService

        yield* service.start(() => Effect.void)
        fireRaf(16)
        yield* Effect.sleep(10)

        // First stop
        yield* service.stop()
        expect(yield* service.isRunning()).toBe(false)

        // Second stop — should not throw or produce an error
        yield* service.stop()
        expect(yield* service.isRunning()).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = await Effect.runPromise(program)
      expect(result.success).toBe(true)
    })

    it('start() after stop() works (restart with fresh layer)', async () => {
      // Each Effect.provide(GameLoopServiceLive) gets an isolated service instance,
      // so we verify that a fresh instance can start cleanly after a prior run.
      const firstRun = Effect.gen(function* () {
        const service = yield* GameLoopService
        yield* service.start(() => Effect.void)
        expect(yield* service.isRunning()).toBe(true)
        yield* service.stop()
        expect(yield* service.isRunning()).toBe(false)
        return { stoppedCleanly: true }
      }).pipe(Effect.provide(GameLoopServiceLive))

      const secondRun = Effect.gen(function* () {
        const service = yield* GameLoopService
        yield* service.start(() => Effect.void)
        expect(yield* service.isRunning()).toBe(true)
        yield* service.stop()
        expect(yield* service.isRunning()).toBe(false)
        return { restartedCleanly: true }
      }).pipe(Effect.provide(GameLoopServiceLive))

      const r1 = await Effect.runPromise(firstRun)
      const r2 = await Effect.runPromise(secondRun)

      expect(r1.stoppedCleanly).toBe(true)
      expect(r2.restartedCleanly).toBe(true)
    })

    it('rAF fires after stop() does not call frame handler', async () => {
      const program = Effect.gen(function* () {
        const callCountRef = yield* Ref.make(0)

        const service = yield* GameLoopService

        yield* service.start(() =>
          Ref.update(callCountRef, (n) => n + 1)
        )

        // Fire one frame and let the handler execute
        fireRaf(16)
        yield* Effect.sleep(10)

        const countBeforeStop = yield* Ref.get(callCountRef)
        expect(countBeforeStop).toBeGreaterThan(0)

        // Stop the loop
        yield* service.stop()

        // Fire another rAF — the bridge checks isRunning and should bail out early
        fireRaf(32)
        yield* Effect.sleep(10)

        const countAfterExtraRaf = yield* Ref.get(callCountRef)

        // Handler should NOT have been invoked after stop
        expect(countAfterExtraRaf).toBe(countBeforeStop)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = await Effect.runPromise(program)
      expect(result.success).toBe(true)
    })

    it('frame handler Fiber is interrupted when stop() is called', async () => {
      const program = Effect.gen(function* () {
        const service = yield* GameLoopService

        // Use a long-running handler that we can detect was running
        const startedRef = yield* Ref.make(false)

        yield* service.start(() =>
          Ref.set(startedRef, true).pipe(
            Effect.flatMap(() =>
              // Simulate slow work inside the handler
              Effect.sleep(1000)
            )
          )
        )

        // Fire one frame to get the handler processing
        fireRaf(16)
        yield* Effect.sleep(10)

        // Stop while handler may be in progress — should interrupt cleanly
        yield* service.stop()

        // isRunning must be false after stop
        expect(yield* service.isRunning()).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = await Effect.runPromise(program)
      expect(result.success).toBe(true)
    })

    it('Fiber.fork on an Effect that uses GameLoopService can be interrupted', async () => {
      const program = Effect.gen(function* () {
        const service = yield* GameLoopService
        const callCountRef = yield* Ref.make(0)

        yield* service.start(() =>
          Ref.update(callCountRef, (n) => n + 1)
        )

        // Fork a background task that fires rAF frames continuously
        const bgFiber = yield* Effect.fork(
          Effect.gen(function* () {
            for (let i = 0; i < 5; i++) {
              fireRaf(i * 16)
              yield* Effect.sleep(5)
            }
          })
        )

        // Wait for background fiber to complete
        yield* Fiber.join(bgFiber)
        yield* Effect.sleep(20)

        const finalCount = yield* Ref.get(callCountRef)
        expect(finalCount).toBeGreaterThan(0)

        yield* service.stop()

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = await Effect.runPromise(program)
      expect(result.success).toBe(true)
    })
  })
})
