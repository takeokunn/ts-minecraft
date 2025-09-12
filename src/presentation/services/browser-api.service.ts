import { Effect, Context, Layer } from 'effect'

/**
 * Browser API Service
 * ブラウザAPIをEffect-TSでラップして安全に使用できるようにする
 * performance.memory, localStorage, Date.now() などを提供
 */

// Error types
export class BrowserApiError extends Error {
  readonly _tag = 'BrowserApiError'
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
  }
}

export class LocalStorageError extends BrowserApiError {
  readonly _tag = 'LocalStorageError'
  constructor(operation: string, cause?: unknown) {
    super(`LocalStorage ${operation} failed`, cause)
  }
}

export class PerformanceError extends BrowserApiError {
  readonly _tag = 'PerformanceError'
  constructor(message: string, cause?: unknown) {
    super(`Performance API error: ${message}`, cause)
  }
}

// Types
export interface MemoryInfo {
  readonly used: number
  readonly total: number
  readonly limit: number
  readonly percentage: number
}

export interface BrowserApiServiceInterface {
  // Memory API
  readonly getMemoryUsage: () => Effect.Effect<MemoryInfo, PerformanceError, never>
  
  // LocalStorage API
  readonly getItem: (key: string) => Effect.Effect<string | null, LocalStorageError, never>
  readonly setItem: (key: string, value: string) => Effect.Effect<void, LocalStorageError, never>
  readonly removeItem: (key: string) => Effect.Effect<void, LocalStorageError, never>
  readonly clear: () => Effect.Effect<void, LocalStorageError, never>
  
  // Time API
  readonly getCurrentTime: () => Effect.Effect<number, never, never>
  readonly getPerformanceNow: () => Effect.Effect<number, PerformanceError, never>
}

// Performance memory interface for type safety
interface PerformanceWithMemory extends Performance {
  memory: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}

const BrowserApiServiceImpl: Effect.Effect<BrowserApiServiceInterface, never, never> = Effect.gen(function* () {
  
  const getMemoryUsage = (): Effect.Effect<MemoryInfo, PerformanceError, never> =>
    Effect.gen(function* () {
      try {
        if (typeof performance !== 'undefined' && 'memory' in performance) {
          const memory = (performance as PerformanceWithMemory).memory
          const used = memory.usedJSHeapSize || 0
          const total = memory.totalJSHeapSize || 0
          const limit = memory.jsHeapSizeLimit || 0
          const percentage = total > 0 ? Math.round((used / total) * 100) : 0
          
          return {
            used,
            total,
            limit,
            percentage,
          }
        } else {
          // フォールバック値
          return {
            used: 0,
            total: 0,
            limit: 0,
            percentage: 0,
          }
        }
      } catch (error) {
        return yield* Effect.fail(new PerformanceError('Failed to get memory usage', error))
      }
    })

  const getItem = (key: string): Effect.Effect<string | null, LocalStorageError, never> =>
    Effect.gen(function* () {
      try {
        if (typeof localStorage === 'undefined') {
          return null
        }
        return localStorage.getItem(key)
      } catch (error) {
        return yield* Effect.fail(new LocalStorageError('getItem', error))
      }
    })

  const setItem = (key: string, value: string): Effect.Effect<void, LocalStorageError, never> =>
    Effect.gen(function* () {
      try {
        if (typeof localStorage === 'undefined') {
          return yield* Effect.fail(new LocalStorageError('setItem - localStorage not available'))
        }
        localStorage.setItem(key, value)
      } catch (error) {
        return yield* Effect.fail(new LocalStorageError('setItem', error))
      }
    })

  const removeItem = (key: string): Effect.Effect<void, LocalStorageError, never> =>
    Effect.gen(function* () {
      try {
        if (typeof localStorage === 'undefined') {
          return yield* Effect.fail(new LocalStorageError('removeItem - localStorage not available'))
        }
        localStorage.removeItem(key)
      } catch (error) {
        return yield* Effect.fail(new LocalStorageError('removeItem', error))
      }
    })

  const clear = (): Effect.Effect<void, LocalStorageError, never> =>
    Effect.gen(function* () {
      try {
        if (typeof localStorage === 'undefined') {
          return yield* Effect.fail(new LocalStorageError('clear - localStorage not available'))
        }
        localStorage.clear()
      } catch (error) {
        return yield* Effect.fail(new LocalStorageError('clear', error))
      }
    })

  const getCurrentTime = (): Effect.Effect<number, never, never> =>
    Effect.succeed(Date.now())

  const getPerformanceNow = (): Effect.Effect<number, PerformanceError, never> =>
    Effect.gen(function* () {
      try {
        if (typeof performance !== 'undefined' && performance.now) {
          return performance.now()
        } else {
          return Date.now()
        }
      } catch (error) {
        return yield* Effect.fail(new PerformanceError('Failed to get performance time', error))
      }
    })

  return {
    getMemoryUsage,
    getItem,
    setItem,
    removeItem,
    clear,
    getCurrentTime,
    getPerformanceNow,
  }
})

// Context tag for dependency injection
export const BrowserApiService = Context.GenericTag<BrowserApiServiceInterface>('BrowserApiService')

// Layer for dependency injection
export const BrowserApiServiceLive: Layer.Layer<BrowserApiService, never, never> = Layer.effect(BrowserApiService, BrowserApiServiceImpl)

// Factory function for direct usage
export const createBrowserApiService = () => Effect.runSync(BrowserApiServiceImpl)