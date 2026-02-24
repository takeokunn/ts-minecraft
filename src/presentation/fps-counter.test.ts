import { describe, it, beforeEach } from '@effect/vitest'
import { Effect } from 'effect'
import { expect } from 'vitest'
import { FPSCounter, FPSCounterLive } from './fps-counter'

describe('FPSCounter', () => {
  beforeEach(() => {
    return Effect.gen(function* () {
      const counter = yield* FPSCounter
      yield* counter.reset()
    }).pipe(
      Effect.provide(FPSCounterLive),
      Effect.runSync
    )
  })

  describe('tick', () => {
    it('should increment frame count', () => {
      const program = Effect.gen(function* () {
        const counter = yield* FPSCounter

        yield* counter.tick(0.016) // ~60 FPS frame time
        const frameCount = yield* counter.getFrameCount()

        return frameCount
      })

      const result = Effect.runSync(program.pipe(Effect.provide(FPSCounterLive)))
      expect(result).toBe(1)
    })

    it('should increment frame count on multiple ticks', () => {
      const program = Effect.gen(function* () {
        const counter = yield* FPSCounter

        yield* counter.tick(0.016)
        yield* counter.tick(0.016)
        yield* counter.tick(0.016)
        const frameCount = yield* counter.getFrameCount()

        return frameCount
      })

      const result = Effect.runSync(program.pipe(Effect.provide(FPSCounterLive)))
      expect(result).toBe(3)
    })
  })

  describe('getFPS', () => {
    it('should return 0 before sample interval', () => {
      const program = Effect.gen(function* () {
        const counter = yield* FPSCounter

        yield* counter.tick(0.016)
        yield* counter.tick(0.016)
        const fps = yield* counter.getFPS()

        return fps
      })

      const result = Effect.runSync(program.pipe(Effect.provide(FPSCounterLive)))
      expect(result).toBe(0)
    })

    it('should return calculated FPS after sample interval', () => {
      const program = Effect.gen(function* () {
        const counter = yield* FPSCounter

        // Tick 30 times at 0.0167s (~60 FPS) = ~0.5s total
        for (let i = 0; i < 30; i++) {
          yield* counter.tick(0.0167)
        }

        const fps = yield* counter.getFPS()
        return fps
      })

      const result = Effect.runSync(program.pipe(Effect.provide(FPSCounterLive)))
      expect(result).toBeGreaterThan(50) // Should be ~60 FPS
      expect(result).toBeLessThan(70)
    })

    it('should calculate FPS accurately (frame count / time interval)', () => {
      const program = Effect.gen(function* () {
        const counter = yield* FPSCounter

        // Simulate exactly 0.5 seconds with 30 frames = 60 FPS
        // Add one extra tick to account for floating point precision
        const deltaTime = 0.5 / 30
        for (let i = 0; i < 31; i++) {
          yield* counter.tick(deltaTime)
        }

        const fps = yield* counter.getFPS()
        return fps
      })

      const result = Effect.runSync(program.pipe(Effect.provide(FPSCounterLive)))
      // FPS should be approximately 60 (31 frames / ~0.52 seconds ≈ 59.6, rounds to ~60)
      expect(result).toBeGreaterThan(59)
      expect(result).toBeLessThan(61)
    })

    it('should recalculate FPS after multiple intervals', () => {
      const program = Effect.gen(function* () {
        const counter = yield* FPSCounter

        // First interval: 31 frames to cross 0.5s threshold = ~60 FPS
        const deltaTime1 = 0.5 / 30
        for (let i = 0; i < 31; i++) {
          yield* counter.tick(deltaTime1)
        }
        const fps1 = yield* counter.getFPS()
        expect(fps1).toBeGreaterThan(59)
        expect(fps1).toBeLessThan(61)

        // Second interval: 26 frames in 0.5s = ~50 FPS
        const deltaTime2 = 0.5 / 25
        for (let i = 0; i < 26; i++) {
          yield* counter.tick(deltaTime2)
        }
        const fps2 = yield* counter.getFPS()
        return fps2
      })

      const result = Effect.runSync(program.pipe(Effect.provide(FPSCounterLive)))
      expect(result).toBeGreaterThan(49)
      expect(result).toBeLessThan(51)
    })
  })

  describe('getFrameCount', () => {
    it('should return current frame count', () => {
      const program = Effect.gen(function* () {
        const counter = yield* FPSCounter

        const initial = yield* counter.getFrameCount()
        expect(initial).toBe(0)

        yield* counter.tick(0.016)
        const afterOne = yield* counter.getFrameCount()

        yield* counter.tick(0.016)
        yield* counter.tick(0.016)
        const afterThree = yield* counter.getFrameCount()

        return { afterOne, afterThree }
      })

      const result = Effect.runSync(program.pipe(Effect.provide(FPSCounterLive)))
      expect(result.afterOne).toBe(1)
      expect(result.afterThree).toBe(3)
    })
  })

  describe('reset', () => {
    it('should clear all state', () => {
      const program = Effect.gen(function* () {
        const counter = yield* FPSCounter

        // Accumulate some state (31 ticks to cross 0.5s threshold)
        const deltaTime = 0.5 / 30
        for (let i = 0; i < 31; i++) {
          yield* counter.tick(deltaTime)
        }

        const fpsBefore = yield* counter.getFPS()
        const frameCountBefore = yield* counter.getFrameCount()

        // Reset
        yield* counter.reset()

        const fpsAfter = yield* counter.getFPS()
        const frameCountAfter = yield* counter.getFrameCount()

        return { fpsBefore, frameCountBefore, fpsAfter, frameCountAfter }
      })

      const result = Effect.runSync(program.pipe(Effect.provide(FPSCounterLive)))
      expect(result.fpsBefore).toBeGreaterThan(59)
      expect(result.fpsBefore).toBeLessThan(61)
      expect(result.frameCountBefore).toBe(0) // Reset after interval
      expect(result.fpsAfter).toBe(0)
      expect(result.frameCountAfter).toBe(0)
    })

    it('should reset accumulated state mid-interval', () => {
      const program = Effect.gen(function* () {
        const counter = yield* FPSCounter

        // Add some ticks but not enough for interval
        yield* counter.tick(0.016)
        yield* counter.tick(0.016)
        yield* counter.tick(0.016)

        yield* counter.reset()

        const fps = yield* counter.getFPS()
        const frameCount = yield* counter.getFrameCount()

        return { fps, frameCount }
      })

      const result = Effect.runSync(program.pipe(Effect.provide(FPSCounterLive)))
      expect(result.fps).toBe(0)
      expect(result.frameCount).toBe(0)
    })
  })

  describe('integration', () => {
    it('should handle varying frame times correctly', () => {
      const program = Effect.gen(function* () {
        const counter = yield* FPSCounter

        // Simulate varying frame times (jittery ~60 FPS)
        const frameTimes = [0.015, 0.017, 0.016, 0.018, 0.014]
        for (const time of frameTimes) {
          yield* counter.tick(time)
        }
        // Add more ticks to cross 0.5s threshold (total: 0.08 + 30 * 0.016 = ~0.56s)
        for (let i = 0; i < 30; i++) {
          yield* counter.tick(0.016)
        }

        const fps = yield* counter.getFPS()
        return fps
      })

      const result = Effect.runSync(program.pipe(Effect.provide(FPSCounterLive)))
      // 35 frames in ~0.56s = ~62.5 FPS
      expect(result).toBeGreaterThan(55)
      expect(result).toBeLessThan(70)
    })
  })
})
