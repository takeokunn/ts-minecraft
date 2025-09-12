/**
 * Vitest setup file for presentation layer tests
 * Provides Effect-TS testing utilities, DOM mocks, and presentation-specific test helpers
 */

import { beforeAll, beforeEach, afterEach, vi } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as TestClock from 'effect/TestClock'
import * as Runtime from 'effect/Runtime'

// Mock DOM and browser APIs for presentation layer testing
beforeAll(() => {
  // Mock performance API if not available
  if (typeof global.performance === 'undefined') {
    global.performance = {
      now: () => Date.now(),
      memory: {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000,
        jsHeapSizeLimit: 4000000
      }
    } as any
  }

  // Mock PerformanceObserver
  if (typeof global.PerformanceObserver === 'undefined') {
    global.PerformanceObserver = class {
      observe() {}
      disconnect() {}
      takeRecords() { return [] }
    } as any
  }

  // Mock ResizeObserver for UI components
  if (typeof global.ResizeObserver === 'undefined') {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any
  }

  // Mock IntersectionObserver for viewport-related tests
  if (typeof global.IntersectionObserver === 'undefined') {
    global.IntersectionObserver = class {
      constructor(callback: any, options?: any) {}
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any
  }

  // Mock requestAnimationFrame and cancelAnimationFrame
  if (typeof global.requestAnimationFrame === 'undefined') {
    global.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      return setTimeout(callback, 16) as unknown as number
    }
  }

  if (typeof global.cancelAnimationFrame === 'undefined') {
    global.cancelAnimationFrame = (id: number): void => {
      clearTimeout(id)
    }
  }

  // Mock localStorage and sessionStorage
  const createStorageMock = () => ({
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  })

  if (typeof global.localStorage === 'undefined') {
    global.localStorage = createStorageMock() as any
  }

  if (typeof global.sessionStorage === 'undefined') {
    global.sessionStorage = createStorageMock() as any
  }

  // Mock WebGL context for 3D rendering tests
  const mockWebGLContext = {
    canvas: null,
    getParameter: vi.fn(),
    createShader: vi.fn(),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    createProgram: vi.fn(),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    useProgram: vi.fn(),
    createBuffer: vi.fn(),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    createTexture: vi.fn(),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    drawElements: vi.fn(),
    drawArrays: vi.fn(),
    viewport: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    // Add more WebGL methods as needed
  }

  // Mock HTMLCanvasElement.getContext
  if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = vi.fn((contextType) => {
      if (contextType === 'webgl' || contextType === 'webgl2') {
        return mockWebGLContext
      }
      if (contextType === '2d') {
        return {
          fillRect: vi.fn(),
          clearRect: vi.fn(),
          fillText: vi.fn(),
          measureText: vi.fn(() => ({ width: 100 })),
          drawImage: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          translate: vi.fn(),
          rotate: vi.fn(),
          scale: vi.fn(),
        }
      }
      return null
    })
  }
})

// Clean up mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Effect-TS testing utilities
const runtime = Runtime.defaultRuntime

/**
 * Run an effect and return the result as a Promise
 */
export const runEffect = <A, E = never>(effect: Effect.Effect<A, E, never>): Promise<A> =>
  Effect.runPromise(effect)

/**
 * Run an effect synchronously and return the result
 */
export const runEffectSync = <A>(effect: Effect.Effect<A, never, never>): A =>
  Effect.runSync(effect)

/**
 * Run an effect and return the Exit result
 */
export const runEffectExit = <A, E = never>(effect: Effect.Effect<A, E, never>): Promise<Exit.Exit<A, E>> =>
  Effect.runPromiseExit(effect)

/**
 * Run an effect with TestClock
 */
export const withTestClock = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, never> =>
  Effect.provide(effect, TestClock.TestClock)

/**
 * Enhanced expect utilities for Effect testing in presentation layer
 */
export const expectEffect = {
  /**
   * Expect an effect to succeed with a specific value
   */
  toSucceedWith: async <A>(effect: Effect.Effect<A, unknown, never>, expected: A): Promise<void> => {
    const result = await runEffect(effect)
    expect(result).toEqual(expected)
  },

  /**
   * Expect an effect to fail
   */
  toFail: async <E>(effect: Effect.Effect<unknown, E, never>): Promise<void> => {
    const exit = await runEffectExit(effect)
    expect(Exit.isFailure(exit)).toBe(true)
  },

  /**
   * Expect an effect to fail with a specific error
   */
  toFailWith: async <E>(effect: Effect.Effect<unknown, E, never>, expectedError: E): Promise<void> => {
    const exit = await runEffectExit(effect)
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(exit.cause._tag).toBe('Fail')
      if (exit.cause._tag === 'Fail') {
        expect(exit.cause.error).toEqual(expectedError)
      }
    }
  },

  /**
   * Expect an effect to succeed
   */
  toSucceed: async <A>(effect: Effect.Effect<A, unknown, never>): Promise<void> => {
    const exit = await runEffectExit(effect)
    expect(Exit.isSuccess(exit)).toBe(true)
  }
}

/**
 * Mock utilities for presentation layer components
 */
export const mockUtils = {
  /**
   * Create a mock canvas element with basic properties
   */
  createMockCanvas: (width = 800, height = 600) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  },

  /**
   * Create a mock DOM element with common properties
   */
  createMockElement: (tagName = 'div', attributes: Record<string, string> = {}) => {
    const element = document.createElement(tagName)
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value)
    })
    return element
  },

  /**
   * Mock keyboard event
   */
  createKeyboardEvent: (type: string, key: string, options: KeyboardEventInit = {}) => {
    return new KeyboardEvent(type, { key, ...options })
  },

  /**
   * Mock mouse event
   */
  createMouseEvent: (type: string, options: MouseEventInit = {}) => {
    return new MouseEvent(type, options)
  },

  /**
   * Mock pointer event
   */
  createPointerEvent: (type: string, options: PointerEventInit = {}) => {
    return new PointerEvent(type, options)
  }
}

/**
 * Testing utilities for async rendering operations
 */
export const renderUtils = {
  /**
   * Wait for the next animation frame
   */
  waitForNextFrame: (): Promise<void> => {
    return new Promise(resolve => requestAnimationFrame(() => resolve()))
  },

  /**
   * Wait for multiple animation frames
   */
  waitForFrames: (count: number): Promise<void> => {
    return new Promise(resolve => {
      let frameCount = 0
      const frame = () => {
        frameCount++
        if (frameCount >= count) {
          resolve()
        } else {
          requestAnimationFrame(frame)
        }
      }
      requestAnimationFrame(frame)
    })
  },

  /**
   * Wait for a specific time using fake timers
   */
  waitFor: async (ms: number): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Re-export vitest utilities for convenience
export { expect, vi, describe, it, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'