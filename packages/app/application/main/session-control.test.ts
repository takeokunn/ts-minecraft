import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Deferred, Effect, MutableRef } from 'effect'
import {
  createSessionControl,
  requestQuitToTitle,
  setPaused,
  isPaused,
} from '@ts-minecraft/app/main/session-control'

describe('session-control', () => {
  describe('createSessionControl', () => {
    it.effect('returns a SessionControl with isPausedRef initially false', () =>
      Effect.gen(function* () {
        const control = yield* createSessionControl
        expect(MutableRef.get(control.isPausedRef)).toBe(false)
      })
    )

    it.effect('returns a SessionControl with quitToTitleSignal not yet fulfilled', () =>
      Effect.gen(function* () {
        const control = yield* createSessionControl
        const done = yield* Deferred.isDone(control.quitToTitleSignal)
        expect(done).toBe(false)
      })
    )

    it.effect('each call returns an independent SessionControl', () =>
      Effect.gen(function* () {
        const control1 = yield* createSessionControl
        const control2 = yield* createSessionControl

        MutableRef.set(control1.isPausedRef, true)
        expect(MutableRef.get(control2.isPausedRef)).toBe(false)
      })
    )
  })

  describe('setPaused / isPaused', () => {
    it.effect('setPaused(true) sets the pause flag to true', () =>
      Effect.gen(function* () {
        const control = yield* createSessionControl
        setPaused(control, true)
        expect(isPaused(control)).toBe(true)
      })
    )

    it.effect('setPaused(false) restores the pause flag to false', () =>
      Effect.gen(function* () {
        const control = yield* createSessionControl
        setPaused(control, true)
        setPaused(control, false)
        expect(isPaused(control)).toBe(false)
      })
    )

    it.effect('isPaused reflects the current value of isPausedRef', () =>
      Effect.gen(function* () {
        const control = yield* createSessionControl
        expect(isPaused(control)).toBe(false)
        setPaused(control, true)
        expect(isPaused(control)).toBe(true)
        setPaused(control, false)
        expect(isPaused(control)).toBe(false)
      })
    )
  })

  describe('requestQuitToTitle', () => {
    it.effect('fulfills quitToTitleSignal so Deferred.isDone returns true', () =>
      Effect.gen(function* () {
        const control = yield* createSessionControl
        yield* requestQuitToTitle(control)
        const done = yield* Deferred.isDone(control.quitToTitleSignal)
        expect(done).toBe(true)
      })
    )

    it.effect('calling requestQuitToTitle twice is idempotent (second call is a no-op)', () =>
      Effect.gen(function* () {
        const control = yield* createSessionControl
        yield* requestQuitToTitle(control)
        // Second call should succeed without error and not change state
        yield* requestQuitToTitle(control)
        const done = yield* Deferred.isDone(control.quitToTitleSignal)
        expect(done).toBe(true)
      })
    )

    it.effect('quitToTitleSignal can be awaited after requestQuitToTitle', () =>
      Effect.gen(function* () {
        const control = yield* createSessionControl
        yield* requestQuitToTitle(control)
        // Deferred.await should resolve immediately since it's already fulfilled
        yield* Deferred.await(control.quitToTitleSignal)
        // If we reach here, the signal was fulfilled
        expect(true).toBe(true)
      })
    )

    it.effect('quitToTitleSignal does not affect isPausedRef', () =>
      Effect.gen(function* () {
        const control = yield* createSessionControl
        yield* requestQuitToTitle(control)
        expect(isPaused(control)).toBe(false)
      })
    )
  })
})
