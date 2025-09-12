import { Effect, Layer, Context, Ref, pipe } from 'effect'
import * as S from 'effect/Schema'
import {
  InfrastructureConfigSchema,
  InfrastructureConfig,
  defaultInfrastructureConfig,
} from '../schemas/infrastructure.schema'
import { 
  CapabilityDetectionService, 
  CapabilityDetectionServiceLive,
  Capabilities,
  shouldUseWebGPU,
  shouldUseWorkers,
  shouldUseSharedArrayBuffer,
  getRecommendedTextureSize,
  getRecommendedParticleCount,
} from './capability-detection.service'
import { 
  EnvironmentService,
  EnvironmentServiceLive,
  StorageService,
  StorageServiceLive,
} from './game-config.service'

/**
 * InfrastructureConfig service using Effect-TS patterns
 * Provides system-level configuration with capability detection
 */

// Infrastructure configuration error types
export class InfrastructureConfigError extends S.TaggedError<InfrastructureConfigError>()(
  'InfrastructureConfigError',
  {
    reason: S.Literal('validation', 'capability', 'optimization', 'storage'),
    message: S.String,
    cause: S.optional(S.Unknown),
  }
) {}

// Infrastructure Configuration Service interface
export class InfrastructureConfigService extends Context.Tag('InfrastructureConfigService')<
  InfrastructureConfigService,
  {
    readonly get: Effect.Effect<InfrastructureConfig, InfrastructureConfigError>
    readonly getSection: <K extends keyof InfrastructureConfig>(
      section: K
    ) => Effect.Effect<InfrastructureConfig[K], InfrastructureConfigError>
    readonly update: (
      config: Partial<InfrastructureConfig>
    ) => Effect.Effect<void, InfrastructureConfigError>
    readonly updateSection: <K extends keyof InfrastructureConfig>(
      section: K,
      update: Partial<InfrastructureConfig[K]>
    ) => Effect.Effect<void, InfrastructureConfigError>
    readonly load: Effect.Effect<InfrastructureConfig, InfrastructureConfigError>
    readonly save: (
      config: InfrastructureConfig
    ) => Effect.Effect<void, InfrastructureConfigError>
    readonly reset: Effect.Effect<void, InfrastructureConfigError>
    readonly validate: (
      config: unknown
    ) => Effect.Effect<InfrastructureConfig, InfrastructureConfigError>
    readonly reload: Effect.Effect<InfrastructureConfig, InfrastructureConfigError>
    readonly detectAndOptimize: Effect.Effect<InfrastructureConfig, InfrastructureConfigError>
    readonly getOptimalConfiguration: Effect.Effect<InfrastructureConfig, InfrastructureConfigError>
  }
>() {}

// Helper to create environment-specific infrastructure config
const createEnvironmentInfrastructureConfig = (mode: string): InfrastructureConfig => {
  const config = { ...defaultInfrastructureConfig }

  switch (mode) {
    case 'development':
      return {
        ...config,
        development: {
          ...config.development,
          enableDebugger: true,
          enableProfiler: true,
          enableHotReload: true,
          enableSourceMaps: true,
          logLevel: 'debug',
        },
        monitoring: {
          ...config.monitoring,
          enabled: true,
          sampleRate: 1.0, // 100% in development
        },
        assets: {
          ...config.assets,
          compressionFormat: 'none', // Faster loading in dev
        },
      }

    case 'production':
      return {
        ...config,
        memory: {
          ...config.memory,
          gcThreshold: 0.7, // More aggressive GC in production
        },
        assets: {
          ...config.assets,
          compressionFormat: 'brotli',
          loadingStrategy: 'progressive',
        },
        security: {
          ...config.security,
          contentSecurityPolicy: true,
          trustedTypes: true,
        },
        monitoring: {
          ...config.monitoring,
          sampleRate: 0.01, // 1% in production
        },
      }

    case 'test':
      return {
        ...config,
        workers: {
          ...config.workers,
          useWorkers: false, // Disable workers in tests for predictability
          maxWorkers: 0,
        },
        monitoring: {
          ...config.monitoring,
          enabled: false, // Disable monitoring in tests
        },
        development: {
          ...config.development,
          enableDebugger: false,
          enableProfiler: false,
          enableHotReload: false,
          enableSourceMaps: true,
          logLevel: 'error',
        },
        storage: {
          ...config.storage,
          provider: 'localStorage', // Use localStorage for tests
          compression: false,
          encryption: false,
        },
      }

    default:
      return config
  }
}

// Deep merge utility for infrastructure config
const deepMergeInfraConfig = <T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T => {
  const result = { ...target }

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMergeInfraConfig(result[key] || {}, source[key]!)
    } else if (source[key] !== undefined) {
      result[key] = source[key]!
    }
  }

  return result
}

// Optimize configuration based on detected capabilities
const optimizeConfigForCapabilities = (
  baseConfig: InfrastructureConfig,
  capabilities: Capabilities
): InfrastructureConfig => {
  const optimized = { ...baseConfig }

  // Rendering optimizations
  if (!shouldUseWebGPU(capabilities)) {
    optimized.rendering = {
      ...optimized.rendering,
      preferWebGPU: false,
      engine: 'three',
    }
  }

  // Worker optimizations
  if (!shouldUseWorkers(capabilities)) {
    optimized.workers = {
      ...optimized.workers,
      useWorkers: false,
      maxWorkers: 0,
    }
  } else {
    optimized.workers = {
      ...optimized.workers,
      maxWorkers: Math.min(capabilities.hardwareConcurrency, 8),
    }
  }

  // Memory optimizations based on device memory
  if (capabilities.deviceMemory) {
    if (capabilities.deviceMemory < 4) {
      // Low memory device optimizations
      optimized.memory = {
        ...optimized.memory,
        maxHeapSize: 512,
        objectPoolSize: 5000,
        texturePoolSize: 50,
        geometryPoolSize: 250,
        gcThreshold: 0.85,
      }
      optimized.audio = {
        ...optimized.audio,
        maxSources: 32,
        bufferSize: 2048,
      }
    } else if (capabilities.deviceMemory >= 8) {
      // High memory device optimizations
      optimized.memory = {
        ...optimized.memory,
        maxHeapSize: 2048,
        objectPoolSize: 20000,
        texturePoolSize: 200,
        geometryPoolSize: 1000,
        gcThreshold: 0.75,
      }
    }
  }

  // SharedArrayBuffer optimizations
  if (!shouldUseSharedArrayBuffer(capabilities)) {
    optimized.security = {
      ...optimized.security,
      sharedArrayBuffer: false,
    }
  }

  // Network optimizations
  if (capabilities.connection.saveData || 
      capabilities.connection.effectiveType === 'slow-2g' || 
      capabilities.connection.effectiveType === '2g') {
    optimized.assets = {
      ...optimized.assets,
      compressionFormat: 'gzip',
      loadingStrategy: 'lazy',
    }
    optimized.monitoring = {
      ...optimized.monitoring,
      enableNetworkProfiling: false,
    }
  }

  // Asset optimizations
  optimized.assets = {
    ...optimized.assets,
    textureAtlasSize: getRecommendedTextureSize(capabilities),
  }

  // Mobile optimizations
  if (capabilities.maxTouchPoints > 0) {
    optimized.rendering = {
      ...optimized.rendering,
      canvas: {
        ...optimized.rendering.canvas,
        powerPreference: 'low-power',
      },
    }
    optimized.memory = {
      ...optimized.memory,
      gcThreshold: Math.min(optimized.memory.gcThreshold + 0.05, 0.9),
    }
  }

  return optimized
}

// Infrastructure Configuration Service implementation
export const InfrastructureConfigServiceLive = Layer.effect(
  InfrastructureConfigService,
  Effect.gen(function* () {
    const storage = yield* StorageService
    const environment = yield* EnvironmentService
    const capabilities = yield* CapabilityDetectionService

    // Initialize with environment-specific config
    const mode = yield* environment.getMode
    const initialConfig = createEnvironmentInfrastructureConfig(mode)
    const configRef = yield* Ref.make(initialConfig)

    const validate = (config: unknown) =>
      pipe(
        S.decodeUnknown(InfrastructureConfigSchema)(config),
        Effect.mapError(
          (error) =>
            new InfrastructureConfigError({
              reason: 'validation',
              message: `InfrastructureConfig validation failed: ${error}`,
              cause: error,
            })
        )
      )

    const detectAndOptimize = () =>
      Effect.gen(function* () {
        const detectedCapabilities = yield* capabilities.detectAll
        const current = yield* Ref.get(configRef)
        
        const optimized = optimizeConfigForCapabilities(current, detectedCapabilities)
        const validated = yield* validate(optimized)
        
        return validated
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            new InfrastructureConfigError({
              reason: 'capability',
              message: `Failed to detect and optimize configuration: ${error}`,
              cause: error,
            })
          )
        )
      )

    const load = () =>
      Effect.gen(function* () {
        const mode = yield* environment.getMode
        const baseConfig = createEnvironmentInfrastructureConfig(mode)
        
        // Apply capability-based optimizations
        const optimizedConfig = yield* Effect.gen(function* () {
          const detectedCapabilities = yield* capabilities.detectAll
          return optimizeConfigForCapabilities(baseConfig, detectedCapabilities)
        }).pipe(
          Effect.catchAll(() => Effect.succeed(baseConfig)) // Fallback to base config if capability detection fails
        )
        
        // Validate the final configuration
        const validatedConfig = yield* validate(optimizedConfig)
        
        // Update the ref with the loaded config
        yield* Ref.set(configRef, validatedConfig)
        
        return validatedConfig
      })

    const save = (config: InfrastructureConfig) =>
      pipe(
        validate(config),
        Effect.flatMap(() => Ref.set(configRef, config))
      )

    return InfrastructureConfigService.of({
      get: Ref.get(configRef),

      getSection: <K extends keyof InfrastructureConfig>(section: K) =>
        pipe(
          Ref.get(configRef),
          Effect.map((config) => config[section])
        ),

      update: (partial: Partial<InfrastructureConfig>) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(configRef)
          const updated = deepMergeInfraConfig(current, partial)
          const validated = yield* validate(updated)
          
          yield* Ref.set(configRef, validated)
        }),

      updateSection: <K extends keyof InfrastructureConfig>(
        section: K,
        update: Partial<InfrastructureConfig[K]>
      ) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(configRef)
          const updatedSection = deepMergeInfraConfig(current[section], update)
          const updatedConfig = { ...current, [section]: updatedSection }
          const validated = yield* validate(updatedConfig)
          
          yield* Ref.set(configRef, validated)
        }),

      load,

      save,

      reset: Effect.gen(function* () {
        const mode = yield* environment.getMode
        const defaultConfig = createEnvironmentInfrastructureConfig(mode)
        
        yield* Ref.set(configRef, defaultConfig)
      }),

      validate,

      reload: load,

      detectAndOptimize,

      getOptimalConfiguration: Effect.gen(function* () {
        const detectedCapabilities = yield* capabilities.detectAll
        const mode = yield* environment.getMode
        const baseConfig = createEnvironmentInfrastructureConfig(mode)
        
        const optimized = optimizeConfigForCapabilities(baseConfig, detectedCapabilities)
        return yield* validate(optimized)
      }),
    })
  })
).pipe(
  Layer.provide(StorageServiceLive),
  Layer.provide(EnvironmentServiceLive),
  Layer.provide(CapabilityDetectionServiceLive)
)

// Test service implementation with mock capabilities
export const InfrastructureConfigServiceTest = Layer.effect(
  InfrastructureConfigService,
  Effect.gen(function* () {
    const configRef = yield* Ref.make(createEnvironmentInfrastructureConfig('test'))

    const validate = (config: unknown) =>
      pipe(
        S.decodeUnknown(InfrastructureConfigSchema)(config),
        Effect.mapError(
          (error) =>
            new InfrastructureConfigError({
              reason: 'validation',
              message: `InfrastructureConfig validation failed: ${error}`,
              cause: error,
            })
        )
      )

    // Mock capabilities for testing
    const mockCapabilities: Capabilities = {
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
    }

    const detectAndOptimize = () =>
      Effect.gen(function* () {
        const current = yield* Ref.get(configRef)
        const optimized = optimizeConfigForCapabilities(current, mockCapabilities)
        return yield* validate(optimized)
      })

    const load = () =>
      Effect.gen(function* () {
        const testConfig = createEnvironmentInfrastructureConfig('test')
        const optimized = optimizeConfigForCapabilities(testConfig, mockCapabilities)
        const validated = yield* validate(optimized)
        
        yield* Ref.set(configRef, validated)
        return validated
      })

    return InfrastructureConfigService.of({
      get: Ref.get(configRef),

      getSection: <K extends keyof InfrastructureConfig>(section: K) =>
        pipe(
          Ref.get(configRef),
          Effect.map((config) => config[section])
        ),

      update: (partial: Partial<InfrastructureConfig>) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(configRef)
          const updated = deepMergeInfraConfig(current, partial)
          const validated = yield* validate(updated)
          
          yield* Ref.set(configRef, validated)
        }),

      updateSection: <K extends keyof InfrastructureConfig>(
        section: K,
        update: Partial<InfrastructureConfig[K]>
      ) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(configRef)
          const updatedSection = deepMergeInfraConfig(current[section], update)
          const updatedConfig = { ...current, [section]: updatedSection }
          const validated = yield* validate(updatedConfig)
          
          yield* Ref.set(configRef, validated)
        }),

      load,

      save: (config: InfrastructureConfig) =>
        pipe(
          validate(config),
          Effect.flatMap(() => Ref.set(configRef, config))
        ),

      reset: Effect.gen(function* () {
        const testConfig = createEnvironmentInfrastructureConfig('test')
        yield* Ref.set(configRef, testConfig)
      }),

      validate,

      reload: load,

      detectAndOptimize,

      getOptimalConfiguration: Effect.gen(function* () {
        const baseConfig = createEnvironmentInfrastructureConfig('test')
        const optimized = optimizeConfigForCapabilities(baseConfig, mockCapabilities)
        return yield* validate(optimized)
      }),
    })
  })
)