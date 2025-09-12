import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Effect, Layer } from 'effect'
import {
  CapabilityDetectionService,
  CapabilityDetectionServiceLive,
  CapabilityDetectionServiceTest,
  CapabilityDetectionError,
  type Capabilities,
  shouldUseWebGPU,
  shouldUseWorkers,
  shouldUseSharedArrayBuffer,
  getRecommendedTextureSize,
  getRecommendedParticleCount,
} from '../../services/capability-detection.service'

// Mock browser APIs
const mockCanvas = {
  getContext: vi.fn() as any,
}

const mockWebGL2Context = {
  getExtension: vi.fn(() => ({ loseContext: vi.fn() })) as any,
}

const mockWebGPUAdapter = {
  requestDevice: vi.fn() as any,
  features: new Set(['texture-compression-bc']),
  limits: { maxBindGroups: 4 },
}

const mockNavigator = {
  gpu: {
    requestAdapter: vi.fn() as any,
  },
  hardwareConcurrency: 4,
  deviceMemory: 8,
  maxTouchPoints: 0,
  connection: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    saveData: false,
  },
  mozConnection: undefined,
  webkitConnection: undefined,
}

const mockDocument = {
  createElement: vi.fn(() => mockCanvas) as any,
}

// Setup global mocks
Object.defineProperty(global, 'document', { value: mockDocument, writable: true })
Object.defineProperty(global, 'navigator', { value: mockNavigator, writable: true })
Object.defineProperty(global, 'Worker', { value: vi.fn(), writable: true })
Object.defineProperty(global, 'SharedArrayBuffer', { value: vi.fn(), writable: true })
Object.defineProperty(global, 'Atomics', { value: {}, writable: true })
Object.defineProperty(global, 'OffscreenCanvas', { value: vi.fn(), writable: true })
Object.defineProperty(global, 'createImageBitmap', { value: vi.fn(), writable: true })
Object.defineProperty(global, 'WebAssembly', { 
  value: { instantiate: vi.fn() }, 
  writable: true 
})

// Mock self.crossOriginIsolated
Object.defineProperty(global, 'self', { 
  value: { crossOriginIsolated: false }, 
  writable: true 
})

describe('CapabilityDetectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mocks to working state
    mockCanvas.getContext.mockReturnValue(mockWebGL2Context)
    mockNavigator.gpu.requestAdapter.mockResolvedValue(mockWebGPUAdapter)
    mockDocument.createElement.mockReturnValue(mockCanvas)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Live Service Implementation', () => {
    describe('WebGL2 Detection', () => {
      it('should detect WebGL2 support when available', async () => {
        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectWebGL2
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(true)
        expect(mockDocument.createElement).toHaveBeenCalledWith('canvas')
        expect(mockCanvas.getContext).toHaveBeenCalledWith('webgl2')
      })

      it('should handle WebGL2 unavailability', async () => {
        mockCanvas.getContext.mockReturnValue(null)

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectWebGL2
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(false)
      })

      it('should handle document unavailability (server-side)', async () => {
        Object.defineProperty(global, 'document', { value: undefined, writable: true })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectWebGL2
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(false)
        
        // Restore document
        Object.defineProperty(global, 'document', { value: mockDocument, writable: true })
      })

      it('should properly clean up WebGL context', async () => {
        const mockLoseContext = vi.fn()
        mockWebGL2Context.getExtension.mockReturnValue({ loseContext: mockLoseContext })

        await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectWebGL2
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(mockWebGL2Context.getExtension).toHaveBeenCalledWith('WEBGL_lose_context')
        expect(mockLoseContext).toHaveBeenCalled()
      })

      it('should handle WebGL context creation errors', async () => {
        mockCanvas.getContext.mockImplementation(() => {
          throw new Error('WebGL creation failed')
        })

        const exit = await Effect.runPromiseExit(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectWebGL2
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(exit._tag).toBe('Failure')
      })
    })

    describe('WebGPU Detection', () => {
      it('should detect WebGPU support when available', async () => {
        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectWebGPU
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(true)
        expect(mockNavigator.gpu.requestAdapter).toHaveBeenCalled()
      })

      it('should handle WebGPU unavailability', async () => {
        mockNavigator.gpu.requestAdapter.mockResolvedValue(null)

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectWebGPU
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(false)
      })

      it('should handle missing gpu property', async () => {
        const originalGpu = mockNavigator.gpu
        delete (mockNavigator as any).gpu

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectWebGPU
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(false)
        
        // Restore gpu property
        mockNavigator.gpu = originalGpu
      })

      it('should handle navigator unavailability (server-side)', async () => {
        Object.defineProperty(global, 'navigator', { value: undefined, writable: true })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectWebGPU
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(false)
        
        // Restore navigator
        Object.defineProperty(global, 'navigator', { value: mockNavigator, writable: true })
      })

      it('should handle WebGPU adapter request errors', async () => {
        mockNavigator.gpu.requestAdapter.mockRejectedValue(new Error('WebGPU not supported'))

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectWebGPU
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(false)
      })
    })

    describe('Workers Detection', () => {
      it('should detect Worker support when available', async () => {
        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectWorkers
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(true)
      })

      it('should handle Worker unavailability', async () => {
        Object.defineProperty(global, 'Worker', { value: undefined, writable: true })
        Object.defineProperty(global, 'window', { value: undefined, writable: true })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectWorkers
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(false)
        
        // Restore Worker
        Object.defineProperty(global, 'Worker', { value: vi.fn(), writable: true })
        Object.defineProperty(global, 'window', { value: {}, writable: true })
      })
    })

    describe('SharedArrayBuffer Detection', () => {
      it('should detect SharedArrayBuffer support when available and cross-origin isolated', async () => {
        Object.defineProperty(global, 'self', { 
          value: { crossOriginIsolated: true }, 
          writable: true 
        })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectSharedArrayBuffer
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(true)
      })

      it('should return false when not cross-origin isolated', async () => {
        Object.defineProperty(global, 'self', { 
          value: { crossOriginIsolated: false }, 
          writable: true 
        })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectSharedArrayBuffer
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(false)
      })

      it('should handle SharedArrayBuffer unavailability', async () => {
        Object.defineProperty(global, 'SharedArrayBuffer', { value: undefined, writable: true })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectSharedArrayBuffer
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(false)
        
        // Restore SharedArrayBuffer
        Object.defineProperty(global, 'SharedArrayBuffer', { value: vi.fn(), writable: true })
      })

      it('should handle Atomics unavailability', async () => {
        Object.defineProperty(global, 'Atomics', { value: undefined, writable: true })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectSharedArrayBuffer
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(false)
        
        // Restore Atomics
        Object.defineProperty(global, 'Atomics', { value: {}, writable: true })
      })
    })

    describe('OffscreenCanvas Detection', () => {
      it('should detect OffscreenCanvas support when available', async () => {
        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectOffscreenCanvas
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(true)
      })

      it('should handle OffscreenCanvas unavailability', async () => {
        Object.defineProperty(global, 'OffscreenCanvas', { value: undefined, writable: true })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectOffscreenCanvas
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(false)
        
        // Restore OffscreenCanvas
        Object.defineProperty(global, 'OffscreenCanvas', { value: vi.fn(), writable: true })
      })
    })

    describe('ImageBitmap Detection', () => {
      it('should detect ImageBitmap support when available', async () => {
        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectImageBitmap
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(true)
      })

      it('should handle ImageBitmap unavailability', async () => {
        Object.defineProperty(global, 'createImageBitmap', { value: undefined, writable: true })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectImageBitmap
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(false)
        
        // Restore createImageBitmap
        Object.defineProperty(global, 'createImageBitmap', { value: vi.fn(), writable: true })
      })
    })

    describe('WebAssembly Detection', () => {
      it('should detect WebAssembly support when available', async () => {
        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectWebAssembly
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(true)
      })

      it('should handle WebAssembly unavailability', async () => {
        Object.defineProperty(global, 'WebAssembly', { value: undefined, writable: true })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectWebAssembly
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(false)
        
        // Restore WebAssembly
        Object.defineProperty(global, 'WebAssembly', { 
          value: { instantiate: vi.fn() }, 
          writable: true 
        })
      })

      it('should handle missing WebAssembly.instantiate', async () => {
        Object.defineProperty(global, 'WebAssembly', { value: {}, writable: true })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectWebAssembly
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(false)
        
        // Restore WebAssembly
        Object.defineProperty(global, 'WebAssembly', { 
          value: { instantiate: vi.fn() }, 
          writable: true 
        })
      })
    })

    describe('Device Memory Detection', () => {
      it('should detect device memory when available', async () => {
        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectDeviceMemory
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(8)
      })

      it('should return null when device memory is unavailable', async () => {
        delete (mockNavigator as any).deviceMemory

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectDeviceMemory
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(null)
        
        // Restore deviceMemory
        mockNavigator.deviceMemory = 8
      })

      it('should handle navigator unavailability', async () => {
        Object.defineProperty(global, 'navigator', { value: undefined, writable: true })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectDeviceMemory
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(null)
        
        // Restore navigator
        Object.defineProperty(global, 'navigator', { value: mockNavigator, writable: true })
      })
    })

    describe('Hardware Concurrency Detection', () => {
      it('should detect hardware concurrency when available', async () => {
        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectHardwareConcurrency
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(4)
      })

      it('should return default when hardware concurrency is unavailable', async () => {
        delete (mockNavigator as any).hardwareConcurrency

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectHardwareConcurrency
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(4) // Default fallback
        
        // Restore hardwareConcurrency
        mockNavigator.hardwareConcurrency = 4
      })

      it('should handle navigator unavailability', async () => {
        Object.defineProperty(global, 'navigator', { value: undefined, writable: true })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectHardwareConcurrency
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(4) // Default fallback
        
        // Restore navigator
        Object.defineProperty(global, 'navigator', { value: mockNavigator, writable: true })
      })
    })

    describe('Max Touch Points Detection', () => {
      it('should detect max touch points when available', async () => {
        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectMaxTouchPoints
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(0) // Desktop device
      })

      it('should return 0 when max touch points is unavailable', async () => {
        delete (mockNavigator as any).maxTouchPoints

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectMaxTouchPoints
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(0)
        
        // Restore maxTouchPoints
        mockNavigator.maxTouchPoints = 0
      })

      it('should handle mobile device', async () => {
        mockNavigator.maxTouchPoints = 5

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectMaxTouchPoints
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(5)
        
        // Restore to desktop
        mockNavigator.maxTouchPoints = 0
      })
    })

    describe('Network Information Detection', () => {
      it('should detect network information when available', async () => {
        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectNetworkInformation
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toEqual({
          effectiveType: '4g',
          downlink: 10,
          rtt: 100,
          saveData: false,
        })
      })

      it('should handle missing connection property', async () => {
        delete (mockNavigator as any).connection

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectNetworkInformation
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toEqual({
          effectiveType: null,
          downlink: null,
          rtt: null,
          saveData: false,
        })
        
        // Restore connection
        mockNavigator.connection = {
          effectiveType: '4g',
          downlink: 10,
          rtt: 100,
          saveData: false,
        }
      })

      it('should handle vendor-prefixed connection properties', async () => {
        delete (mockNavigator as any).connection
        mockNavigator.mozConnection = {
          effectiveType: '3g',
          downlink: 5,
          rtt: 200,
          saveData: true,
        }

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectNetworkInformation
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toEqual({
          effectiveType: '3g',
          downlink: 5,
          rtt: 200,
          saveData: true,
        })
        
        // Restore connection
        delete mockNavigator.mozConnection
        mockNavigator.connection = {
          effectiveType: '4g',
          downlink: 10,
          rtt: 100,
          saveData: false,
        }
      })

      it('should handle navigator unavailability', async () => {
        Object.defineProperty(global, 'navigator', { value: undefined, writable: true })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectNetworkInformation
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toEqual({
          effectiveType: null,
          downlink: null,
          rtt: null,
          saveData: false,
        })
        
        // Restore navigator
        Object.defineProperty(global, 'navigator', { value: mockNavigator, writable: true })
      })
    })

    describe('Comprehensive Capability Detection', () => {
      it('should detect all capabilities at once', async () => {
        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectAll
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBeDefined()
        expect(typeof result.webgl2).toBe('boolean')
        expect(typeof result.webgpu).toBe('boolean')
        expect(typeof result.workers).toBe('boolean')
        expect(typeof result.sharedArrayBuffer).toBe('boolean')
        expect(typeof result.offscreenCanvas).toBe('boolean')
        expect(typeof result.imagebitmap).toBe('boolean')
        expect(typeof result.webassembly).toBe('boolean')
        expect(typeof result.hardwareConcurrency).toBe('number')
        expect(typeof result.maxTouchPoints).toBe('number')
        expect(result.connection).toBeDefined()
        expect(typeof result.connection.saveData).toBe('boolean')
        
        // Device memory can be number or null
        expect(result.deviceMemory === null || typeof result.deviceMemory === 'number').toBe(true)
      })
    })

    describe('Optimal Configuration Generation', () => {
      it('should get optimal worker count', async () => {
        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.getOptimalWorkerCount
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(typeof result).toBe('number')
        expect(result).toBeGreaterThanOrEqual(0)
        expect(result).toBeLessThanOrEqual(8) // Capped at 8
      })

      it('should return 0 workers when workers not supported', async () => {
        Object.defineProperty(global, 'Worker', { value: undefined, writable: true })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.getOptimalWorkerCount
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(0)
        
        // Restore Worker
        Object.defineProperty(global, 'Worker', { value: vi.fn(), writable: true })
      })

      it('should adjust worker count based on device memory', async () => {
        // Test with low memory device
        mockNavigator.deviceMemory = 2

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.getOptimalWorkerCount
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBeLessThanOrEqual(2) // Should be reduced for low memory
        
        // Restore device memory
        mockNavigator.deviceMemory = 8
      })

      it('should get optimal memory settings', async () => {
        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.getOptimalMemorySettings
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBeDefined()
        expect(typeof result.maxHeapSize).toBe('number')
        expect(typeof result.gcThreshold).toBe('number')
        expect(result.maxHeapSize).toBeGreaterThan(0)
        expect(result.gcThreshold).toBeGreaterThan(0)
        expect(result.gcThreshold).toBeLessThan(1)
      })

      it('should adjust memory settings for save-data connections', async () => {
        mockNavigator.connection.saveData = true

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.getOptimalMemorySettings
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result.gcThreshold).toBeGreaterThan(0.8) // More aggressive GC
        
        // Restore saveData
        mockNavigator.connection.saveData = false
      })

      it('should adjust memory settings for slow connections', async () => {
        mockNavigator.connection.effectiveType = 'slow-2g'

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.getOptimalMemorySettings
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result.gcThreshold).toBeGreaterThan(0.8) // More aggressive GC
        
        // Restore connection type
        mockNavigator.connection.effectiveType = '4g'
      })
    })

    describe('Device Classification', () => {
      it('should identify low-end devices', async () => {
        // Set up low-end device characteristics
        mockNavigator.deviceMemory = 2
        mockNavigator.hardwareConcurrency = 2
        mockNavigator.connection.saveData = true

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.isLowEndDevice
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(true)
        
        // Restore high-end characteristics
        mockNavigator.deviceMemory = 8
        mockNavigator.hardwareConcurrency = 4
        mockNavigator.connection.saveData = false
      })

      it('should identify high-end devices', async () => {
        // Ensure high-end device characteristics
        mockNavigator.deviceMemory = 16
        mockNavigator.hardwareConcurrency = 8
        mockNavigator.connection.saveData = false
        mockNavigator.connection.effectiveType = '4g'

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.isLowEndDevice
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(false)
        
        // Restore default characteristics
        mockNavigator.deviceMemory = 8
        mockNavigator.hardwareConcurrency = 4
      })

      it('should identify mobile devices by touch points', async () => {
        mockNavigator.maxTouchPoints = 5

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.isMobileDevice
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(true)
        
        // Restore desktop characteristics
        mockNavigator.maxTouchPoints = 0
      })

      it('should identify mobile devices by user agent', async () => {
        mockNavigator.maxTouchPoints = 0 // No touch points
        Object.defineProperty(mockNavigator, 'userAgent', {
          value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7 like Mac OS X)',
          writable: true,
        })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.isMobileDevice
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(true)
      })

      it('should identify desktop devices', async () => {
        mockNavigator.maxTouchPoints = 0
        Object.defineProperty(mockNavigator, 'userAgent', {
          value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          writable: true,
        })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.isMobileDevice
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(false)
      })
    })
  })

  describe('Test Service Implementation', () => {
    it('should provide consistent test data', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* CapabilityDetectionService
          return yield* service.detectAll
        }).pipe(Effect.provide(CapabilityDetectionServiceTest))
      )

      // Test implementation should return consistent, predictable results
      expect(result).toEqual({
        webgl2: true,
        webgpu: false,
        workers: true,
        sharedArrayBuffer: false,
        offscreenCanvas: true,
        imagebitmap: true,
        webassembly: true,
        deviceMemory: 8,
        hardwareConcurrency: 4,
        maxTouchPoints: 0,
        connection: {
          effectiveType: '4g',
          downlink: 10,
          rtt: 100,
          saveData: false,
        },
      })
    })

    it('should provide optimal settings for testing', async () => {
      const results = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* CapabilityDetectionService
          const workerCount = yield* service.getOptimalWorkerCount
          const memorySettings = yield* service.getOptimalMemorySettings
          const isLowEnd = yield* service.isLowEndDevice
          const isMobile = yield* service.isMobileDevice

          return { workerCount, memorySettings, isLowEnd, isMobile }
        }).pipe(Effect.provide(CapabilityDetectionServiceTest))
      )

      expect(results.workerCount).toBe(4)
      expect(results.memorySettings).toEqual({
        maxHeapSize: 2048,
        gcThreshold: 0.75,
      })
      expect(results.isLowEnd).toBe(false)
      expect(results.isMobile).toBe(false)
    })
  })

  describe('Utility Functions', () => {
    const mockCapabilities: Capabilities = {
      webgl2: true,
      webgpu: true,
      workers: true,
      sharedArrayBuffer: true,
      offscreenCanvas: true,
      imagebitmap: true,
      webassembly: true,
      deviceMemory: 8,
      hardwareConcurrency: 4,
      maxTouchPoints: 0,
      connection: {
        effectiveType: '4g',
        downlink: 10,
        rtt: 100,
        saveData: false,
      },
    }

    describe('shouldUseWebGPU', () => {
      it('should recommend WebGPU for high-end devices', () => {
        expect(shouldUseWebGPU(mockCapabilities)).toBe(true)
      })

      it('should not recommend WebGPU with save-data enabled', () => {
        const lowDataCapabilities = {
          ...mockCapabilities,
          connection: { ...mockCapabilities.connection, saveData: true },
        }
        expect(shouldUseWebGPU(lowDataCapabilities)).toBe(false)
      })

      it('should not recommend WebGPU when unavailable', () => {
        const noWebGPUCapabilities = { ...mockCapabilities, webgpu: false }
        expect(shouldUseWebGPU(noWebGPUCapabilities)).toBe(false)
      })
    })

    describe('shouldUseWorkers', () => {
      it('should recommend workers for multi-core devices', () => {
        expect(shouldUseWorkers(mockCapabilities)).toBe(true)
      })

      it('should not recommend workers for low-core devices', () => {
        const lowCoreCapabilities = { ...mockCapabilities, hardwareConcurrency: 2 }
        expect(shouldUseWorkers(lowCoreCapabilities)).toBe(false)
      })

      it('should not recommend workers when unavailable', () => {
        const noWorkersCapabilities = { ...mockCapabilities, workers: false }
        expect(shouldUseWorkers(noWorkersCapabilities)).toBe(false)
      })
    })

    describe('shouldUseSharedArrayBuffer', () => {
      it('should recommend SharedArrayBuffer for high-end devices', () => {
        const highEndCapabilities = { ...mockCapabilities, hardwareConcurrency: 8 }
        expect(shouldUseSharedArrayBuffer(highEndCapabilities)).toBe(true)
      })

      it('should not recommend SharedArrayBuffer for low-core devices', () => {
        expect(shouldUseSharedArrayBuffer(mockCapabilities)).toBe(false) // 4 cores, needs >4
      })

      it('should not recommend SharedArrayBuffer when unavailable', () => {
        const noSABCapabilities = { 
          ...mockCapabilities, 
          sharedArrayBuffer: false,
          hardwareConcurrency: 8,
        }
        expect(shouldUseSharedArrayBuffer(noSABCapabilities)).toBe(false)
      })
    })

    describe('getRecommendedTextureSize', () => {
      it('should recommend appropriate texture sizes based on device memory', () => {
        expect(getRecommendedTextureSize(mockCapabilities)).toBe(2048) // 8GB device
        
        const lowMemoryCapabilities = { ...mockCapabilities, deviceMemory: 2 }
        expect(getRecommendedTextureSize(lowMemoryCapabilities)).toBe(512)
        
        const midMemoryCapabilities = { ...mockCapabilities, deviceMemory: 4 }
        expect(getRecommendedTextureSize(midMemoryCapabilities)).toBe(1024)
      })

      it('should reduce texture size for save-data connections', () => {
        const saveDataCapabilities = {
          ...mockCapabilities,
          connection: { ...mockCapabilities.connection, saveData: true },
        }
        expect(getRecommendedTextureSize(saveDataCapabilities)).toBe(512)
      })

      it('should handle devices without device memory info', () => {
        const noMemoryCapabilities = { ...mockCapabilities, deviceMemory: null }
        expect(getRecommendedTextureSize(noMemoryCapabilities)).toBe(2048) // Default for unknown
      })
    })

    describe('getRecommendedParticleCount', () => {
      it('should recommend appropriate particle counts based on device memory', () => {
        expect(getRecommendedParticleCount(mockCapabilities)).toBe(1000) // 8GB device
        
        const lowMemoryCapabilities = { ...mockCapabilities, deviceMemory: 2 }
        expect(getRecommendedParticleCount(lowMemoryCapabilities)).toBe(250)
        
        const midMemoryCapabilities = { ...mockCapabilities, deviceMemory: 4 }
        expect(getRecommendedParticleCount(midMemoryCapabilities)).toBe(500)
      })

      it('should reduce particle count for save-data connections', () => {
        const saveDataCapabilities = {
          ...mockCapabilities,
          connection: { ...mockCapabilities.connection, saveData: true },
        }
        expect(getRecommendedParticleCount(saveDataCapabilities)).toBe(250)
      })
    })
  })

  describe('Error Handling', () => {
    it('should create proper capability detection errors', async () => {
      mockCanvas.getContext.mockImplementation(() => {
        throw new Error('Canvas context creation failed')
      })

      const exit = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const service = yield* CapabilityDetectionService
          return yield* service.detectWebGL2
        }).pipe(Effect.provide(CapabilityDetectionServiceLive))
      )

      expect(exit._tag).toBe('Failure')
      if (exit._tag === 'Failure') {
        expect(exit.cause._tag).toBe('Fail')
        if (exit.cause._tag === 'Fail') {
          expect(exit.cause.error).toBeInstanceOf(CapabilityDetectionError)
          expect(exit.cause.error.capability).toBe('webgl2')
          expect(exit.cause.error.message).toContain('Failed to detect WebGL2 support')
        }
      }
    })

    it('should handle detection errors gracefully in detectAll', async () => {
      // Mock some detections to fail
      mockCanvas.getContext.mockImplementation(() => {
        throw new Error('Context creation failed')
      })

      const exit = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const service = yield* CapabilityDetectionService
          return yield* service.detectAll
        }).pipe(Effect.provide(CapabilityDetectionServiceLive))
      )

      // detectAll should fail if any individual detection fails
      expect(exit._tag).toBe('Failure')
    })

    it('should handle all individual detection method errors', async () => {
      const errorTests = [
        { method: 'detectWorkers', errorType: 'workers' },
        { method: 'detectSharedArrayBuffer', errorType: 'sharedArrayBuffer' },
        { method: 'detectOffscreenCanvas', errorType: 'offscreenCanvas' },
        { method: 'detectImageBitmap', errorType: 'imageBitmap' },
        { method: 'detectWebAssembly', errorType: 'webassembly' },
        { method: 'detectDeviceMemory', errorType: 'deviceMemory' },
        { method: 'detectHardwareConcurrency', errorType: 'hardwareConcurrency' },
        { method: 'detectMaxTouchPoints', errorType: 'maxTouchPoints' },
        { method: 'detectNetworkInformation', errorType: 'networkInformation' },
      ]

      for (const { method, errorType } of errorTests) {
        // Force an error condition that would cause a throw
        const propertyName = errorType === 'workers' ? 'Worker' : errorType
        const originalValue = (global as any)[propertyName]
        
        // Check if property is configurable before trying to redefine it
        const descriptor = Object.getOwnPropertyDescriptor(global, propertyName)
        if (!descriptor || descriptor.configurable !== false) {
          Object.defineProperty(global, propertyName, {
            get: () => { throw new Error(`${errorType} access error`) },
            configurable: true
          })

          const exit = await Effect.runPromiseExit(
            Effect.gen(function* () {
              const service = yield* CapabilityDetectionService
              return yield* (service as any)[method]
            }).pipe(Effect.provide(CapabilityDetectionServiceLive))
          )

          expect(exit._tag).toBe('Failure')
          if (exit._tag === 'Failure') {
            expect(exit.cause._tag).toBe('Fail')
            if (exit.cause._tag === 'Fail') {
              expect(exit.cause.error).toBeInstanceOf(CapabilityDetectionError)
              expect(exit.cause.error.capability).toBe(errorType)
            }
          }

          // Restore original value
          Object.defineProperty(global, propertyName, {
            value: originalValue,
            writable: true,
            configurable: true
          })
        } else {
          // Skip test for non-configurable properties like Worker
          console.log(`Skipping error test for non-configurable property: ${propertyName}`)
        }
      }
    })
  })

  describe('Edge Cases and Comprehensive Coverage', () => {
    it('should handle WebGL2 context with missing loseContext extension', async () => {
      mockWebGL2Context.getExtension.mockReturnValue(null)

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* CapabilityDetectionService
          return yield* service.detectWebGL2
        }).pipe(Effect.provide(CapabilityDetectionServiceLive))
      )

      expect(result).toBe(true) // Should still detect as available
      expect(mockWebGL2Context.getExtension).toHaveBeenCalledWith('WEBGL_lose_context')
    })

    it('should handle WebGL2 context with extension but missing loseContext method', async () => {
      mockWebGL2Context.getExtension.mockReturnValue({ loseContext: undefined }) // Extension exists but loseContext is undefined

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* CapabilityDetectionService
          return yield* service.detectWebGL2
        }).pipe(Effect.provide(CapabilityDetectionServiceLive))
      )

      expect(result).toBe(true) // Should still detect as available
    })

    it('should handle different user agent strings for mobile detection', async () => {
      const mobileUserAgents = [
        'Mozilla/5.0 (Android 11; Mobile; rv:91.0) Gecko/91.0 Firefox/91.0',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
        'Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
        'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36',
        'Mozilla/5.0 (BlackBerry; U; BlackBerry 9900; en) AppleWebKit/534.11+',
        'Opera/9.80 (J2ME/MIDP; Opera Mini/9.80 (S60; SymbOS; Opera Mobi/23.348; U; en) Presto/2.5.25 Version/10.54',
      ]

      for (const userAgent of mobileUserAgents) {
        mockNavigator.maxTouchPoints = 0 // Reset touch points
        Object.defineProperty(mockNavigator, 'userAgent', {
          value: userAgent,
          writable: true,
        })

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.isMobileDevice
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(true)
      }
    })

    it('should handle user agent detection errors gracefully', async () => {
      mockNavigator.maxTouchPoints = 0
      Object.defineProperty(mockNavigator, 'userAgent', {
        get: () => { throw new Error('User agent access error') },
        configurable: true
      })

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* CapabilityDetectionService
          return yield* service.isMobileDevice
        }).pipe(Effect.provide(CapabilityDetectionServiceLive))
      )

      expect(result).toBe(false) // Should fallback to false on error

      // Restore userAgent
      Object.defineProperty(mockNavigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        writable: true,
      })
    })

    it('should handle partial connection objects correctly', async () => {
      const partialConnections = [
        { effectiveType: '3g' }, // Missing other properties
        { downlink: 5 }, // Missing other properties
        { saveData: true }, // Missing other properties
        {}, // Empty connection object
      ]

      for (const connection of partialConnections) {
        mockNavigator.connection = connection as any

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.detectNetworkInformation
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBeDefined()
        expect(typeof result.saveData).toBe('boolean')
        expect(result.effectiveType === null || typeof result.effectiveType === 'string').toBe(true)
        expect(result.downlink === null || typeof result.downlink === 'number').toBe(true)
        expect(result.rtt === null || typeof result.rtt === 'number').toBe(true)
      }

      // Restore full connection
      mockNavigator.connection = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 100,
        saveData: false,
      }
    })

    it('should handle webkit connection properties', async () => {
      delete (mockNavigator as any).connection
      delete mockNavigator.mozConnection
      mockNavigator.webkitConnection = {
        effectiveType: '5g',
        downlink: 20,
        rtt: 50,
        saveData: false,
      }

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* CapabilityDetectionService
          return yield* service.detectNetworkInformation
        }).pipe(Effect.provide(CapabilityDetectionServiceLive))
      )

      expect(result).toEqual({
        effectiveType: '5g',
        downlink: 20,
        rtt: 50,
        saveData: false,
      })

      // Restore standard connection
      delete mockNavigator.webkitConnection
      mockNavigator.connection = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 100,
        saveData: false,
      }
    })

    it('should handle edge cases in memory settings calculations', async () => {
      const memoryTestCases = [
        {
          deviceMemory: 1,
          connection: { saveData: false, effectiveType: '4g', downlink: 10, rtt: 100 },
          expectedMaxHeap: 256,
          expectedGCThreshold: 0.9
        },
        {
          deviceMemory: 16,
          connection: { saveData: false, effectiveType: '4g', downlink: 10, rtt: 100 },
          expectedMaxHeap: 2048,
          expectedGCThreshold: 0.75
        },
        {
          deviceMemory: 4,
          connection: { saveData: true, effectiveType: '2g', downlink: 1, rtt: 1000 },
          expectedMaxHeap: Math.floor(1024 * 0.7), // Adjusted for slow connection
        }
      ]

      for (const testCase of memoryTestCases) {
        mockNavigator.deviceMemory = testCase.deviceMemory
        mockNavigator.connection = testCase.connection

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.getOptimalMemorySettings
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result.maxHeapSize).toBeGreaterThan(0)
        expect(result.gcThreshold).toBeGreaterThan(0.1)
        expect(result.gcThreshold).toBeLessThanOrEqual(0.95)
        
        if (testCase.expectedMaxHeap) {
          expect(result.maxHeapSize).toBe(testCase.expectedMaxHeap)
        }
        if (testCase.expectedGCThreshold) {
          expect(result.gcThreshold).toBe(testCase.expectedGCThreshold)
        }
      }

      // Restore defaults
      mockNavigator.deviceMemory = 8
      mockNavigator.connection = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 100,
        saveData: false,
      }
    })

    it('should handle worker count calculations with edge cases', async () => {
      const workerTestCases = [
        {
          hardwareConcurrency: 1,
          deviceMemory: 1,
          workers: true,
          expected: 1
        },
        {
          hardwareConcurrency: 16,
          deviceMemory: 16,
          workers: true,
          expected: 8 // Capped at 8
        },
        {
          hardwareConcurrency: 4,
          deviceMemory: 1, // Very low memory
          workers: true,
          expected: 1
        },
        {
          hardwareConcurrency: 4,
          deviceMemory: null, // No memory info
          workers: true,
          expected: 4
        }
      ]

      for (const testCase of workerTestCases) {
        mockNavigator.hardwareConcurrency = testCase.hardwareConcurrency
        mockNavigator.deviceMemory = testCase.deviceMemory
        
        if (testCase.workers) {
          Object.defineProperty(global, 'Worker', { value: vi.fn(), writable: true })
        } else {
          Object.defineProperty(global, 'Worker', { value: undefined, writable: true })
        }

        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CapabilityDetectionService
            return yield* service.getOptimalWorkerCount
          }).pipe(Effect.provide(CapabilityDetectionServiceLive))
        )

        expect(result).toBe(testCase.expected)
      }

      // Restore defaults
      mockNavigator.hardwareConcurrency = 4
      mockNavigator.deviceMemory = 8
      Object.defineProperty(global, 'Worker', { value: vi.fn(), writable: true })
    })

    it('should test all utility functions with various capability combinations', async () => {
      const capabilityCombinations = [
        // High-end device
        {
          capabilities: {
            webgl2: true, webgpu: true, workers: true, sharedArrayBuffer: true,
            offscreenCanvas: true, imagebitmap: true, webassembly: true,
            deviceMemory: 16, hardwareConcurrency: 8, maxTouchPoints: 0,
            connection: { effectiveType: '5g', downlink: 50, rtt: 10, saveData: false }
          },
          expectedWebGPU: true,
          expectedWorkers: true,
          expectedSAB: true,
          expectedTexture: 2048,
          expectedParticles: 1000
        },
        // Low-end device
        {
          capabilities: {
            webgl2: true, webgpu: false, workers: false, sharedArrayBuffer: false,
            offscreenCanvas: false, imagebitmap: false, webassembly: false,
            deviceMemory: 1, hardwareConcurrency: 1, maxTouchPoints: 0,
            connection: { effectiveType: 'slow-2g', downlink: 0.5, rtt: 2000, saveData: true }
          },
          expectedWebGPU: false,
          expectedWorkers: false,
          expectedSAB: false,
          expectedTexture: 512,
          expectedParticles: 250
        },
        // Mid-range device with data saver
        {
          capabilities: {
            webgl2: true, webgpu: true, workers: true, sharedArrayBuffer: false,
            offscreenCanvas: true, imagebitmap: true, webassembly: true,
            deviceMemory: 4, hardwareConcurrency: 4, maxTouchPoints: 0,
            connection: { effectiveType: '4g', downlink: 10, rtt: 100, saveData: true }
          },
          expectedWebGPU: false, // Due to saveData
          expectedWorkers: true,
          expectedSAB: false,
          expectedTexture: 512, // Due to saveData
          expectedParticles: 250 // Due to saveData
        }
      ]

      for (const { capabilities, expectedWebGPU, expectedWorkers, expectedSAB, expectedTexture, expectedParticles } of capabilityCombinations) {
        expect(shouldUseWebGPU(capabilities)).toBe(expectedWebGPU)
        expect(shouldUseWorkers(capabilities)).toBe(expectedWorkers)
        expect(shouldUseSharedArrayBuffer(capabilities)).toBe(expectedSAB)
        expect(getRecommendedTextureSize(capabilities)).toBe(expectedTexture)
        expect(getRecommendedParticleCount(capabilities)).toBe(expectedParticles)
      }
    })
  })
})