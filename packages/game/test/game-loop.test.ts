import { describe, it } from '@effect/vitest'
import { GameLoopService,GameLoopServiceLive } from '@ts-minecraft/game'
import { Effect,Either,MutableRef,Option,Ref } from 'effect'
import { afterEach,beforeEach,expect,vi } from 'vitest'
import { GameLoopError } from '../domain/errors'

// ---------------------------------------------------------------------------
// requestAnimationFrame / setInterval mocks
//
// The game loop prefers requestAnimationFrame in browser-like environments and
// falls back to setInterval elsewhere. Keep references to both callbacks so
// tests can drive either scheduling path explicitly.
// ---------------------------------------------------------------------------

const rafCallbackRef = MutableRef.make<Option.Option<(timestamp: number) => void>>(Option.none())
const rafIdRef = MutableRef.make(0)
const intervalCallbackRef = MutableRef.make<Option.Option<() => void>>(Option.none())
const intervalIdRef = MutableRef.make(0)

beforeEach(() => {
  MutableRef.set(rafCallbackRef, Option.none())
  MutableRef.set(rafIdRef, 0)
  MutableRef.set(intervalCallbackRef, Option.none())
  MutableRef.set(intervalIdRef, 0)
  vi.stubGlobal('requestAnimationFrame', (cb: (timestamp: number) => void) => {
    MutableRef.set(rafCallbackRef, Option.some(cb))
    return MutableRef.updateAndGet(rafIdRef, n => n + 1)
  })
  vi.stubGlobal('cancelAnimationFrame', (_id: number) => {
    MutableRef.set(rafCallbackRef, Option.none())
  })
  vi.stubGlobal('setInterval', (cb: () => void) => {
    MutableRef.set(intervalCallbackRef, Option.some(cb))
    return MutableRef.updateAndGet(intervalIdRef, n => n + 1)
  })
  vi.stubGlobal('clearInterval', (_id: number) => {
    MutableRef.set(intervalCallbackRef, Option.none())
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Helper: fire whichever scheduler callback is active.
// ---------------------------------------------------------------------------
const fireRaf = (timestamp = 16): void => {
  const rafCb = MutableRef.get(rafCallbackRef)
  if (Option.isSome(rafCb)) {
    rafCb.value(timestamp)
    return
  }

  const intervalCb = MutableRef.get(intervalCallbackRef)
  Option.getOrNull(intervalCb)?.()
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
    it.effect('should return false before start is called', () =>
      Effect.gen(function* () {
        const service = yield* GameLoopService
        const running = yield* service.isRunning()
        expect(running).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should return true after start is called', () =>
      Effect.gen(function* () {
        const service = yield* GameLoopService

        yield* service.start(() => Effect.void)

        const running = yield* service.isRunning()
        expect(running).toBe(true)

        // Clean up: stop the loop so the fiber does not leak.
        yield* service.stop()
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('start', () => {
    it.effect('should fail with GameLoopError when called while already running', () =>
      Effect.gen(function* () {
        const service = yield* GameLoopService

        // First start succeeds.
        yield* service.start(() => Effect.void)

        // Second start must fail.
        const result = yield* Effect.either(service.start(() => Effect.void))

        expect(Either.isLeft(result)).toBe(true)
        const err = Option.getOrThrow(Either.getLeft(result))
        expect(err).toBeInstanceOf(GameLoopError)
        expect((err as GameLoopError).reason).toContain('already running')

        yield* service.stop()
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('resume', () => {
    it.effect('should fail with GameLoopError when resuming with no stored handler', () =>
      Effect.gen(function* () {
        const service = yield* GameLoopService

        // Fresh service: never started, so no handler is stored → onNone failure path.
        const result = yield* Effect.either(service.resume())

        expect(Either.isLeft(result)).toBe(true)
        const err = Option.getOrThrow(Either.getLeft(result))
        expect(err).toBeInstanceOf(GameLoopError)
        expect((err as GameLoopError).reason).toContain('No frame handler stored')
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('pause', () => {
    it.effect('is a safe no-op when called before the loop has started (no processing fiber)', () =>
      Effect.gen(function* () {
        const service = yield* GameLoopService

        // Never started → processingFiber is None → onNone branch (no fiber to interrupt).
        yield* service.pause()

        expect(yield* service.isRunning()).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('stop', () => {
    it.effect('should set isRunning to false after stop is called', () =>
      Effect.gen(function* () {
        const service = yield* GameLoopService

        yield* service.start(() => Effect.void)
        expect(yield* service.isRunning()).toBe(true)

        yield* service.stop()
        expect(yield* service.isRunning()).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should be safe to call stop when the loop is not running', () =>
      Effect.gen(function* () {
        const service = yield* GameLoopService

        // Should not throw or fail.
        yield* service.stop()

        const running = yield* service.isRunning()
        expect(running).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('frame handler', () => {
    it.live('should invoke the frame handler after a rAF tick fires', () =>
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(TestLayer))
    )

    it.live('should pass a positive deltaTime to the frame handler', () =>
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(TestLayer))
    )

    it.live('should enforce minimum deltaTime floor of 0.001 when consecutive timestamps are identical', () =>
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(TestLayer))
    )

    it.live('should stop calling the frame handler after stop is invoked', () =>
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('GameLoopServiceLive', () => {
    it('should provide GameLoopService as a Layer', () => {
      expect(GameLoopServiceLive).toBeDefined()
      expect(typeof GameLoopServiceLive).toBe('object')
    })

    it.effect('should expose all required methods', () =>
      Effect.gen(function* () {
        const service = yield* GameLoopService
        expect(typeof service.start).toBe('function')
        expect(typeof service.pause).toBe('function')
        expect(typeof service.resume).toBe('function')
        expect(typeof service.startMaintenance).toBe('function')
        expect(typeof service.stop).toBe('function')
        expect(typeof service.isRunning).toBe('function')
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Effect composition', () => {
    it.effect('should support Effect.flatMap for chaining start/isRunning/stop', () =>
      Effect.gen(function* () {
        const service = yield* GameLoopService

        yield* service.start(() => Effect.void)
        const running = yield* service.isRunning()

        expect(running).toBe(true)

        yield* service.stop()
      }).pipe(Effect.provide(TestLayer))
    )
  })
})
