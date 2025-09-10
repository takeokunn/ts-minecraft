import { Duration, Effect, Layer, Ref } from 'effect'
import { TestClock, TestContext } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { createTick, gameLoop } from '../loop'
import { Clock, DeltaTime, Stats } from '@/runtime/services'

// Test implementation for the Stats service
const createStatsTest = (callOrder: Ref.Ref<string[]>): Layer.Layer<Stats> =>
  Layer.succeed(Stats, {
    begin: Ref.update(callOrder, (calls) => [...calls, 'begin']),
    end: Ref.update(callOrder, (calls) => [...calls, 'end']),
  })

// Test implementation for Clock service
const createClockTest = (deltaTimeRef: Ref.Ref<number>): Layer.Layer<Clock> =>
  Layer.succeed(Clock, {
    deltaTime: deltaTimeRef,
    onFrame: (callback) => Effect.gen(function* () {
      yield* callback()
    }),
  })

describe('Game Loop', () => {
  describe('createTick', () => {
    it.effect('should call stats.begin and stats.end in order', () =>
      Effect.gen(function* () {
        const callOrder = yield* Ref.make<string[]>([])
        const deltaTime = yield* Ref.make(16)
        const StatsTest = createStatsTest(callOrder)
        const ClockTest = createClockTest(deltaTime)

        const testSystem = Effect.void
        const tick = createTick([testSystem])
        
        yield* tick.pipe(
          Effect.provide(StatsTest),
          Effect.provide(ClockTest)
        )

        const calls = yield* Ref.get(callOrder)
        expect(calls[0]).toBe('begin')
        expect(calls[calls.length - 1]).toBe('end')
      }))

    it.effect('should provide correct DeltaTime to systems', () =>
      Effect.gen(function* () {
        const callOrder = yield* Ref.make<string[]>([])
        const deltaTime = yield* Ref.make(32)
        const StatsTest = createStatsTest(callOrder)
        const ClockTest = createClockTest(deltaTime)

        let receivedDeltaTime = 0
        const testSystem = Effect.gen(function* () {
          const dt = yield* DeltaTime
          receivedDeltaTime = dt.value
        })

        const tick = createTick([testSystem])
        
        yield* tick.pipe(
          Effect.provide(StatsTest),
          Effect.provide(ClockTest)
        )

        expect(receivedDeltaTime).toBe(32)
      }))

    it.effect('should handle system errors gracefully', () =>
      Effect.gen(function* () {
        const callOrder = yield* Ref.make<string[]>([])
        const deltaTime = yield* Ref.make(16)
        const StatsTest = createStatsTest(callOrder)
        const ClockTest = createClockTest(deltaTime)

        const errorSystem = Effect.fail('test error')
        const successSystem = Effect.void
        
        const tick = createTick([errorSystem, successSystem])
        
        // Should not fail despite error in system
        yield* tick.pipe(
          Effect.provide(StatsTest),
          Effect.provide(ClockTest)
        )

        const calls = yield* Ref.get(callOrder)
        expect(calls[0]).toBe('begin')
        expect(calls[calls.length - 1]).toBe('end')
      }))
  })

  describe('gameLoop', () => {
    it.effect('should set up frame callback', () =>
      Effect.gen(function* () {
        let callbackCalled = false
        const deltaTime = yield* Ref.make(16)
        
        const clockLayer = Layer.succeed(Clock, {
          deltaTime,
          onFrame: (callback) => Effect.gen(function* () {
            callbackCalled = true
            yield* callback()
          }),
        })
        
        const callOrder = yield* Ref.make<string[]>([])
        const statsLayer = createStatsTest(callOrder)

        const testSystem = Effect.void
        
        yield* gameLoop([testSystem]).pipe(
          Effect.provide(clockLayer),
          Effect.provide(statsLayer)
        )

        expect(callbackCalled).toBe(true)
      }))
  })
}, { provider: TestContext })