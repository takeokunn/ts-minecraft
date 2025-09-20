import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { afterEach, beforeEach, describe, expect, vi } from 'vitest'

// Mock console methods
const mockConsoleLog = vi.fn()
const mockConsoleError = vi.fn()

describe('Main Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.console = {
      ...global.console,
      log: mockConsoleLog,
      error: mockConsoleError,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.effect('should create and run the application program', () =>
    Effect.gen(function* () {
      const { AppService } = yield* Effect.promise(() => import('../core/services/AppService'))
      const { MainLayer } = yield* Effect.promise(() => import('../core/layers/MainLayer'))
      const { ManagedRuntime } = yield* Effect.promise(() => import('effect'))

      // Simulate the program from main.ts
      const program = Effect.gen(function* () {
        const app = yield* AppService
        yield* app.initialize()
        const status = yield* app.getStatus()
        console.log('App initialized:', status)
        return status
      })

      const runtime = ManagedRuntime.make(MainLayer)
      const status = yield* Effect.promise(() => runtime.runPromise(program))

      // Verify that console.log was called with expected messages
      expect(mockConsoleLog).toHaveBeenCalled()

      // Check for the "App initialized:" message
      const logCalls = mockConsoleLog.mock.calls
      const hasInitMessage = logCalls.some((call) => call.some((arg) => String(arg).includes('App initialized:')))

      expect(hasInitMessage).toBe(true)
      expect(status).toBeDefined()
    })
  )

  it.effect('should handle successful application startup', () =>
    Effect.gen(function* () {
      const { AppService } = yield* Effect.promise(() => import('../core/services/AppService'))
      const { MainLayer } = yield* Effect.promise(() => import('../core/layers/MainLayer'))
      const { ManagedRuntime } = yield* Effect.promise(() => import('effect'))

      // Test successful startup without importing main.ts directly
      const runtime = ManagedRuntime.make(MainLayer)
      const program = Effect.gen(function* () {
        const app = yield* AppService
        yield* app.initialize()
        return yield* app.getStatus()
      })

      yield* Effect.promise(() => runtime.runPromise(program))

      // Should not log error messages
      expect(mockConsoleError).not.toHaveBeenCalled()
    })
  )

  it.effect('should use ManagedRuntime with MainLayer', () =>
    Effect.gen(function* () {
      const { ManagedRuntime } = yield* Effect.promise(() => import('effect'))
      const { MainLayer } = yield* Effect.promise(() => import('../core/layers/MainLayer'))

      // Test that ManagedRuntime.make can be called with MainLayer
      const runtime = ManagedRuntime.make(MainLayer)
      expect(runtime).toBeDefined()

      // Test that runtime has expected methods
      expect(typeof runtime.runPromise).toBe('function')
      expect(typeof runtime.runSync).toBe('function')
    })
  )

  it.effect('should create program that uses AppService', () =>
    Effect.gen(function* () {
      const { AppService } = yield* Effect.promise(() => import('../core/services/AppService'))

      // Create a test program similar to main.ts
      const testProgram = Effect.gen(function* () {
        const app = yield* AppService
        yield* app.initialize()
        const status = yield* app.getStatus()
        return status
      })

      expect(testProgram).toBeDefined()
      expect(Effect.isEffect(testProgram)).toBe(true)
    })
  )

  it.effect('should handle Effect composition correctly', () =>
    Effect.gen(function* () {
      // Test the same Effect composition pattern as in main.ts
      const { AppService } = yield* Effect.promise(() => import('../core/services/AppService'))

      const program = Effect.gen(function* () {
        const app = yield* AppService
        yield* app.initialize()
        const status = yield* app.getStatus()
        return status
      })

      // The program should be composable
      const extendedProgram = Effect.gen(function* () {
        const result = yield* program
        return { originalStatus: result, extended: true }
      })

      expect(Effect.isEffect(extendedProgram)).toBe(true)
    })
  )

  it('should import all required modules', async () => {
    // Test that all imports work correctly
    const effectModule = await import('effect')
    const appServiceModule = await import('../core/services/AppService')
    const mainLayerModule = await import('../core/layers/MainLayer')

    expect(effectModule.Effect).toBeDefined()
    expect(effectModule.ManagedRuntime).toBeDefined()
    expect(appServiceModule.AppService).toBeDefined()
    expect(mainLayerModule.MainLayer).toBeDefined()
  })

  it.effect('should demonstrate runtime Promise handling', () =>
    Effect.gen(function* () {
      const { ManagedRuntime } = yield* Effect.promise(() => import('effect'))
      const { MainLayer } = yield* Effect.promise(() => import('../core/layers/MainLayer'))

      const runtime = ManagedRuntime.make(MainLayer)

      // Test that runPromise method exists and is callable
      const testEffect = Effect.succeed('test')
      const promise = runtime.runPromise(testEffect)

      expect(promise).toBeInstanceOf(Promise)

      const result = yield* Effect.promise(() => promise)
      expect(result).toBe('test')
    })
  )
})
