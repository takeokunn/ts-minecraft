import { describe, it } from '@effect/vitest'
import { expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, Either, MutableRef, Option, Ref } from 'effect'
import { GameLoopService } from '@ts-minecraft/game'

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
// Test layer — GameLoopService has no external dependencies beyond globals.
// ---------------------------------------------------------------------------
const TestLayer = GameLoopService.Default

// ---------------------------------------------------------------------------

describe('application/game-loop', () => {
  describe('maintenance loop', () => {
    it.live('startMaintenance runs the maintenance handler until stop is called', () =>
      Effect.gen(function* () {
        const service = yield* GameLoopService
        const callCountRef = yield* Ref.make(0)

        yield* service.start(() => Effect.void)
        yield* service.startMaintenance(() =>
          Effect.gen(function* () {
            yield* Ref.update(callCountRef, (n) => n + 1)
            return true
          })
        )

        yield* Effect.sleep(60)
        const countBeforeStop = yield* Ref.get(callCountRef)
        expect(countBeforeStop).toBeGreaterThan(0)

        yield* service.stop()
        yield* Effect.sleep(60)

        const countAfterStop = yield* Ref.get(callCountRef)
        expect(countAfterStop).toBe(countBeforeStop)
      }).pipe(Effect.provide(TestLayer))
    )

    // The observed ">15s zombie": a stale maintenance loop kept running while
    // Fiber.interruptFork waited on a deep suspension inside one heavy
    // iteration. The generation gate bounds a stale loop to ONE iteration —
    // the loop must stop cooperatively even if interruption never lands.
    it.live('a superseded maintenance loop exits at its next iteration boundary (generation gate)', () =>
      Effect.gen(function* () {
        const service = yield* GameLoopService
        const firstCalls = yield* Ref.make(0)
        const secondCalls = yield* Ref.make(0)

        yield* service.startMaintenance(() =>
          Ref.update(firstCalls, (n) => n + 1).pipe(Effect.as(true)),
        )
        yield* Effect.sleep(40)
        // Restart (new world): the OLD loop must stop within one iteration.
        yield* service.startMaintenance(() =>
          Ref.update(secondCalls, (n) => n + 1).pipe(Effect.as(true)),
        )
        yield* Effect.sleep(50)
        const firstAfterRestart = yield* Ref.get(firstCalls)
        yield* Effect.sleep(60)
        expect(yield* Ref.get(firstCalls)).toBe(firstAfterRestart) // old loop is dead
        expect(yield* Ref.get(secondCalls)).toBeGreaterThan(0) // new loop lives

        yield* service.stop()
        yield* Effect.sleep(50)
        const secondAfterStop = yield* Ref.get(secondCalls)
        yield* Effect.sleep(60)
        expect(yield* Ref.get(secondCalls)).toBe(secondAfterStop) // stop() gates too
      }).pipe(Effect.provide(TestLayer))
    )

    // Re-entrant by design: the service is an app-scoped singleton reused across
    // worlds, its maintenance fiber is a daemon that survives session teardown,
    // and a best-effort quit stop() can be interrupted by its timeout before it
    // clears the fiber ref. A second startMaintenance must interrupt the prior
    // fiber and start fresh (not fail "already running"), so the next world runs.
    it.effect('startMaintenance is re-entrant: a second call restarts cleanly', () =>
      Effect.gen(function* () {
        const service = yield* GameLoopService

        yield* service.startMaintenance(() => Effect.succeed(false))
        const result = yield* Effect.either(service.startMaintenance(() => Effect.succeed(false)))

        expect(Either.isRight(result)).toBe(true)

        yield* service.stop()
      }).pipe(Effect.provide(TestLayer))
    )
  })
})
