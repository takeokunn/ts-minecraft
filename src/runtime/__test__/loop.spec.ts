import { Cause, Duration, Effect, Layer, Ref } from 'effect'
import { TestClock, TestContext, TestLogger } from '@effect/test'
import { assert, describe, expect, it } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { createTick, gameLoop } from '../../runtime/loop'
import { Clock, DeltaTime, Stats } from '@/runtime/services'

// Test implementation for the Stats service
const createStatsTest = (
  callOrder: Ref.Ref<string[]>,
): Layer.Layer<Stats> =>
  Layer.succeed(Stats, {
    begin: Ref.update(callOrder, (calls) => [...calls, 'begin']),
    end: Ref.update(callOrder, (calls) => [...calls, 'end']),
  })

// Arbitrary for generating random systems for PBT
const systemArbitrary = fc.oneof(
  fc.constant(Effect.void),
  fc.string().pipe(fc.map((s) => Effect.fail(s))),
)
const systemsArbitrary = fc.array(systemArbitrary)

describe('Game Loop', () => {
  describe('createTick', () => {
    it.effect('should always succeed and call stats.begin and stats.end in order', () =>
      Effect.gen(function* () {
        const callOrder = yield* Ref.make<string[]>([])
        const StatsTest = createStatsTest(callOrder)

        yield* fc.assert(
          fc.asyncProperty(systemsArbitrary, (systems) =>
            Effect.gen(function* () {
              yield* Ref.set(callOrder, [])
              const tick = createTick(systems)
              yield* tick
              const calls = yield* Ref.get(callOrder)
              expect(calls[0]).toBe('begin')
              expect(calls[calls.length - 1]).toBe('end')
            }).pipe(Effect.provide(StatsTest)),
          ),
        )
      }))

    it.effect('should log all errors from failing systems', () =>
      Effect.gen(function* () {
        yield* fc.assert(
          fc.asyncProperty(systemsArbitrary, (systems) =>
            Effect.gen(function* () {
              yield* TestLogger.clear
              const tick = createTick(systems)
              yield* tick

              const logs = yield* TestLogger.logs
              const failingSystems = systems.filter((s) => s._tag === 'Fail')
              expect(logs.length).toBe(failingSystems.length)

              for (const log of logs) {
                expect(log.message).toBe('Error in system')
                assert(Cause.isFail(log.cause))
              }
            }),
          ),
        )
      }))

    it.effect('should provide the correct DeltaTime to systems', () =>
      Effect.gen(function* () {
        yield* fc.assert(
          fc.asyncProperty(fc.float({ min: 0, max: 100 }), (dt) =>
            Effect.gen(function* () {
              let receivedDeltaTime = 0
              const system = Effect.gen(function* () {
                const deltaTime = yield* DeltaTime
                receivedDeltaTime = deltaTime.value
              })

              const tick = createTick([system])
              yield* TestClock.adjust(Duration.millis(dt))
              yield* tick

              expect(receivedDeltaTime).toBeCloseTo(dt / 1000)
            }),
          ),
        )
      }))
  })

  describe('gameLoop', () => {
    it.effect('should register a callback that is called on each frame', () =>
      Effect.gen(function* () {
        let systemCallCount = 0
        const system = Effect.sync(() => {
          systemCallCount++
        })

        yield* gameLoop([system])

        // Check if the callback is registered
        const callbacks = yield* TestClock.times
        expect(callbacks.length).toBe(1)

        // Manually trigger frames
        yield* TestClock.tick()
        expect(systemCallCount).toBe(1)

        yield* TestClock.tick()
        expect(systemCallCount).toBe(2)

        for (let i = 0; i < 10; i++) {
          yield* TestClock.tick()
        }
        expect(systemCallCount).toBe(12)
      }))
  })
}).pipe(Effect.provide(TestContext.TestContext))