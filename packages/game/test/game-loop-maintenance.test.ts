import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Either, MutableRef, Option, Ref } from 'effect'
import { GameLoopService, GameLoopServiceLive } from '@ts-minecraft/game'
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
  Option.map(intervalCb, fn => fn())
}

// ---------------------------------------------------------------------------
// Test layer — GameLoopService has no external dependencies beyond globals.
// ---------------------------------------------------------------------------
const TestLayer = GameLoopServiceLive

// ---------------------------------------------------------------------------

describe('application/game-loop', () => {
  describe('maintenance loop', () => {
    it.live('startMaintenance runs the maintenance handler until stop is called', () =>
      Effect.gen(function* () {
        const service = yield* GameLoopService
        const callCountRef = yield* Ref.make(0)

        yield* service.start(() => Effect.void)
        yield* service.startMaintenance(() =>
          Ref.update(callCountRef, (n) => n + 1).pipe(Effect.as(true))
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

    it.effect('startMaintenance fails when called twice without stop', () =>
      Effect.gen(function* () {
        const service = yield* GameLoopService

        yield* service.startMaintenance(() => Effect.succeed(false))
        const result = yield* Effect.either(service.startMaintenance(() => Effect.succeed(false)))

        expect(Either.isLeft(result)).toBe(true)
        const err = Option.getOrThrow(Either.getLeft(result))
        expect(err).toBeInstanceOf(GameLoopError)
        expect((err as GameLoopError).reason).toContain('Maintenance loop is already running')

        yield* service.stop()
      }).pipe(Effect.provide(TestLayer))
    )
  })
})
