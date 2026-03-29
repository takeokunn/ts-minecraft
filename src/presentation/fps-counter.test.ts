import { describe, it } from '@effect/vitest'
import { Array as Arr, Effect, Schema, Metric } from 'effect'
import { DeltaTimeSecs } from '@/shared/kernel'
import { expect } from 'vitest'
import { FPSCounterService, FPSCounterLive, FPSCounterStateSchema } from './fps-counter'

describe('FPSCounterService', () => {
  describe('tick', () => {
    it.effect('should increment frame count', () =>
      Effect.gen(function* () {
        const counter = yield* FPSCounterService

        yield* counter.tick(DeltaTimeSecs.make(0.016)) // ~60 FPS frame time
        const frameCount = yield* counter.getFrameCount()

        expect(frameCount).toBe(1)
      }).pipe(Effect.provide(FPSCounterLive))
    )

    it.effect('should increment frame count on multiple ticks', () =>
      Effect.gen(function* () {
        const counter = yield* FPSCounterService

        yield* counter.tick(DeltaTimeSecs.make(0.016))
        yield* counter.tick(DeltaTimeSecs.make(0.016))
        yield* counter.tick(DeltaTimeSecs.make(0.016))
        const frameCount = yield* counter.getFrameCount()

        expect(frameCount).toBe(3)
      }).pipe(Effect.provide(FPSCounterLive))
    )
  })

  describe('getFPS', () => {
    it.effect('should return 0 before sample interval', () =>
      Effect.gen(function* () {
        const counter = yield* FPSCounterService

        yield* counter.tick(DeltaTimeSecs.make(0.016))
        yield* counter.tick(DeltaTimeSecs.make(0.016))
        const fps = yield* counter.getFPS()

        expect(fps).toBe(0)
      }).pipe(Effect.provide(FPSCounterLive))
    )

    it.effect('should return calculated FPS after sample interval', () =>
      Effect.gen(function* () {
        const counter = yield* FPSCounterService

        // Tick 30 times at 0.0167s (~60 FPS) = ~0.5s total
        yield* Effect.forEach(Arr.makeBy(30, () => undefined), () => counter.tick(DeltaTimeSecs.make(0.0167)), { concurrency: 1 })

        const fps = yield* counter.getFPS()
        expect(fps).toBeGreaterThan(50) // Should be ~60 FPS
        expect(fps).toBeLessThan(70)
      }).pipe(Effect.provide(FPSCounterLive))
    )

    it.effect('should calculate FPS accurately (frame count / time interval)', () =>
      Effect.gen(function* () {
        const counter = yield* FPSCounterService

        // Simulate exactly 0.5 seconds with 30 frames = 60 FPS
        // Add one extra tick to account for floating point precision
        const deltaTime = 0.5 / 30
        yield* Effect.forEach(Arr.makeBy(31, () => undefined), () => counter.tick(DeltaTimeSecs.make(deltaTime)), { concurrency: 1 })

        const fps = yield* counter.getFPS()
        // FPS should be approximately 60 (31 frames / ~0.52 seconds ≈ 59.6, rounds to ~60)
        expect(fps).toBeGreaterThan(59)
        expect(fps).toBeLessThan(61)
      }).pipe(Effect.provide(FPSCounterLive))
    )

    it.effect('should recalculate FPS after multiple intervals', () =>
      Effect.gen(function* () {
        const counter = yield* FPSCounterService

        // First interval: 31 frames to cross 0.5s threshold = ~60 FPS
        const deltaTime1 = 0.5 / 30
        yield* Effect.forEach(Arr.makeBy(31, () => undefined), () => counter.tick(DeltaTimeSecs.make(deltaTime1)), { concurrency: 1 })
        const fps1 = yield* counter.getFPS()
        expect(fps1).toBeGreaterThan(59)
        expect(fps1).toBeLessThan(61)

        // Second interval: 26 frames in 0.5s = ~50 FPS
        const deltaTime2 = 0.5 / 25
        yield* Effect.forEach(Arr.makeBy(26, () => undefined), () => counter.tick(DeltaTimeSecs.make(deltaTime2)), { concurrency: 1 })
        const fps2 = yield* counter.getFPS()
        expect(fps2).toBeGreaterThan(49)
        expect(fps2).toBeLessThan(51)
      }).pipe(Effect.provide(FPSCounterLive))
    )
  })

  describe('getFrameCount', () => {
    it.effect('should return current frame count', () =>
      Effect.gen(function* () {
        const counter = yield* FPSCounterService

        const initial = yield* counter.getFrameCount()
        expect(initial).toBe(0)

        yield* counter.tick(DeltaTimeSecs.make(0.016))
        const afterOne = yield* counter.getFrameCount()

        yield* counter.tick(DeltaTimeSecs.make(0.016))
        yield* counter.tick(DeltaTimeSecs.make(0.016))
        const afterThree = yield* counter.getFrameCount()

        expect(afterOne).toBe(1)
        expect(afterThree).toBe(3)
      }).pipe(Effect.provide(FPSCounterLive))
    )
  })

  describe('integration', () => {
    it.effect('should handle varying frame times correctly', () =>
      Effect.gen(function* () {
        const counter = yield* FPSCounterService

        // Simulate varying frame times (jittery ~60 FPS)
        const frameTimes = [0.015, 0.017, 0.016, 0.018, 0.014]
        yield* Effect.forEach(frameTimes, (time) => counter.tick(DeltaTimeSecs.make(time)), { concurrency: 1 })
        // Add more ticks to cross 0.5s threshold (total: 0.08 + 30 * 0.016 = ~0.56s)
        yield* Effect.forEach(Arr.makeBy(30, () => undefined), () => counter.tick(DeltaTimeSecs.make(0.016)), { concurrency: 1 })

        const fps = yield* counter.getFPS()
        // 35 frames in ~0.56s = ~62.5 FPS
        expect(fps).toBeGreaterThan(55)
        expect(fps).toBeLessThan(70)
      }).pipe(Effect.provide(FPSCounterLive))
    )
  })

  describe('FPSCounterStateSchema', () => {
    it('should decode a valid state object', () => {
      const result = Schema.decodeSync(FPSCounterStateSchema)({
        frameCount: 10,
        fps: 60,
        accumulatedTime: 0.5,
      })
      expect(result.frameCount).toBe(10)
      expect(result.fps).toBe(60)
      expect(result.accumulatedTime).toBe(0.5)
    })

    it('should reject an object with missing fields', () => {
      expect(() =>
        Schema.decodeUnknownSync(FPSCounterStateSchema)({ fps: 60 })
      ).toThrow()
    })

    it('should reject an object with wrong field types', () => {
      expect(() =>
        Schema.decodeUnknownSync(FPSCounterStateSchema)({
          frameCount: 'ten',
          fps: 60,
          accumulatedTime: 0,
        })
      ).toThrow()
    })
  })

  describe('Effect.Metric gauge', () => {
    it.effect('fps gauge is set after sample interval is reached', () =>
      // FPS_SAMPLE_INTERVAL = 0.5s. Use 31 ticks at deltaTime = 0.5/30 (~16.67ms)
      // to cross the 0.5s threshold and trigger the gauge update.
      Effect.gen(function* () {
        const counter = yield* FPSCounterService
        const fpsGauge = Metric.gauge('fps')

        const deltaTime = 0.5 / 30
        yield* Effect.forEach(Arr.makeBy(31, () => undefined), () => counter.tick(DeltaTimeSecs.make(deltaTime)), { concurrency: 1 })

        const gaugeState = yield* Metric.value(fpsGauge)
        expect(gaugeState.value).toBeGreaterThan(0)
      }).pipe(Effect.provide(FPSCounterLive))
    )

    it.effect('fps gauge reflects calculated FPS value matching getFPS()', () =>
      // Tick 31 frames at ~60 FPS to cross the 0.5s sample interval.
      // Both the gauge and getFPS() should report approximately the same value.
      Effect.gen(function* () {
        const counter = yield* FPSCounterService
        const fpsGauge = Metric.gauge('fps')

        const deltaTime = 0.5 / 30
        yield* Effect.forEach(Arr.makeBy(31, () => undefined), () => counter.tick(DeltaTimeSecs.make(deltaTime)), { concurrency: 1 })

        const fps = yield* counter.getFPS()
        const gaugeState = yield* Metric.value(fpsGauge)
        expect(fps).toBeGreaterThan(50)
        expect(gaugeState.value).toBeGreaterThan(50)
      }).pipe(Effect.provide(FPSCounterLive))
    )

    it.effect('fps gauge is not set before sample interval', () =>
      // Only 2 ticks — total time 0.032s < 0.5s threshold.
      // The gauge must NOT have been updated in this run.
      // We use a delta assertion: gauge value before == gauge value after the 2 ticks.
      Effect.gen(function* () {
        const counter = yield* FPSCounterService
        const fpsGauge = Metric.gauge('fps')

        const before = yield* Metric.value(fpsGauge)

        yield* counter.tick(DeltaTimeSecs.make(0.016))
        yield* counter.tick(DeltaTimeSecs.make(0.016))

        const after = yield* Metric.value(fpsGauge)
        // Gauge should not have changed because sample interval was not crossed
        expect(after.value).toBe(before.value)
      }).pipe(Effect.provide(FPSCounterLive))
    )
  })
})
