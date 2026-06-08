import { describe, it } from '@effect/vitest'
import { GameLoopService,GameLoopServiceLive } from '@ts-minecraft/game'
import { Array as Arr,Effect,Fiber,MutableRef,Option,Ref } from 'effect'
import { afterEach,beforeEach,expect,vi } from 'vitest'

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
  Option.map(intervalCb, fn => fn())
}

// ---------------------------------------------------------------------------
// Test layer — GameLoopService has no external dependencies beyond globals.
// ---------------------------------------------------------------------------
const TestLayer = GameLoopServiceLive

// ---------------------------------------------------------------------------

describe('application/game-loop', () => {
  describe('Fiber lifecycle edge cases', () => {
    it.live('stop() after stop() is idempotent (no error on double stop)', () =>
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('start() after stop() works (restart with fresh layer)', () =>
      Effect.gen(function* () {
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

        const r1 = yield* firstRun
        const r2 = yield* secondRun

        expect(r1.stoppedCleanly).toBe(true)
        expect(r2.restartedCleanly).toBe(true)
      })
    )

    it.live('rAF fires after stop() does not call frame handler', () =>
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(TestLayer))
    )

    it.live('frame handler Fiber is interrupted when stop() is called', () =>
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(TestLayer))
    )

    it.live('pause() stops frame processing and resume() restarts it with stored handler', () =>
      Effect.gen(function* () {
        const service = yield* GameLoopService
        const callCountRef = yield* Ref.make(0)

        yield* service.start(() => Ref.update(callCountRef, (n) => n + 1))

        fireRaf(16)
        yield* Effect.sleep(10)
        const countBeforePause = yield* Ref.get(callCountRef)
        expect(countBeforePause).toBeGreaterThan(0)

        yield* service.pause()
        expect(yield* service.isRunning()).toBe(false)
        expect(Option.isNone(MutableRef.get(rafCallbackRef))).toBe(true)

        fireRaf(32)
        yield* Effect.sleep(10)
        expect(yield* Ref.get(callCountRef)).toBe(countBeforePause)

        yield* service.resume()
        yield* service.resume()
        expect(yield* service.isRunning()).toBe(true)

        fireRaf(48)
        yield* Effect.sleep(10)
        expect(yield* Ref.get(callCountRef)).toBeGreaterThan(countBeforePause)

        yield* service.stop()
      }).pipe(Effect.provide(TestLayer))
    )

    it.live('resume(handler) swaps in a new frame handler and restarts processing', () =>
      Effect.gen(function* () {
        const service = yield* GameLoopService
        const aCountRef = yield* Ref.make(0)
        const bCountRef = yield* Ref.make(0)

        yield* service.start(() => Ref.update(aCountRef, (n) => n + 1))
        fireRaf(16)
        yield* Effect.sleep(10)
        expect(yield* Ref.get(aCountRef)).toBeGreaterThan(0)

        yield* service.pause()

        // resume WITH an explicit handler replaces the stored one (covers the `if (frameHandler)` branch).
        yield* service.resume(() => Ref.update(bCountRef, (n) => n + 1))
        expect(yield* service.isRunning()).toBe(true)

        const aFramesAtResume = yield* Ref.get(aCountRef)
        fireRaf(32)
        yield* Effect.sleep(10)

        // The newly supplied handler runs; the original handler no longer advances.
        expect(yield* Ref.get(bCountRef)).toBeGreaterThan(0)
        expect(yield* Ref.get(aCountRef)).toBe(aFramesAtResume)

        yield* service.stop()
      }).pipe(Effect.provide(TestLayer))
    )

    it.live('Fiber.fork on an Effect that uses GameLoopService can be interrupted', () =>
      Effect.gen(function* () {
        const service = yield* GameLoopService
        const callCountRef = yield* Ref.make(0)

        yield* service.start(() =>
          Ref.update(callCountRef, (n) => n + 1)
        )

        // Fork a background task that fires rAF frames continuously
        const bgFiber = yield* Effect.fork(
          Effect.gen(function* () {
            yield* Effect.forEach(Arr.makeBy(5, i => i), (i) => Effect.gen(function* () {
              fireRaf(i * 16)
              yield* Effect.sleep(5)
            }), { concurrency: 1 })
          })
        )

        // Wait for background fiber to complete
        yield* Fiber.join(bgFiber)
        yield* Effect.sleep(20)

        const finalCount = yield* Ref.get(callCountRef)
        expect(finalCount).toBeGreaterThan(0)

        yield* service.stop()
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('scheduler branches', () => {
    it.live('uses requestAnimationFrame when available', () =>
      Effect.gen(function* () {
        const callCountRef = yield* Ref.make(0)
        const service = yield* GameLoopService

        yield* service.start(() => Ref.update(callCountRef, (n) => n + 1))

        expect(Option.isSome(MutableRef.get(rafCallbackRef))).toBe(true)
        expect(Option.isNone(MutableRef.get(intervalCallbackRef))).toBe(true)

        fireRaf(16)
        yield* Effect.sleep(10)

        expect(yield* Ref.get(callCountRef)).toBeGreaterThan(0)
        yield* service.stop()
      }).pipe(Effect.provide(TestLayer))
    )

    it.live('falls back to setInterval when requestAnimationFrame is unavailable', () =>
      Effect.gen(function* () {
        vi.unstubAllGlobals()
        MutableRef.set(rafCallbackRef, Option.none())
        MutableRef.set(intervalCallbackRef, Option.none())
        vi.stubGlobal('setInterval', (cb: () => void) => {
          MutableRef.set(intervalCallbackRef, Option.some(cb))
          return MutableRef.updateAndGet(intervalIdRef, n => n + 1)
        })
        vi.stubGlobal('clearInterval', (_id: number) => {
          MutableRef.set(intervalCallbackRef, Option.none())
        })

        const callCountRef = yield* Ref.make(0)
        const service = yield* GameLoopService

        yield* service.start(() => Ref.update(callCountRef, (n) => n + 1))

        expect(Option.isNone(MutableRef.get(rafCallbackRef))).toBe(true)
        expect(Option.isSome(MutableRef.get(intervalCallbackRef))).toBe(true)

        fireRaf(16)
        yield* Effect.sleep(10)

        expect(yield* Ref.get(callCountRef)).toBeGreaterThan(0)
        yield* service.stop()
      }).pipe(Effect.provide(TestLayer))
    )
  })
})
