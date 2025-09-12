/**
 * Vitest setup file for infrastructure layer tests
 * Configures test environment and mocks for Effect-TS testing with infrastructure-specific concerns
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { Effect, TestClock, TestContext, Layer } from 'effect'
import type { Canvas } from 'canvas'

// Mock WebGL context and Three.js dependencies
beforeAll(() => {
  // Mock performance API
  if (typeof global.performance === 'undefined') {
    global.performance = {
      now: vi.fn(() => Date.now()),
      memory: {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000,
        jsHeapSizeLimit: 4000000
      },
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByName: vi.fn(() => []),
      getEntriesByType: vi.fn(() => []),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn()
    } as any
  }

  // Mock console methods for consistent testing
  global.console = {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }

  // Mock WebGL context
  const mockWebGLContext = {
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    useProgram: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    vertexAttribPointer: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    drawArrays: vi.fn(),
    drawElements: vi.fn(),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    getExtension: vi.fn(() => null),
    getSupportedExtensions: vi.fn(() => []),
    getParameter: vi.fn(() => 'WebGL Mock'),
    createTexture: vi.fn(() => ({})),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    generateMipmap: vi.fn(),
    activeTexture: vi.fn(),
    uniform1i: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4f: vi.fn(),
    uniformMatrix4fv: vi.fn(),
    getUniformLocation: vi.fn(() => ({})),
    getAttribLocation: vi.fn(() => 0)
  }

  // Mock HTMLCanvasElement
  if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
        return mockWebGLContext
      }
      if (type === '2d') {
        return {
          fillRect: vi.fn(),
          clearRect: vi.fn(),
          getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
          putImageData: vi.fn(),
          createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
          setTransform: vi.fn(),
          drawImage: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          closePath: vi.fn(),
          stroke: vi.fn(),
          fill: vi.fn(),
          measureText: vi.fn(() => ({ width: 100 })),
          canvas: document.createElement('canvas')
        }
      }
      return null
    })
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,')
  }

  // Mock WebGPU
  if (typeof global.navigator === 'undefined') {
    global.navigator = {} as any
  }
  global.navigator.gpu = {
    requestAdapter: vi.fn(() => Promise.resolve({
      requestDevice: vi.fn(() => Promise.resolve({
        createShaderModule: vi.fn(() => ({})),
        createRenderPipeline: vi.fn(() => ({})),
        createBuffer: vi.fn(() => ({})),
        createTexture: vi.fn(() => ({})),
        createCommandEncoder: vi.fn(() => ({
          beginRenderPass: vi.fn(() => ({
            end: vi.fn(),
            setBindGroup: vi.fn(),
            setPipeline: vi.fn(),
            draw: vi.fn()
          })),
          finish: vi.fn(() => ({}))
        })),
        queue: {
          submit: vi.fn(),
          writeBuffer: vi.fn(),
          writeTexture: vi.fn()
        }
      }))
    }))
  } as any

  // Mock Worker constructor
  global.Worker = vi.fn().mockImplementation((url: string) => ({
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onmessage: null,
    onerror: null,
    onmessageerror: null
  })) as any

  // Mock URL.createObjectURL for worker blob URLs
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  global.URL.revokeObjectURL = vi.fn()

  // Mock OffscreenCanvas
  global.OffscreenCanvas = vi.fn().mockImplementation(() => ({
    getContext: vi.fn(() => mockWebGLContext),
    convertToBlob: vi.fn(() => Promise.resolve(new Blob())),
    transferControlToOffscreen: vi.fn()
  })) as any

  // Mock ImageData
  if (typeof global.ImageData === 'undefined') {
    global.ImageData = vi.fn().mockImplementation((data, width, height) => ({
      data: data || new Uint8ClampedArray(width * height * 4),
      width: width || 1,
      height: height || 1
    })) as any
  }

  // Mock WebSocket
  global.WebSocket = vi.fn().mockImplementation((url: string) => ({
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1, // OPEN
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
    url,
    protocol: '',
    extensions: '',
    bufferedAmount: 0,
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null
  })) as any

  // Mock requestAnimationFrame
  global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16))
  global.cancelAnimationFrame = vi.fn()

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }))

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: []
  }))
})

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks()
  
  // Reset performance.now to return consistent values
  if (vi.isMockFunction(performance.now)) {
    performance.now = vi.fn(() => 0)
  }
  
  // Reset any worker-related mocks
  vi.clearAllTimers()
})

afterEach(() => {
  // Clean up any timers or async operations
  vi.clearAllTimers()
  
  // Clean up any created workers
  if (global.Worker) {
    vi.mocked(global.Worker).mockClear()
  }
})

afterAll(() => {
  // Restore all mocks
  vi.restoreAllMocks()
})

// Helper functions for Effect-TS testing
export const runEffect = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => 
  Effect.runPromise(effect)

export const runEffectSync = <A, E>(effect: Effect.Effect<A, E>): A => 
  Effect.runSync(effect)

export const runEffectExit = <A, E>(effect: Effect.Effect<A, E>) => 
  Effect.runPromiseExit(effect)

// TestClock helpers for time-based testing
export const withTestClock = <A, E>(
  effect: Effect.Effect<A, E, TestClock.TestClock>
): Effect.Effect<A, E> => 
  Effect.provide(effect, TestClock.TestClock)

// Layer testing helpers
export const testLayer = <R, E, A>(layer: Layer.Layer<A, E, R>) =>
  Layer.build(layer)

export const withTestLayer = <R, E, A, B>(
  layer: Layer.Layer<A, E, R>,
  effect: Effect.Effect<B, E, A>
): Effect.Effect<B, E, R> =>
  Effect.provide(effect, layer)

// Common test utilities for infrastructure
export const expectEffect = {
  toSucceed: async <A>(effect: Effect.Effect<A, any>) => {
    const result = await runEffectExit(effect)
    expect(result._tag).toBe('Success')
    return result._tag === 'Success' ? result.value : undefined
  },
  
  toFail: async <E>(effect: Effect.Effect<any, E>) => {
    const result = await runEffectExit(effect)
    expect(result._tag).toBe('Failure')
    return result._tag === 'Failure' ? result.cause : undefined
  },
  
  toFailWith: async <E>(effect: Effect.Effect<any, E>, expectedError: E) => {
    const result = await runEffectExit(effect)
    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      expect(result.cause).toEqual(expectedError)
    }
  }
}

// Mock factories for infrastructure components
export const createMockCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 600
  return canvas
}

export const createMockWebGLContext = () => mockWebGLContext

export const createMockWorker = (url?: string) => new Worker(url || 'mock-worker.js')

// Performance testing utilities
export const measureEffectPerformance = async <A, E>(
  effect: Effect.Effect<A, E>,
  label: string
): Promise<{ result: A; duration: number }> => {
  const start = performance.now()
  const result = await runEffect(effect)
  const duration = performance.now() - start
  
  console.log(`Performance [${label}]: ${duration.toFixed(2)}ms`)
  
  return { result, duration }
}

// Memory testing utilities
export const trackMemoryUsage = (testName: string) => {
  const initial = performance.memory?.usedJSHeapSize || 0
  
  return {
    finish: () => {
      const final = performance.memory?.usedJSHeapSize || 0
      const diff = final - initial
      console.log(`Memory usage [${testName}]: ${diff} bytes`)
      return diff
    }
  }
}