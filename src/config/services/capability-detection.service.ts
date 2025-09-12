import { Effect, Layer, Context, pipe } from 'effect'
import * as S from 'effect/Schema'

/**
 * Capability Detection Service using Effect-TS patterns
 * Detects browser and hardware capabilities for optimal configuration
 */

// Device capabilities type
export interface Capabilities {
  webgl2: boolean
  webgpu: boolean
  workers: boolean
  sharedArrayBuffer: boolean
  offscreenCanvas: boolean
  imagebitmap: boolean
  webassembly: boolean
  deviceMemory: number | null
  hardwareConcurrency: number
  maxTouchPoints: number
  connection: {
    effectiveType: string | null
    downlink: number | null
    rtt: number | null
    saveData: boolean
  }
}

// Capability detection errors
export class CapabilityDetectionError extends S.TaggedError<CapabilityDetectionError>()(
  'CapabilityDetectionError',
  {
    capability: S.String,
    message: S.String,
    cause: S.optional(S.Unknown),
  }
) {}

// Navigator interface extensions for better typing
interface ExtendedNavigator extends Navigator {
  deviceMemory?: number
  connection?: {
    effectiveType: string
    downlink: number
    rtt: number
    saveData: boolean
  }
  mozConnection?: any
  webkitConnection?: any
}

// Capability Detection Service interface
export class CapabilityDetectionService extends Context.Tag('CapabilityDetectionService')<
  CapabilityDetectionService,
  {
    readonly detectWebGL2: Effect.Effect<boolean, CapabilityDetectionError>
    readonly detectWebGPU: Effect.Effect<boolean, CapabilityDetectionError>
    readonly detectWorkers: Effect.Effect<boolean, CapabilityDetectionError>
    readonly detectSharedArrayBuffer: Effect.Effect<boolean, CapabilityDetectionError>
    readonly detectOffscreenCanvas: Effect.Effect<boolean, CapabilityDetectionError>
    readonly detectImageBitmap: Effect.Effect<boolean, CapabilityDetectionError>
    readonly detectWebAssembly: Effect.Effect<boolean, CapabilityDetectionError>
    readonly detectDeviceMemory: Effect.Effect<number | null, CapabilityDetectionError>
    readonly detectHardwareConcurrency: Effect.Effect<number, CapabilityDetectionError>
    readonly detectMaxTouchPoints: Effect.Effect<number, CapabilityDetectionError>
    readonly detectNetworkInformation: Effect.Effect<
      Capabilities['connection'],
      CapabilityDetectionError
    >
    readonly detectAll: Effect.Effect<Capabilities, CapabilityDetectionError>
    readonly getOptimalWorkerCount: Effect.Effect<number, CapabilityDetectionError>
    readonly getOptimalMemorySettings: Effect.Effect<
      { maxHeapSize: number; gcThreshold: number },
      CapabilityDetectionError
    >
    readonly isLowEndDevice: Effect.Effect<boolean, CapabilityDetectionError>
    readonly isMobileDevice: Effect.Effect<boolean, CapabilityDetectionError>
  }
>() {}

// Implementation for browser environment
export const CapabilityDetectionServiceLive = Layer.succeed(
  CapabilityDetectionService,
  CapabilityDetectionService.of({
    detectWebGL2: Effect.tryPromise({
      try: async (): Promise<boolean> => {
        if (typeof document === 'undefined') return false
        
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('webgl2')
        
        // Clean up
        if (context) {
          const ext = context.getExtension('WEBGL_lose_context')
          ext?.loseContext()
        }
        
        return context !== null
      },
      catch: (error) =>
        new CapabilityDetectionError({
          capability: 'webgl2',
          message: `Failed to detect WebGL2 support: ${error}`,
          cause: error,
        }),
    }),

    detectWebGPU: Effect.tryPromise({
      try: async (): Promise<boolean> => {
        if (typeof navigator === 'undefined') return false
        
        // Check for basic WebGPU availability
        if (!navigator.gpu) return false
        
        try {
          // Try to request an adapter (this is the real test)
          const adapter = await navigator.gpu.requestAdapter()
          return adapter !== null
        } catch {
          return false
        }
      },
      catch: (error) =>
        new CapabilityDetectionError({
          capability: 'webgpu',
          message: `Failed to detect WebGPU support: ${error}`,
          cause: error,
        }),
    }),

    detectWorkers: Effect.sync(() => {
      try {
        return typeof Worker !== 'undefined' && typeof window !== 'undefined'
      } catch (error) {
        throw new CapabilityDetectionError({
          capability: 'workers',
          message: `Failed to detect Worker support: ${error}`,
          cause: error,
        })
      }
    }),

    detectSharedArrayBuffer: Effect.sync(() => {
      try {
        return typeof SharedArrayBuffer !== 'undefined' &&
               typeof Atomics !== 'undefined' &&
               self.crossOriginIsolated === true
      } catch (error) {
        throw new CapabilityDetectionError({
          capability: 'sharedArrayBuffer',
          message: `Failed to detect SharedArrayBuffer support: ${error}`,
          cause: error,
        })
      }
    }),

    detectOffscreenCanvas: Effect.sync(() => {
      try {
        return typeof OffscreenCanvas !== 'undefined'
      } catch (error) {
        throw new CapabilityDetectionError({
          capability: 'offscreenCanvas',
          message: `Failed to detect OffscreenCanvas support: ${error}`,
          cause: error,
        })
      }
    }),

    detectImageBitmap: Effect.sync(() => {
      try {
        return typeof createImageBitmap !== 'undefined'
      } catch (error) {
        throw new CapabilityDetectionError({
          capability: 'imageBitmap',
          message: `Failed to detect ImageBitmap support: ${error}`,
          cause: error,
        })
      }
    }),

    detectWebAssembly: Effect.sync(() => {
      try {
        return typeof WebAssembly !== 'undefined' &&
               typeof WebAssembly.instantiate === 'function'
      } catch (error) {
        throw new CapabilityDetectionError({
          capability: 'webassembly',
          message: `Failed to detect WebAssembly support: ${error}`,
          cause: error,
        })
      }
    }),

    detectDeviceMemory: Effect.sync(() => {
      try {
        if (typeof navigator === 'undefined') return null
        const nav = navigator as ExtendedNavigator
        return nav.deviceMemory || null
      } catch (error) {
        throw new CapabilityDetectionError({
          capability: 'deviceMemory',
          message: `Failed to detect device memory: ${error}`,
          cause: error,
        })
      }
    }),

    detectHardwareConcurrency: Effect.sync(() => {
      try {
        if (typeof navigator === 'undefined') return 4 // Default fallback
        return navigator.hardwareConcurrency || 4
      } catch (error) {
        throw new CapabilityDetectionError({
          capability: 'hardwareConcurrency',
          message: `Failed to detect hardware concurrency: ${error}`,
          cause: error,
        })
      }
    }),

    detectMaxTouchPoints: Effect.sync(() => {
      try {
        if (typeof navigator === 'undefined') return 0
        return navigator.maxTouchPoints || 0
      } catch (error) {
        throw new CapabilityDetectionError({
          capability: 'maxTouchPoints',
          message: `Failed to detect max touch points: ${error}`,
          cause: error,
        })
      }
    }),

    detectNetworkInformation: Effect.sync(() => {
      try {
        if (typeof navigator === 'undefined') {
          return {
            effectiveType: null,
            downlink: null,
            rtt: null,
            saveData: false,
          }
        }

        const nav = navigator as ExtendedNavigator
        const connection = nav.connection || nav.mozConnection || nav.webkitConnection

        if (!connection) {
          return {
            effectiveType: null,
            downlink: null,
            rtt: null,
            saveData: false,
          }
        }

        return {
          effectiveType: connection.effectiveType || null,
          downlink: connection.downlink || null,
          rtt: connection.rtt || null,
          saveData: connection.saveData || false,
        }
      } catch (error) {
        throw new CapabilityDetectionError({
          capability: 'networkInformation',
          message: `Failed to detect network information: ${error}`,
          cause: error,
        })
      }
    }),

    detectAll: Effect.gen(function* () {
      const [
        webgl2,
        webgpu,
        workers,
        sharedArrayBuffer,
        offscreenCanvas,
        imagebitmap,
        webassembly,
        deviceMemory,
        hardwareConcurrency,
        maxTouchPoints,
        connection,
      ] = yield* Effect.all([
        CapabilityDetectionService.detectWebGL2,
        CapabilityDetectionService.detectWebGPU,
        CapabilityDetectionService.detectWorkers,
        CapabilityDetectionService.detectSharedArrayBuffer,
        CapabilityDetectionService.detectOffscreenCanvas,
        CapabilityDetectionService.detectImageBitmap,
        CapabilityDetectionService.detectWebAssembly,
        CapabilityDetectionService.detectDeviceMemory,
        CapabilityDetectionService.detectHardwareConcurrency,
        CapabilityDetectionService.detectMaxTouchPoints,
        CapabilityDetectionService.detectNetworkInformation,
      ])

      return {
        webgl2,
        webgpu,
        workers,
        sharedArrayBuffer,
        offscreenCanvas,
        imagebitmap,
        webassembly,
        deviceMemory,
        hardwareConcurrency,
        maxTouchPoints,
        connection,
      }
    }),

    getOptimalWorkerCount: Effect.gen(function* () {
      const hardwareConcurrency = yield* CapabilityDetectionService.detectHardwareConcurrency
      const workers = yield* CapabilityDetectionService.detectWorkers
      const deviceMemory = yield* CapabilityDetectionService.detectDeviceMemory

      if (!workers) return 0

      // Base it on hardware concurrency but cap it
      let optimalCount = Math.min(hardwareConcurrency, 8)

      // Reduce for low-memory devices
      if (deviceMemory && deviceMemory < 4) {
        optimalCount = Math.min(optimalCount, 2)
      } else if (deviceMemory && deviceMemory < 2) {
        optimalCount = 1
      }

      return optimalCount
    }),

    getOptimalMemorySettings: Effect.gen(function* () {
      const deviceMemory = yield* CapabilityDetectionService.detectDeviceMemory
      const connection = yield* CapabilityDetectionService.detectNetworkInformation

      let maxHeapSize = 1024 // Default 1GB
      let gcThreshold = 0.8 // Default 80%

      // Adjust based on device memory
      if (deviceMemory) {
        if (deviceMemory >= 8) {
          maxHeapSize = 2048 // 2GB for high-end devices
          gcThreshold = 0.75 // More relaxed GC
        } else if (deviceMemory >= 4) {
          maxHeapSize = 1024 // 1GB for mid-range devices
          gcThreshold = 0.8
        } else if (deviceMemory >= 2) {
          maxHeapSize = 512 // 512MB for low-end devices
          gcThreshold = 0.85 // More aggressive GC
        } else {
          maxHeapSize = 256 // 256MB for very low-end devices
          gcThreshold = 0.9 // Very aggressive GC
        }
      }

      // Adjust for slow connections (save memory for caching)
      if (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        maxHeapSize = Math.floor(maxHeapSize * 0.7)
        gcThreshold = Math.min(gcThreshold + 0.05, 0.95)
      }

      return { maxHeapSize, gcThreshold }
    }),

    isLowEndDevice: Effect.gen(function* () {
      const deviceMemory = yield* CapabilityDetectionService.detectDeviceMemory
      const hardwareConcurrency = yield* CapabilityDetectionService.detectHardwareConcurrency
      const connection = yield* CapabilityDetectionService.detectNetworkInformation

      // Consider it low-end if:
      // - Device memory is less than 4GB
      // - Hardware concurrency is less than 4
      // - Connection is slow or save-data is enabled
      return (
        (deviceMemory && deviceMemory < 4) ||
        hardwareConcurrency < 4 ||
        connection.saveData ||
        connection.effectiveType === 'slow-2g' ||
        connection.effectiveType === '2g'
      )
    }),

    isMobileDevice: Effect.gen(function* () {
      const maxTouchPoints = yield* CapabilityDetectionService.detectMaxTouchPoints
      
      // Simple mobile detection based on touch support
      // and user agent (as fallback)
      if (maxTouchPoints > 0) return true
      
      try {
        if (typeof navigator !== 'undefined') {
          const userAgent = navigator.userAgent.toLowerCase()
          return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
        }
      } catch {
        // Ignore errors in user agent detection
      }
      
      return false
    }),
  })
)

// Test/Mock implementation
export const CapabilityDetectionServiceTest = Layer.succeed(
  CapabilityDetectionService,
  CapabilityDetectionService.of({
    detectWebGL2: Effect.succeed(true),
    detectWebGPU: Effect.succeed(false), // WebGPU typically not available in test environments
    detectWorkers: Effect.succeed(true),
    detectSharedArrayBuffer: Effect.succeed(false), // Usually not available in tests
    detectOffscreenCanvas: Effect.succeed(true),
    detectImageBitmap: Effect.succeed(true),
    detectWebAssembly: Effect.succeed(true),
    detectDeviceMemory: Effect.succeed(8), // Simulate 8GB device
    detectHardwareConcurrency: Effect.succeed(4),
    detectMaxTouchPoints: Effect.succeed(0), // Simulate desktop
    detectNetworkInformation: Effect.succeed({
      effectiveType: '4g',
      downlink: 10,
      rtt: 100,
      saveData: false,
    }),
    detectAll: Effect.succeed({
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
    }),
    getOptimalWorkerCount: Effect.succeed(4),
    getOptimalMemorySettings: Effect.succeed({
      maxHeapSize: 2048,
      gcThreshold: 0.75,
    }),
    isLowEndDevice: Effect.succeed(false),
    isMobileDevice: Effect.succeed(false),
  })
)

// Utility functions for capability-based decisions
export const shouldUseWebGPU = (capabilities: Capabilities): boolean =>
  capabilities.webgpu && !capabilities.connection.saveData

export const shouldUseWorkers = (capabilities: Capabilities): boolean =>
  capabilities.workers && capabilities.hardwareConcurrency > 2

export const shouldUseSharedArrayBuffer = (capabilities: Capabilities): boolean =>
  capabilities.sharedArrayBuffer && capabilities.hardwareConcurrency > 4

export const getRecommendedTextureSize = (capabilities: Capabilities): number => {
  if (capabilities.deviceMemory && capabilities.deviceMemory < 2) return 512
  if (capabilities.deviceMemory && capabilities.deviceMemory < 4) return 1024
  if (capabilities.connection.saveData) return 512
  return 2048
}

export const getRecommendedParticleCount = (capabilities: Capabilities): number => {
  if (capabilities.deviceMemory && capabilities.deviceMemory < 2) return 250
  if (capabilities.deviceMemory && capabilities.deviceMemory < 4) return 500
  if (capabilities.connection.saveData) return 250
  return 1000
}