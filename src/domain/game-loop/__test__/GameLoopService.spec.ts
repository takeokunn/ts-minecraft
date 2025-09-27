import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Either, Layer, TestClock, TestContext, pipe } from 'effect'
import * as Match from 'effect/Match'
import { GameLoopService } from '../services/GameLoopService'
import type { FrameInfo, GameLoopConfig } from '../types/types'
import { GameLoopInitError, GameLoopPerformanceError, GameLoopRuntimeError, GameLoopStateError } from '../errors'
import { BrandedTypes } from '@domain/core/types/brands'

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
          yield* pipe(
            mockState !== 'idle' && mockState !== 'stopped',
            Match.value,
            Match.when(true, () =>
              Effect.fail({
                _tag: 'GameLoopInitError' as const,
                message: 'Already initialized',
                reason: `State is ${mockState}`,
              } satisfies GameLoopInitError)
            ),
            Match.when(false, () => Effect.succeed(undefined)),
            Match.exhaustive
          )

          if (config) {
            mockConfig = { ...mockConfig, ...config }
          }

          mockState = 'idle'
          mockFrameCount = 0
        }),

      start: () =>
        Effect.gen(function* () {
          yield* pipe(
            mockState === 'running',
            Match.value,
            Match.when(true, () => Effect.succeed(undefined)),
            Match.when(false, () =>
              pipe(
                mockState !== 'idle' && mockState !== 'paused',
                Match.value,
                Match.when(true, () =>
                  Effect.fail({
                    _tag: 'GameLoopStateError' as const,
                    message: 'Invalid state transition',
                    currentState: mockState,
                    attemptedTransition: 'start',
                  } satisfies GameLoopStateError)
                ),
                Match.when(false, () =>
                  Effect.sync(() => {
                    mockState = 'running'
                  })
                ),
                Match.exhaustive
              )
            ),
            Match.exhaustive
          )
        }),

      pause: () =>
        Effect.gen(function* () {
          yield* pipe(
            mockState !== 'running',
            Match.value,
            Match.when(true, () =>
              Effect.fail({
                _tag: 'GameLoopStateError' as const,
                message: 'Can only pause when running',
                currentState: mockState,
                attemptedTransition: 'pause',
              } satisfies GameLoopStateError)
            ),
            Match.when(false, () =>
              Effect.sync(() => {
                mockState = 'paused'
              })
            ),
            Match.exhaustive
          )
        }),

      resume: () =>
        Effect.gen(function* () {
          yield* pipe(
            mockState !== 'paused',
            Match.value,
            Match.when(true, () =>
              Effect.fail({
                _tag: 'GameLoopStateError' as const,
                message: 'Can only resume when paused',
                currentState: mockState,
                attemptedTransition: 'resume',
              } satisfies GameLoopStateError)
            ),
            Match.when(false, () =>
              Effect.sync(() => {
                mockState = 'running'
              })
            ),
            Match.exhaustive
          )
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
          return yield* pipe(
            mockFrameCount === 0,
            Match.value,
            Match.when(true, () =>
              Effect.fail({
                _tag: 'GameLoopPerformanceError' as const,
                message: 'No performance data',
                currentFps: 0,
                targetFps: mockConfig.targetFps,
                droppedFrames: 0,
              } satisfies GameLoopPerformanceError)
            ),
            Match.when(false, () =>
              Effect.succeed({
                averageFps: 60,
                minFps: 58,
                maxFps: 62,
                frameTimeMs: 16.67,
                droppedFrames: 0,
                cpuUsage: 5,
                memoryUsage: 1024 * 1024 * 50,
              })
            ),
            Match.exhaustive
          )
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

          yield* Effect.all(
            mockCallbacks.map((cb) => cb(frameInfo)),
            {
              concurrency: 'unbounded',
            }
          ).pipe(
            Effect.catchAll((error) =>
              Effect.fail({
                _tag: 'GameLoopRuntimeError' as const,
                message: 'Callback error',
                frameNumber: mockFrameCount,
                error,
              } satisfies GameLoopRuntimeError)
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
    it.effect('should provide all required methods', () =>
      Effect.gen(function* () {
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
    )

    it.effect('should handle initialization correctly', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize({ targetFps: 120 })
        const state = yield* gameLoop.getState()
        expect(state).toBe('idle')
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should prevent double initialization', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        const result = yield* gameLoop.initialize().pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('GameLoopInitError')
        }
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )
  })

  describe('State Management', () => {
    it.effect('should transition from idle to running', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        const initialState = yield* gameLoop.getState()
        yield* gameLoop.start()
        const runningState = yield* gameLoop.getState()

        expect(initialState).toBe('idle')
        expect(runningState).toBe('running')
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should transition from running to paused', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        yield* gameLoop.pause()
        const state = yield* gameLoop.getState()

        expect(state).toBe('paused')
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should transition from paused to running', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        yield* gameLoop.pause()
        yield* gameLoop.resume()
        const state = yield* gameLoop.getState()

        expect(state).toBe('running')
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should handle invalid state transitions', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        // Try to pause without starting
        const result = yield* gameLoop.pause().pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('GameLoopStateError')
        }
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should stop from any state', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        yield* gameLoop.stop()
        const state = yield* gameLoop.getState()

        expect(state).toBe('stopped')
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )
  })

  describe('Frame Callbacks', () => {
    it.effect('should register and execute frame callbacks', () =>
      Effect.gen(function* () {
        const frameData: FrameInfo[] = []
        const gameLoop = yield* GameLoopService

        yield* gameLoop.initialize()

        yield* gameLoop.onFrame((info) =>
          Effect.sync(() => {
            frameData.push(info)
          })
        )

        yield* gameLoop.tick()
        yield* gameLoop.tick()

        expect(frameData.length).toBe(2)
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should support multiple callbacks', () =>
      Effect.gen(function* () {
        const callback1Data: FrameInfo[] = []
        const callback2Data: FrameInfo[] = []
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

        expect(callback1Data.length).toBe(1)
        expect(callback2Data.length).toBe(1)
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should handle callback removal', () =>
      Effect.gen(function* () {
        const frameData: FrameInfo[] = []
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

        expect(frameData.length).toBe(1)
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should handle callback errors gracefully', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        yield* gameLoop.onFrame(() => Effect.fail(new Error('Callback error')) as unknown as Effect.Effect<void>)

        const result = yield* gameLoop.tick().pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('GameLoopRuntimeError')
        }
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )
  })

  describe('Performance Metrics', () => {
    it.effect('should provide performance metrics when available', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        yield* gameLoop.tick()
        yield* gameLoop.tick()
        const metrics = yield* gameLoop.getPerformanceMetrics()

        expect(metrics.averageFps).toBeCloseTo(60, 0)
        expect(metrics.minFps).toBeGreaterThan(0)
        expect(metrics.maxFps).toBeGreaterThan(0)
        expect(metrics.frameTimeMs).toBeGreaterThan(0)
        expect(metrics.droppedFrames !== undefined).toBe(true)
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should fail when no performance data is available', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        const result = yield* gameLoop.getPerformanceMetrics().pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('GameLoopPerformanceError')
        }
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )
  })

  describe('Configuration Management', () => {
    it.effect('should initialize with default config', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        const state = yield* gameLoop.getState()

        expect(state).toBe('idle')
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should accept custom configuration', () =>
      Effect.gen(function* () {
        const customConfig: Partial<GameLoopConfig> = {
          targetFps: 120,
          maxFrameSkip: 10,
        }

        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize(customConfig)
        const state = yield* gameLoop.getState()

        expect(state).toBe('idle')
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should update configuration dynamically', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.updateConfig({ targetFps: 30 })
        const state = yield* gameLoop.getState()

        expect(state).toBe('idle')
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )
  })

  describe('Tick Function', () => {
    it.effect('should execute single frame with default delta time', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        const frameInfo = yield* gameLoop.tick()

        expect(frameInfo.frameCount !== undefined).toBe(true)
        expect(frameInfo.deltaTime).toBeGreaterThan(0)
        expect(frameInfo.fps).toBeGreaterThan(0)
        expect(frameInfo.frameSkipped).toBe(false)
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should execute single frame with custom delta time', () =>
      Effect.gen(function* () {
        const customDelta = 33.33 // 30 FPS
        const gameLoop = yield* GameLoopService

        yield* gameLoop.initialize()
        const frameInfo = yield* gameLoop.tick(BrandedTypes.createDeltaTime(customDelta))

        expect(frameInfo.deltaTime).toBe(customDelta)
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should increment frame count on each tick', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        const frame1 = yield* gameLoop.tick()
        const frame2 = yield* gameLoop.tick()
        const frame3 = yield* gameLoop.tick()

        expect(frame1.frameCount).toBe(0)
        expect(frame2.frameCount).toBe(1)
        expect(frame3.frameCount).toBe(2)
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )
  })

  describe('Reset Functionality', () => {
    it.effect('should reset to initial state', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        yield* gameLoop.tick()
        yield* gameLoop.tick()
        yield* gameLoop.reset()
        const state = yield* gameLoop.getState()

        expect(state).toBe('idle')
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should clear all callbacks on reset', () =>
      Effect.gen(function* () {
        const frameData: FrameInfo[] = []
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

        expect(frameData.length).toBe(1) // Only first tick should have been recorded
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )
  })

  describe('Error Handling', () => {
    it.effect('should handle initialization errors', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        yield* gameLoop.start()
        const result = yield* gameLoop.initialize().pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('GameLoopInitError')
        }
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should handle state transition errors', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        const result = yield* gameLoop.resume().pipe(Effect.either) // Can't resume when not paused

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('GameLoopStateError')
        }
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should handle runtime errors', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        yield* gameLoop.onFrame(
          () => Effect.fail(new Error('Frame processing error')) as unknown as Effect.Effect<void>
        )

        const result = yield* gameLoop.tick().pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('GameLoopRuntimeError')
        }
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should handle performance errors', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()
        // No frames executed
        const result = yield* gameLoop.getPerformanceMetrics().pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('GameLoopPerformanceError')
        }
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )
  })

  describe('Integration Scenarios', () => {
    it.effect('should handle complete lifecycle', () =>
      Effect.gen(function* () {
        const states: string[] = []
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

        expect(states).toEqual(['idle', 'running', 'paused', 'running', 'stopped'])
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should handle rapid state changes', () =>
      Effect.gen(function* () {
        const gameLoop = yield* GameLoopService
        yield* gameLoop.initialize()

        // Rapid state changes
        yield* gameLoop.start()
        yield* gameLoop.pause()
        yield* gameLoop.resume()
        yield* gameLoop.pause()
        yield* gameLoop.resume()
        yield* gameLoop.stop()

        const state = yield* gameLoop.getState()
        expect(state).toBe('stopped')
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )

    it.effect('should maintain frame consistency during pause/resume', () =>
      Effect.gen(function* () {
        const frameData: FrameInfo[] = []
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

        expect(frameData.length).toBe(2)
        expect(frameData[0]?.frameCount).toBe(0)
        expect(frameData[1]?.frameCount).toBe(1)
      }).pipe(Effect.provide(MockGameLoopServiceLayer))
    )
  })
})
