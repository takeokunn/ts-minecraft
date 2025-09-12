/**
 * Infrastructure and technical configuration using Effect-TS patterns
 * 
 * @deprecated Direct interface usage is deprecated. Use InfrastructureConfigService instead.
 * This file maintains backward compatibility while migrating to Effect-TS.
 */

import { Effect } from 'effect'
import {
  InfrastructureConfig,
  defaultInfrastructureConfig,
  InfrastructureConfigSchema,
  RenderingConfig,
  MemoryConfig,
  WorkerConfig,
  NetworkConfig,
  StorageConfig,
  MonitoringConfig,
  DevelopmentConfig,
  AssetConfig,
  AudioConfig,
  SecurityConfig,
} from './schemas/infrastructure.schema'
import {
  InfrastructureConfigService,
  InfrastructureConfigServiceLive,
  InfrastructureConfigError,
} from './services/infrastructure-config.service'
import {
  CapabilityDetectionService,
  CapabilityDetectionServiceLive,
  Capabilities,
} from './services/capability-detection.service'

// Re-export types for backward compatibility
export type { 
  InfrastructureConfig,
  RenderingConfig,
  MemoryConfig,
  WorkerConfig,
  NetworkConfig,
  StorageConfig,
  MonitoringConfig,
  DevelopmentConfig,
  AssetConfig,
  AudioConfig,
  SecurityConfig,
  Capabilities
}

// Re-export schema for validation
export { InfrastructureConfigSchema, InfrastructureConfigError }

// Re-export services
export { InfrastructureConfigService, InfrastructureConfigServiceLive }
export { CapabilityDetectionService, CapabilityDetectionServiceLive }

/**
 * @deprecated This interface is replaced by InfrastructureConfigSchema
 */
// Backward compatibility layer

/**
 * @deprecated Use InfrastructureConfigService.get() instead
 */
export const INFRASTRUCTURE_CONFIG = defaultInfrastructureConfig

/**
 * @deprecated Use InfrastructureConfigSchema validation instead
 */
export const validateInfrastructureConfig = (config: InfrastructureConfig): boolean => {
  try {
    const result = Effect.runSync(
      Effect.tryPromise({
        try: async () => {
          const { InfrastructureConfigService } = await import('./services/infrastructure-config.service')
          return Effect.runPromise(
            Effect.gen(function* () {
              const service = yield* InfrastructureConfigService
              yield* service.validate(config)
              return true
            }).pipe(Effect.provide(InfrastructureConfigServiceLive))
          )
        },
        catch: () => false,
      })
    )
    return result ?? false
  } catch {
    return false
  }
}

/**
 * @deprecated Use CapabilityDetectionService.detectAll() instead
 */
export const detectCapabilities = () => {
  try {
    const result = Effect.runSync(
      Effect.gen(function* () {
        const service = yield* CapabilityDetectionService
        const capabilities = yield* service.detectAll
        
        // Convert to legacy format
        return {
          webgl2: capabilities.webgl2,
          webgpu: capabilities.webgpu,
          workers: capabilities.workers,
          sharedArrayBuffer: capabilities.sharedArrayBuffer,
          offscreenCanvas: capabilities.offscreenCanvas,
          imagebitmap: capabilities.imagebitmap,
          webassembly: capabilities.webassembly,
        }
      }).pipe(
        Effect.provide(CapabilityDetectionServiceLive),
        Effect.catchAll(() => Effect.succeed({
          webgl2: false,
          webgpu: false,
          workers: false,
          sharedArrayBuffer: false,
          offscreenCanvas: false,
          imagebitmap: false,
          webassembly: false,
        }))
      )
    )
    return result
  } catch {
    return {
      webgl2: false,
      webgpu: false,
      workers: false,
      sharedArrayBuffer: false,
      offscreenCanvas: false,
      imagebitmap: false,
      webassembly: false,
    }
  }
}

/**
 * @deprecated Use InfrastructureConfigService.getOptimalConfiguration() instead
 */
export const getOptimalInfrastructureConfig = (): InfrastructureConfig => {
  try {
    const result = Effect.runSync(
      Effect.gen(function* () {
        const service = yield* InfrastructureConfigService
        return yield* service.getOptimalConfiguration
      }).pipe(
        Effect.provide(InfrastructureConfigServiceLive),
        Effect.catchAll(() => Effect.succeed(defaultInfrastructureConfig))
      )
    )
    return result
  } catch {
    return defaultInfrastructureConfig
  }
}

// Initialize the service and validate on load (for backward compatibility)
Effect.runPromise(
  Effect.gen(function* () {
    const service = yield* InfrastructureConfigService
    yield* service.load
  }).pipe(
    Effect.provide(InfrastructureConfigServiceLive),
    Effect.catchAll((error) => {
      console.error('Failed to initialize infrastructure configuration:', error)
      return Effect.void
    })
  )
).catch(() => {
  // Fallback for environments where Effect cannot run
  console.warn('Using fallback infrastructure configuration')
})
