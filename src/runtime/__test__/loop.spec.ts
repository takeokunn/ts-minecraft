import { Effect, Layer, Ref, Logger, Fiber, TestClock } from 'effect'
import { describe, it, expect } from '@effect/vitest'
import { createTick, gameLoop } from '../../runtime/loop'
import { Stats, Clock, DeltaTime } from '@/runtime/services'

const testDeltaTime = 0.016

const createStatsTest = (
  begin: Effect.Effect<void> = Effect.void,
  end: Effect.Effect<void> = Effect.void,
) => Layer.succeed(Stats, { begin, end })

const createClockTest = (deltaTime: number) =>
  Layer.succeed(Clock, {
    deltaTime: Ref.unsafeMake(deltaTime),
    onFrame: () => Effect.void,
  })

const BaseTestLayers = Layer.mergeAll(createStatsTest(), createClockTest(testDeltaTime))

describe('Game Loop', () => {
  describe('createTick', () => {
    it.effect('should run systems', () =>
      Effect.gen(function* () {
        let system1Called = false
        let system2Called = false
        const system1 = Effect.sync(() => {
          system1Called = true
        })
        const system2 = Effect.sync(() => {
          system2Called = true
        })
        const tick = createTick([system1, system2])
        yield* tick
        expect(system1Called).toBe(true)
        expect(system2Called).toBe(true)
      }).pipe(Effect.provide(BaseTestLayers)))

    it.effect('should call stats.begin and stats.end in order', () =>
      Effect.gen(function* () {
        const callOrder: string[] = []
        const StatsTest = createStatsTest(
          Effect.sync(() => callOrder.push('begin')),
          Effect.sync(() => callOrder.push('end')),
        )
        const TestLayers = Layer.mergeAll(StatsTest, createClockTest(testDeltaTime))

        const system = Effect.sync(() => callOrder.push('system'))
        const tick = createTick([system])

        yield* tick.pipe(Effect.provide(TestLayers))

        expect(callOrder).toEqual(['begin', 'system', 'end'])
      }))

    it.effect('should provide DeltaTime to systems', () =>
      Effect.gen(function* () {
        let receivedDeltaTime = 0
        const system = Effect.gen(function* () {
          const deltaTime = yield* DeltaTime
          receivedDeltaTime = deltaTime.value
        })

        const tick = createTick([system])
        yield* tick

        expect(receivedDeltaTime).toBe(testDeltaTime)
      }).pipe(Effect.provide(BaseTestLayers)))

    it.effect('should log errors from failing systems', () =>
      Effect.gen(function* () {
        const error = new Error('system failure')
        const failingSystem = Effect.fail(error)
        const tick = createTick([failingSystem])

        const [logger, fiber] = yield* Logger.test
        const testLayer = Layer.merge(BaseTestLayers, Logger.replace(Logger.default, logger))

        yield* tick.pipe(Effect.provide(testLayer))
        const logs = yield* Fiber.join(fiber)

        expect(logs.length).toBe(1)
        expect(logs[0].message).toBe('Error in system')
        expect(logs[0].cause.toJSON()).toEqual(error.toJSON())
      }))
  })

  describe('gameLoop', () => {
    it.effect('should repeat the tick', () =>
      Effect.gen(function* () {
        let systemCallCount = 0
        const system = Effect.sync(() => {
          systemCallCount++
        })

        const loop = gameLoop([system])
        const fiber = yield* Effect.fork(loop)

        yield* TestClock.increment
        expect(systemCallCount).toBe(1)

        yield* TestClock.increment
        expect(systemCallCount).toBe(2)

        for (let i = 0; i < 10; i++) {
          yield* TestClock.increment
        }
        expect(systemCallCount).toBe(12)

        yield* Fiber.interrupt(fiber)
      }).pipe(Effect.provide(BaseTestLayers)))
  })
})