import { describe, it } from '@effect/vitest'
import { expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, Either, MutableRef, Option, Ref } from 'effect'
import { GameLoopService } from '@ts-minecraft/game'
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
