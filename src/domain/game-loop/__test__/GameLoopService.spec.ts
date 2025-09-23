import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, Layer, TestClock, TestContext } from 'effect'
import { GameLoopService } from '../GameLoopService'
import type { FrameInfo, GameLoopConfig } from '../types'
import {
  GameLoopInitError,
  GameLoopPerformanceError,
  GameLoopRuntimeError,
  GameLoopStateError,
} from '../errors'

describe('GameLoopService', () => {
  // Mock GameLoopService for testing the interface contract
  const createMockGameLoopService = () => {
    const mockCallbacks: Array<(frameInfo: FrameInfo) => Effect.Effect<void>> = []
    let mockState: 'idle' | 'running' | 'paused' | 'stopped' = 'idle'
    let mockFrameCount = 0
    let mockConfig: GameLoopConfig = {
      targetFps: 60,
      maxFrameSkip: 5,
      enablePerformanceMonitoring: true,
      adaptiveQuality: false,
    }

    return GameLoopService.of({
      initialize: (config) =>
        Effect.gen(function* () {
          if (mockState !== 'idle' && mockState !== 'stopped') {
            return yield* Effect.fail(
              new GameLoopInitError({
                message: 'Already initialized',
                reason: `State is ${mockState}`,
              })
            )
          }
          if (config) {
            mockConfig = { ...mockConfig, ...config }
          }
          mockState = 'idle'
          mockFrameCount = 0
        }),

      start: () =>
        Effect.gen(function* () {
          if (mockState === 'running') return
          if (mockState !== 'idle' && mockState !== 'paused') {
            return yield* Effect.fail(
              new GameLoopStateError({
                message: 'Invalid state transition',
                currentState: mockState,
                attemptedTransition: 'start',
              })
            )
          }
          mockState = 'running'
        }),

      pause: () =>
        Effect.gen(function* () {
          if (mockState !== 'running') {
            return yield* Effect.fail(
              new GameLoopStateError({
                message: 'Can only pause when running',
                currentState: mockState,
                attemptedTransition: 'pause',
              })
            )
          }
          mockState = 'paused'
        }),

      resume: () =>
        Effect.gen(function* () {
          if (mockState !== 'paused') {
            return yield* Effect.fail(
              new GameLoopStateError({
                message: 'Can only resume when paused',
                currentState: mockState,
                attemptedTransition: 'resume',
              })
            )
          }
          mockState = 'running'
        }),

      stop: () =>
        Effect.gen(function* () {
          mockState = 'stopped'
          mockCallbacks.length = 0
        }),

      onFrame: (callback) =>
        Effect.gen(function* () {
          mockCallbacks.push(callback)
          return () => {
            const index = mockCallbacks.indexOf(callback)
            if (index > -1) {
              mockCallbacks.splice(index, 1)
            }
          }
        }),

      getState: () => Effect.succeed(mockState),

      getPerformanceMetrics: () =>
        Effect.gen(function* () {
          if (mockFrameCount === 0) {
            return yield* Effect.fail(
              new GameLoopPerformanceError({
                message: 'No performance data',
                currentFps: 0,
                targetFps: mockConfig.targetFps,
                droppedFrames: 0,
              })
            )
          }
          return {
            averageFps: 60,
            minFps: 58,
            maxFps: 62,
            frameTimeMs: 16.67,
            droppedFrames: 0,
            cpuUsage: 5,
            memoryUsage: 1024 * 1024 * 50,
          }
        }),

      tick: (deltaTime) =>
        Effect.gen(function* () {
          const frameInfo: FrameInfo = {
            currentTime: Date.now(),
            deltaTime: deltaTime ?? 16.67,
            frameCount: mockFrameCount++,
            fps: 60,
            frameSkipped: false,
          }

          yield* Effect.all(mockCallbacks.map((cb) => cb(frameInfo)), {
            concurrency: 'unbounded',
          }).pipe(
            Effect.catchAll((error) =>
              Effect.fail(
                new GameLoopRuntimeError({
                  message: 'Callback error',
                  frameNumber: mockFrameCount,
                  error,
                })
              )
            )
          )

          return frameInfo
        }),

      updateConfig: (config) =>
        Effect.gen(function* () {
          mockConfig = { ...mockConfig, ...config }
        }),

      reset: () =>
        Effect.gen(function* () {
          mockState = 'idle'
          mockFrameCount = 0
          mockCallbacks.length = 0
          mockConfig = {
            targetFps: 60,
            maxFrameSkip: 5,
            enablePerformanceMonitoring: true,
            adaptiveQuality: false,
          }
        }),
    })
  }

  const MockGameLoopServiceLayer = Layer.sync(GameLoopService, createMockGameLoopService)

  describe('Service Interface Contract', () => {
    it('should provide all required methods', () => {
      const service = createMockGameLoopService()

      expect(service.initialize).toBeDefined()
      expect(service.start).toBeDefined()
      expect(service.pause).toBeDefined()
      expect(service.resume).toBeDefined()
      expect(service.stop).toBeDefined()
      expect(service.onFrame).toBeDefined()
      expect(service.getState).toBeDefined()
      expect(service.getPerformanceMetrics).toBeDefined()
      expect(service.tick).toBeDefined()
      expect(service.updateConfig).toBeDefined()
      expect(service.reset).toBeDefined()
    })

    it('should handle initialization correctly', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize({ targetFps: 120 })
        const state = yield* gameLoop.getState()
        return state
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result).toBe('idle')
    })

    it('should prevent double initialization', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        return yield* gameLoop.initialize()
      })

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(MockGameLoopServiceLayer),
          Effect.either
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(GameLoopInitError)
      }
    })
  })

  describe('State Management', () => {
    it('should transition from idle to running', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        const initialState = yield* gameLoop.getState()
        yield* gameLoop.start()
        const runningState = yield* gameLoop.getState()
        return { initialState, runningState }
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result.initialState).toBe('idle')
      expect(result.runningState).toBe('running')
    })

    it('should transition from running to paused', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        yield* gameLoop.pause()
        return yield* gameLoop.getState()
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result).toBe('paused')
    })

    it('should transition from paused to running', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        yield* gameLoop.pause()
        yield* gameLoop.resume()
        return yield* gameLoop.getState()
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result).toBe('running')
    })

    it('should handle invalid state transitions', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        // Try to pause without starting
        return yield* gameLoop.pause()
      })

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(MockGameLoopServiceLayer),
          Effect.either
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(GameLoopStateError)
      }
    })

    it('should stop from any state', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        yield* gameLoop.stop()
        return yield* gameLoop.getState()
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result).toBe('stopped')
    })
  })

  describe('Frame Callbacks', () => {
    it('should register and execute frame callbacks', async () => {
      const frameData: FrameInfo[] = []

      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        yield* gameLoop.onFrame((info) =>
          Effect.sync(() => {
            frameData.push(info)
          })
        )

        yield* gameLoop.tick()
        yield* gameLoop.tick()

        return frameData.length
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result).toBe(2)
    })

    it('should support multiple callbacks', async () => {
      const callback1Data: FrameInfo[] = []
      const callback2Data: FrameInfo[] = []

      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        yield* gameLoop.onFrame((info) =>
          Effect.sync(() => {
            callback1Data.push(info)
          })
        )

        yield* gameLoop.onFrame((info) =>
          Effect.sync(() => {
            callback2Data.push(info)
          })
        )

        yield* gameLoop.tick()

        return {
          callback1: callback1Data.length,
          callback2: callback2Data.length,
        }
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result.callback1).toBe(1)
      expect(result.callback2).toBe(1)
    })

    it('should handle callback removal', async () => {
      const frameData: FrameInfo[] = []

      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        const unsubscribe = yield* gameLoop.onFrame((info) =>
          Effect.sync(() => {
            frameData.push(info)
          })
        )

        yield* gameLoop.tick()
        unsubscribe()
        yield* gameLoop.tick()

        return frameData.length
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result).toBe(1)
    })

    it('should handle callback errors gracefully', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        yield* gameLoop.onFrame(() =>
          Effect.fail(new Error('Callback error')) as Effect.Effect<void>
        )

        return yield* gameLoop.tick()
      })

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(MockGameLoopServiceLayer),
          Effect.either
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(GameLoopRuntimeError)
      }
    })
  })

  describe('Performance Metrics', () => {
    it('should provide performance metrics when available', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        yield* gameLoop.tick()
        yield* gameLoop.tick()
        return yield* gameLoop.getPerformanceMetrics()
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result.averageFps).toBeCloseTo(60, 0)
      expect(result.minFps).toBeGreaterThan(0)
      expect(result.maxFps).toBeGreaterThan(0)
      expect(result.frameTimeMs).toBeGreaterThan(0)
      expect(result.droppedFrames !== undefined).toBe(true)
    })

    it('should fail when no performance data is available', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        return yield* gameLoop.getPerformanceMetrics()
      })

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(MockGameLoopServiceLayer),
          Effect.either
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(GameLoopPerformanceError)
      }
    })
  })

  describe('Configuration Management', () => {
    it('should initialize with default config', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        return yield* gameLoop.getState()
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result).toBe('idle')
    })

    it('should accept custom configuration', async () => {
      const customConfig: Partial<GameLoopConfig> = {
        targetFps: 120,
        maxFrameSkip: 10,
      }

      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize(customConfig)
        return yield* gameLoop.getState()
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result).toBe('idle')
    })

    it('should update configuration dynamically', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.updateConfig({ targetFps: 30 })
        return yield* gameLoop.getState()
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result).toBe('idle')
    })
  })

  describe('Tick Function', () => {
    it('should execute single frame with default delta time', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        const frameInfo = yield* gameLoop.tick()
        return frameInfo
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result.frameCount !== undefined).toBe(true)
      expect(result!.deltaTime).toBeGreaterThan(0)
      expect(result!.fps).toBeGreaterThan(0)
      expect(result.frameSkipped).toBe(false)
    })

    it('should execute single frame with custom delta time', async () => {
      const customDelta = 33.33 // 30 FPS

      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        const frameInfo = yield* gameLoop.tick(customDelta)
        return frameInfo
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result.deltaTime).toBe(customDelta)
    })

    it('should increment frame count on each tick', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        const frame1 = yield* gameLoop.tick()
        const frame2 = yield* gameLoop.tick()
        const frame3 = yield* gameLoop.tick()
        return [frame1, frame2, frame3]
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result[0].frameCount).toBe(0)
      expect(result[1].frameCount).toBe(1)
      expect(result[2].frameCount).toBe(2)
    })
  })

  describe('Reset Functionality', () => {
    it('should reset to initial state', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        yield* gameLoop.tick()
        yield* gameLoop.tick()
        yield* gameLoop.reset()
        return yield* gameLoop.getState()
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result).toBe('idle')
    })

    it('should clear all callbacks on reset', async () => {
      const frameData: FrameInfo[] = []

      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        yield* gameLoop.onFrame((info) =>
          Effect.sync(() => {
            frameData.push(info)
          })
        )

        yield* gameLoop.tick()
        yield* gameLoop.reset()
        yield* gameLoop.initialize()
        yield* gameLoop.tick()

        return frameData.length
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result).toBe(1) // Only first tick should have been recorded
    })
  })

  describe('Error Handling', () => {
    it('should handle initialization errors', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        return yield* gameLoop.initialize()
      })

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(MockGameLoopServiceLayer),
          Effect.either
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('GameLoopInitError')
      }
    })

    it('should handle state transition errors', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        return yield* gameLoop.resume() // Can't resume when not paused
      })

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(MockGameLoopServiceLayer),
          Effect.either
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('GameLoopStateError')
      }
    })

    it('should handle runtime errors', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        yield* gameLoop.onFrame(() =>
          Effect.fail(new Error('Frame processing error')) as Effect.Effect<void>
        )

        return yield* gameLoop.tick()
      })

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(MockGameLoopServiceLayer),
          Effect.either
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('GameLoopRuntimeError')
      }
    })

    it('should handle performance errors', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        // No frames executed
        return yield* gameLoop.getPerformanceMetrics()
      })

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(MockGameLoopServiceLayer),
          Effect.either
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('GameLoopPerformanceError')
      }
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complete lifecycle', async () => {
      const states: string[] = []

      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService

        yield* gameLoop.initialize()
        states.push(yield* gameLoop.getState())

        yield* gameLoop.start()
        states.push(yield* gameLoop.getState())

        yield* gameLoop.pause()
        states.push(yield* gameLoop.getState())

        yield* gameLoop.resume()
        states.push(yield* gameLoop.getState())

        yield* gameLoop.stop()
        states.push(yield* gameLoop.getState())

        return states
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result).toEqual(['idle', 'running', 'paused', 'running', 'stopped'])
    })

    it('should handle rapid state changes', async () => {
      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        // Rapid state changes
        yield* gameLoop.start()
        yield* gameLoop.pause()
        yield* gameLoop.resume()
        yield* gameLoop.pause()
        yield* gameLoop.resume()
        yield* gameLoop.stop()

        return yield* gameLoop.getState()
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result).toBe('stopped')
    })

    it('should maintain frame consistency during pause/resume', async () => {
      const frameData: FrameInfo[] = []

      const program = Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        yield* gameLoop.onFrame((info) =>
          Effect.sync(() => {
            frameData.push(info)
          })
        )

        yield* gameLoop.start()
        yield* gameLoop.tick()
        yield* gameLoop.pause()
        // No ticks during pause
        yield* gameLoop.resume()
        yield* gameLoop.tick()

        return frameData
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MockGameLoopServiceLayer))
      )

      expect(result.length).toBe(2)
      expect(result[0].frameCount).toBe(0)
      expect(result[1].frameCount).toBe(1)
    })
  })
})