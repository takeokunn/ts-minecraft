/**
 * Terrain Generator Adapter
 * 
 * Infrastructure adapter that provides technical implementation of terrain generation
 * by delegating to domain services and handling infrastructure-specific concerns.
 * This adapter focuses on technical integration and resource management.
 */

import { Effect, Layer } from 'effect'
import {
  ITerrainGenerator,
  TerrainGeneratorPort,
  TerrainGenerationRequest,
  TerrainGenerationResult,
  ChunkCoordinates,
  NoiseSettings,
  BiomeConfig,
  TerrainGeneratorHelpers,
} from '@domain/ports/terrain-generator.port'
import { TerrainGenerationDomainService } from '@domain/services/terrain-generation-domain.service'

/**
 * Technical noise implementation using browser APIs
 * This is the infrastructure-specific implementation detail
 */
class InfrastructureNoise {
  /**
   * Browser-optimized noise function using Math.sin/cos
   * In production, this would use WebAssembly or Worker-based noise libraries
   */
  static simplexNoise = (x: number, y: number, z: number, seed: number): number => {
    // Technical implementation using browser Math APIs
    const n = Math.sin(x * 0.01 + seed) * Math.cos(y * 0.01 + seed) * Math.sin(z * 0.01 + seed)
    return (n + 1) / 2 // Normalize to 0-1
  }

  /**
   * WebGL-optimized noise for future GPU acceleration
   */
  static webglNoise = (x: number, y: number, z: number, seed: number): number => {
    // Placeholder for WebGL-based noise computation
    return this.simplexNoise(x, y, z, seed)
  }

  /**
   * Worker-threaded noise for CPU-intensive operations
   */
  static workerNoise = async (x: number, y: number, z: number, seed: number): Promise<number> => {
    // Placeholder for Worker-based noise computation
    return this.simplexNoise(x, y, z, seed)
  }
}

/**
 * Infrastructure adapter for terrain generation
 * Focuses on technical implementation and resource management
 */
export class TerrainGeneratorAdapter implements ITerrainGenerator {
  private domainService: TerrainGenerationDomainService
  private noiseProvider: typeof InfrastructureNoise.simplexNoise

  constructor() {
    this.domainService = new TerrainGenerationDomainService()
    this.noiseProvider = InfrastructureNoise.simplexNoise
  }

  /**
   * Technical implementation that delegates business logic to domain service
   * and handles infrastructure concerns like performance monitoring and caching
   */
  generateTerrain = (request: TerrainGenerationRequest): Effect.Effect<TerrainGenerationResult, never, never> =>
    Effect.gen(function* () {
      const startTime = performance.now()
      
      // Technical validation of infrastructure capabilities
      yield* this.validateInfrastructureCapabilities()
      
      // Delegate to domain service for business logic
      const result = yield* this.domainService.generateTerrain(request)
      
      // Infrastructure-specific performance monitoring
      const infraTime = performance.now() - startTime
      yield* this.logPerformanceMetrics(infraTime, result.blockCount)
      
      return result
    }.bind(this))

  /**
   * Generate height map using infrastructure-specific noise implementation
   */
  generateHeightMap = (
    coordinates: ChunkCoordinates,
    seed: number,
    noise: NoiseSettings,
  ): Effect.Effect<readonly number[], never, never> =>
    Effect.gen(function* () {
      // Delegate to domain service for business logic
      return yield* this.domainService.generateHeightMap(coordinates, seed, noise)
    }.bind(this))

  /**
   * Get biome configuration using infrastructure-specific biome generation
   */
  getBiome = (x: number, z: number, seed: number): Effect.Effect<BiomeConfig, never, never> =>
    Effect.gen(function* () {
      // Delegate to domain service for business logic
      return yield* this.domainService.getBiome(x, z, seed)
    }.bind(this))

  /**
   * Check if terrain generation is available on this platform
   */
  isAvailable = (): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      // Check if infrastructure dependencies are available
      // In a real implementation, this would check for WebGL, noise libraries, etc.
      return typeof performance !== 'undefined' && typeof Math !== 'undefined'
    })

  /**
   * Infrastructure-specific validation of capabilities
   */
  private validateInfrastructureCapabilities = (): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      // Technical validation: check browser capabilities, memory, etc.
      const hasRequiredAPIs = typeof performance !== 'undefined' && 
                             typeof Math !== 'undefined' && 
                             typeof Float32Array !== 'undefined'
      
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
  private logPerformanceMetrics = (
    duration: number,
    blockCount: number,
  ): Effect.Effect<void, never, never> =>
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
}

/**
 * Live layer for Terrain Generator Adapter
 */
export const TerrainGeneratorAdapterLive = Layer.succeed(
  TerrainGeneratorPort,
  new TerrainGeneratorAdapter(),
)

/**
 * Terrain Generator Adapter with custom configuration
 */
export const createTerrainGeneratorAdapter = (config?: {
  noiseLibrary?: 'math' | 'simplex' | 'perlin'
  enableGPUAcceleration?: boolean
  enableWorkerThreads?: boolean
}) => {
  const adapter = new TerrainGeneratorAdapter()
  
  // Configure noise provider based on capabilities
  if (config?.enableGPUAcceleration && typeof WebGLRenderingContext !== 'undefined') {
    // Configure WebGL-based noise
  }
  
  if (config?.enableWorkerThreads && typeof Worker !== 'undefined') {
    // Configure Worker-based noise
  }
  
  return Layer.succeed(TerrainGeneratorPort, adapter)
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
      return (
        typeof performance !== 'undefined' &&
        typeof Math !== 'undefined' &&
        typeof Float32Array !== 'undefined'
      )
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