/**
 * Terrain Generator Adapter
 *
 * Infrastructure adapter that provides technical implementation of terrain generation
 * using functional programming patterns with Effect-TS and Context.GenericTag.
 * This adapter focuses on technical integration and resource management.
 */

import { Effect, Layer, Context } from 'effect'
import {
  TerrainGenerationRequest,
  TerrainGenerationResult,
  ChunkCoordinates,
  NoiseSettings,
  BiomeConfig,
} from '@domain/ports/terrain-generator.port'
import { TerrainGenerationDomainService } from '@domain/services/terrain-generation.domain-service'
import { TerrainGenerationError, NoiseGenerationError, ExternalLibraryError } from '@domain/errors'

/**
 * Technical noise implementation using browser APIs
 * This is the infrastructure-specific implementation detail
 *
 * Functional implementation that eliminates class-based pattern
 */

/**
 * Browser-optimized noise function using Math.sin/cos
 * In production, this would use WebAssembly or Worker-based noise libraries
 */
const simplexNoise = (x: number, y: number, z: number, seed: number): number => {
  // Technical implementation using browser Math APIs
  const n = Math.sin(x * 0.01 + seed) * Math.cos(y * 0.01 + seed) * Math.sin(z * 0.01 + seed)
  return (n + 1) / 2 // Normalize to 0-1
}

/**
 * WebGL-optimized noise for future GPU acceleration
 */
const webglNoise = (x: number, y: number, z: number, seed: number): number => {
  // Placeholder for WebGL-based noise computation
  return simplexNoise(x, y, z, seed)
}

/**
 * Worker-threaded noise for CPU-intensive operations
 */
const workerNoise = async (x: number, y: number, z: number, seed: number): Promise<number> => {
  // Placeholder for Worker-based noise computation
  return simplexNoise(x, y, z, seed)
}

/**
 * Infrastructure noise utilities - functional interface
 */
const InfrastructureNoise = {
  simplexNoise,
  webglNoise,
  workerNoise,
} as const

/**
 * Terrain Generator Adapter Service Interface
 * Defines the contract for terrain generation with proper error handling
 */
export interface TerrainGeneratorAdapter {
  readonly generateTerrain: (request: TerrainGenerationRequest) => Effect.Effect<TerrainGenerationResult, TerrainGenerationError | ExternalLibraryError>
  readonly generateHeightMap: (coordinates: ChunkCoordinates, seed: number, noise: NoiseSettings) => Effect.Effect<readonly number[], TerrainGenerationError | NoiseGenerationError>
  readonly getBiome: (x: number, z: number, seed: number) => Effect.Effect<BiomeConfig, TerrainGenerationError>
  readonly isAvailable: () => Effect.Effect<boolean, never>
  readonly generateNoise: (x: number, y: number, z: number, seed: number) => Effect.Effect<number, NoiseGenerationError>
}

/**
 * Context tag for Terrain Generator Adapter dependency injection
 */
export const TerrainGeneratorAdapter = Context.GenericTag<TerrainGeneratorAdapter>('@app/TerrainGeneratorAdapter')

/**
 * Infrastructure adapter for terrain generation
 * Focuses on technical implementation and resource management
 */
const createTerrainGeneratorAdapter = () =>
  Effect.gen(function* () {
    const domainService = new TerrainGenerationDomainService()
    const noiseProvider = InfrastructureNoise.simplexNoise

    /**
     * Infrastructure-specific validation of capabilities
     */
    const validateInfrastructureCapabilities = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        // Technical validation: check browser capabilities, memory, etc.
        const hasRequiredAPIs = typeof performance !== 'undefined' && typeof Math !== 'undefined' && typeof Float32Array !== 'undefined'

        if (!hasRequiredAPIs) {
          yield* Effect.logWarning('Missing required browser APIs for terrain generation')
        }

        // Check available memory
        if (typeof (performance as any).memory !== 'undefined') {
          const memoryInfo = (performance as any).memory
          if (memoryInfo.usedJSHeapSize > memoryInfo.totalJSHeapSize * 0.9) {
            yield* Effect.logWarning('High memory usage detected, terrain generation may be slow')
          }
        }
      })

    /**
     * Infrastructure-specific performance monitoring
     */
    const logPerformanceMetrics = (duration: number, blockCount: number): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        const blocksPerMs = blockCount / Math.max(1, duration)

        yield* Effect.logInfo(`Terrain generation completed`, {
          duration: `${duration.toFixed(2)}ms`,
          blockCount,
          performance: `${blocksPerMs.toFixed(2)} blocks/ms`,
        })

        // Infrastructure monitoring: send metrics to monitoring service
        if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
          // In production, this would send metrics to a monitoring endpoint
          const metrics = {
            component: 'terrain-generator-adapter',
            duration,
            blockCount,
            timestamp: Date.now(),
          }
          // navigator.sendBeacon('/api/metrics', JSON.stringify(metrics))
        }
      })

    return {
      /**
       * Technical implementation that delegates business logic to domain service
       * and handles infrastructure concerns like performance monitoring and caching
       */
      generateTerrain: (request: TerrainGenerationRequest): Effect.Effect<TerrainGenerationResult, TerrainGenerationError | ExternalLibraryError> =>
        Effect.gen(function* () {
          const startTime = performance.now()

          // Technical validation of infrastructure capabilities
          yield* validateInfrastructureCapabilities()

          // Delegate to domain service for business logic with error handling
          const result = yield* Effect.try({
            try: () => domainService.generateTerrain(request),
            catch: (e) => new TerrainGenerationError({
              message: `Failed to generate terrain: ${e}`,
              coordinates: request.coordinates,
              seed: request.seed,
              cause: e,
              timestamp: Date.now()
            })
          }).pipe(Effect.flatten)

          // Infrastructure-specific performance monitoring
          const infraTime = performance.now() - startTime
          yield* logPerformanceMetrics(infraTime, result.blockCount)

          return result
        }),

      /**
       * Generate noise using infrastructure-specific noise implementation
       */
      generateNoise: (x: number, y: number, z: number, seed: number): Effect.Effect<number, NoiseGenerationError> =>
        Effect.try({
          try: () => {
            return noiseProvider(x, y, z, seed)
          },
          catch: (e) => new NoiseGenerationError({
            message: `Failed to generate noise: ${e}`,
            coordinates: { x, y, z },
            seed,
            noiseType: 'simplex',
            cause: e,
            timestamp: Date.now()
          })
        }),

      /**
       * Generate height map using infrastructure-specific noise implementation
       */
      generateHeightMap: (coordinates: ChunkCoordinates, seed: number, noise: NoiseSettings): Effect.Effect<readonly number[], TerrainGenerationError | NoiseGenerationError> =>
        Effect.try({
          try: () => domainService.generateHeightMap(coordinates, seed, noise),
          catch: (e) => new TerrainGenerationError({
            message: `Failed to generate height map: ${e}`,
            coordinates: { x: coordinates.x, z: coordinates.z },
            seed,
            cause: e,
            timestamp: Date.now()
          })
        }).pipe(Effect.flatten),

      /**
       * Get biome configuration using infrastructure-specific biome generation
       */
      getBiome: (x: number, z: number, seed: number): Effect.Effect<BiomeConfig, TerrainGenerationError> =>
        Effect.try({
          try: () => domainService.getBiome(x, z, seed),
          catch: (e) => new TerrainGenerationError({
            message: `Failed to get biome configuration: ${e}`,
            coordinates: { x, z },
            seed,
            cause: e,
            timestamp: Date.now()
          })
        }).pipe(Effect.flatten),

      /**
       * Check if terrain generation is available on this platform
       */
      isAvailable: (): Effect.Effect<boolean, never> =>
        Effect.sync(() => {
          // Check if infrastructure dependencies are available
          // In a real implementation, this would check for WebGL, noise libraries, etc.
          return typeof performance !== 'undefined' && typeof Math !== 'undefined'
        }),
    } satisfies TerrainGeneratorAdapter
  })

/**
 * Live layer for Terrain Generator Adapter
 */
export const TerrainGeneratorAdapterLive = Layer.effect(TerrainGeneratorAdapter, createTerrainGeneratorAdapter())

/**
 * Terrain Generator Adapter with custom configuration
 */
export const createCustomTerrainGeneratorAdapter = (config?: { noiseLibrary?: 'math' | 'simplex' | 'perlin'; enableGPUAcceleration?: boolean; enableWorkerThreads?: boolean }) => {
  return Layer.effect(
    TerrainGeneratorAdapter,
    Effect.gen(function* () {
      const adapter = yield* createTerrainGeneratorAdapter()

      // Configure noise provider based on capabilities
      if (config?.enableGPUAcceleration && typeof WebGLRenderingContext !== 'undefined') {
        // Configure WebGL-based noise - future enhancement
      }

      if (config?.enableWorkerThreads && typeof Worker !== 'undefined') {
        // Configure Worker-based noise - future enhancement
      }

      return adapter
    }),
  )
}

/**
 * Infrastructure-specific terrain generation utilities
 */
export const TerrainGeneratorAdapterUtils = {
  /**
   * Validate terrain generation capabilities
   */
  validateCapabilities: (): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      // Check for required browser APIs and performance capabilities
      return typeof performance !== 'undefined' && typeof Math !== 'undefined' && typeof Float32Array !== 'undefined'
    }),

  /**
   * Estimate memory usage for terrain generation
   */
  estimateMemoryUsage: (chunkCount: number): number => {
    // Rough estimate: each chunk uses ~64KB for terrain data
    return chunkCount * 64 * 1024
  },

  /**
   * Get supported noise algorithms
   */
  getSupportedAlgorithms: (): string[] => {
    const algorithms = ['math-based']

    if (typeof WebGLRenderingContext !== 'undefined') {
      algorithms.push('webgl-optimized')
    }

    if (typeof Worker !== 'undefined') {
      algorithms.push('worker-threaded')
    }

    return algorithms
  },

  /**
   * Check WebGL support for GPU-accelerated terrain generation
   */
  checkWebGLSupport: (): boolean => {
    if (typeof WebGLRenderingContext === 'undefined') return false

    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      return gl !== null
    } catch {
      return false
    }
  },

  /**
   * Check Worker support for multi-threaded terrain generation
   */
  checkWorkerSupport: (): boolean => {
    return typeof Worker !== 'undefined'
  },
}
