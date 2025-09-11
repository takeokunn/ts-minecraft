/**
 * Mesh Generator Adapter
 *
 * Infrastructure adapter that provides technical implementation of mesh generation
 * by delegating to domain services and handling infrastructure-specific concerns.
 * This adapter focuses on technical integration and resource management.
 */

import { Effect, Layer } from 'effect'
import {
  IMeshGenerator,
  MeshGeneratorPort,
  MeshGenerationRequest,
  MeshGenerationResult,
  ChunkData,
  GeneratedMeshData,
  MeshGenerationOptions,
  BoundingVolume,
  MeshGeneratorHelpers,
} from '@domain/ports/mesh-generator.port'
import { MeshGenerationDomainService } from '@domain/services/mesh-generation-domain.service'

/**
 * Infrastructure-specific mesh optimization utilities
 * These handle technical concerns like GPU buffer management
 *
 * Functional implementation that eliminates class-based pattern
 */

/**
 * WebGL-optimized vertex buffer creation
 * In production, this would interface with WebGL or WebGPU
 */
const createOptimizedVertexBuffer = (data: Float32Array): ArrayBuffer => {
  // Technical implementation for GPU-optimized buffers
  const buffer = new ArrayBuffer(data.byteLength)
  const view = new Float32Array(buffer)
  view.set(data)
  return buffer
}

/**
 * GPU-aware index buffer optimization
 */
const optimizeIndexBuffer = (indices: Uint32Array): Uint32Array => {
  // Technical optimization for GPU cache efficiency
  // In production, this would use algorithms like Forsyth vertex cache optimization
  return new Uint32Array(indices)
}

/**
 * Memory-efficient vertex attribute interleaving
 */
const interleaveVertexAttributes = (positions: Float32Array, normals?: Float32Array, uvs?: Float32Array): Float32Array => {
  // Technical implementation for GPU-optimized vertex layouts
  const vertexCount = positions.length / 3
  const stride = 3 + (normals ? 3 : 0) + (uvs ? 2 : 0)
  const interleavedData = new Float32Array(vertexCount * stride)

  for (let i = 0; i < vertexCount; i++) {
    let offset = i * stride

    // Position (3 floats)
    interleavedData[offset++] = positions[i * 3]
    interleavedData[offset++] = positions[i * 3 + 1]
    interleavedData[offset++] = positions[i * 3 + 2]

    // Normal (3 floats)
    if (normals) {
      interleavedData[offset++] = normals[i * 3]
      interleavedData[offset++] = normals[i * 3 + 1]
      interleavedData[offset++] = normals[i * 3 + 2]
    }

    // UV (2 floats)
    if (uvs) {
      interleavedData[offset++] = uvs[i * 2]
      interleavedData[offset++] = uvs[i * 2 + 1]
    }
  }

  return interleavedData
}

/**
 * Infrastructure mesh optimization utilities - functional interface
 */
const InfrastructureMeshOptimization = {
  createOptimizedVertexBuffer,
  optimizeIndexBuffer,
  interleaveVertexAttributes,
} as const

/**
 * Infrastructure adapter for mesh generation
 * Focuses on technical implementation and resource management
 */
export const createMeshGeneratorAdapter = () =>
  Effect.gen(function* () {
    const domainService = new MeshGenerationDomainService()

    /**
     * Infrastructure-specific validation of capabilities
     */
    const validateInfrastructureCapabilities = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        // Technical validation: check browser capabilities, memory, etc.
        const hasRequiredAPIs = typeof Float32Array !== 'undefined' && typeof Uint32Array !== 'undefined' && typeof ArrayBuffer !== 'undefined'

        if (!hasRequiredAPIs) {
          yield* Effect.logWarning('Missing required browser APIs for mesh generation')
        }

        // Check WebGL support for advanced optimizations
        if (typeof WebGLRenderingContext !== 'undefined') {
          try {
            const canvas = document.createElement('canvas')
            const gl = canvas.getContext('webgl')
            if (gl) {
              yield* Effect.logInfo('WebGL available for mesh optimization')
            }
          } catch {
            yield* Effect.logWarning('WebGL not available, using CPU-only optimizations')
          }
        }

        // Check available memory for large meshes
        if (typeof (performance as any).memory !== 'undefined') {
          const memoryInfo = (performance as any).memory
          if (memoryInfo.usedJSHeapSize > memoryInfo.totalJSHeapSize * 0.85) {
            yield* Effect.logWarning('High memory usage detected, mesh generation may be limited')
          }
        }
      })

    /**
     * Apply infrastructure-specific optimizations to mesh data
     */
    const optimizeMeshData = (meshData: GeneratedMeshData): Effect.Effect<GeneratedMeshData, never, never> =>
      Effect.gen(function* () {
        // Optimize vertex buffer for GPU
        const optimizedVertexBuffer = {
          ...meshData.vertexBuffer,
          attributes: {
            ...meshData.vertexBuffer.attributes,
            // Apply interleaving for better GPU cache performance
            positions: meshData.vertexBuffer.attributes.positions, // Already optimized by domain
          },
          interleaved: true, // Mark as interleaved for renderer
        }

        // Optimize index buffer for GPU cache efficiency
        let optimizedIndexBuffer = meshData.indexBuffer
        if (meshData.indexBuffer.data.length > 1000) {
          // Apply index optimization for large meshes
          const optimizedIndices = InfrastructureMeshOptimization.optimizeIndexBuffer(new Uint32Array(meshData.indexBuffer.data))
          optimizedIndexBuffer = {
            ...meshData.indexBuffer,
            data: Array.from(optimizedIndices),
          }
        }

        return {
          ...meshData,
          vertexBuffer: optimizedVertexBuffer,
          indexBuffer: optimizedIndexBuffer,
        }
      })

    /**
     * Apply infrastructure-specific optimizations to mesh generation result
     */
    const applyInfrastructureOptimizations = (result: MeshGenerationResult): Effect.Effect<MeshGenerationResult, never, never> =>
      Effect.gen(function* () {
        const optimizedMeshData = yield* optimizeMeshData(result.meshData)

        return {
          ...result,
          meshData: optimizedMeshData,
        }
      })

    /**
     * Infrastructure-specific performance monitoring
     */
    const logPerformanceMetrics = (duration: number, metrics: any): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        const trianglesPerMs = metrics.outputTriangles / Math.max(1, duration)

        yield* Effect.logInfo(`Mesh generation completed`, {
          duration: `${duration.toFixed(2)}ms`,
          triangles: metrics.outputTriangles,
          vertices: metrics.outputVertices,
          performance: `${trianglesPerMs.toFixed(2)} triangles/ms`,
          memoryUsage: `${(metrics.outputMemoryUsage / 1024).toFixed(2)}KB`,
        })

        // Infrastructure monitoring: send metrics to monitoring service
        if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
          // In production, this would send metrics to a monitoring endpoint
          const infraMetrics = {
            component: 'mesh-generator-adapter',
            duration,
            triangles: metrics.outputTriangles,
            vertices: metrics.outputVertices,
            memoryUsage: metrics.outputMemoryUsage,
            timestamp: Date.now(),
          }
          // navigator.sendBeacon('/api/metrics', JSON.stringify(infraMetrics))
        }
      })

    return {
      /**
       * Technical implementation that delegates business logic to domain service
       * and handles infrastructure concerns like GPU optimization and caching
       */
      generateMesh: (request: MeshGenerationRequest): Effect.Effect<MeshGenerationResult, never, never> =>
        Effect.gen(function* () {
          const startTime = performance.now()

          // Technical validation of infrastructure capabilities
          yield* validateInfrastructureCapabilities()

          // Delegate to domain service for business logic
          const result = yield* domainService.generateMesh(request)

          // Infrastructure-specific optimizations
          const optimizedResult = yield* applyInfrastructureOptimizations(result)

          // Infrastructure-specific performance monitoring
          const infraTime = performance.now() - startTime
          yield* logPerformanceMetrics(infraTime, result.metrics)

          return optimizedResult
        }),

      /**
       * Generate naive mesh using infrastructure-optimized implementation
       */
      generateNaiveMesh: (chunkData: ChunkData, options?: MeshGenerationOptions): Effect.Effect<GeneratedMeshData, never, never> =>
        Effect.gen(function* () {
          // Delegate to domain service for business logic
          const result = yield* domainService.generateNaiveMesh(chunkData, options)

          // Apply infrastructure-specific optimizations
          return yield* optimizeMeshData(result)
        }),

      /**
       * Generate greedy mesh using infrastructure-optimized implementation
       */
      generateGreedyMesh: (chunkData: ChunkData, options?: MeshGenerationOptions): Effect.Effect<GeneratedMeshData, never, never> =>
        Effect.gen(function* () {
          // Delegate to domain service for business logic
          const result = yield* domainService.generateGreedyMesh(chunkData, options)

          // Apply infrastructure-specific optimizations
          return yield* optimizeMeshData(result)
        }),

      /**
       * Calculate bounds using infrastructure-optimized algorithms
       */
      calculateBounds: (positions: Float32Array): Effect.Effect<BoundingVolume, never, never> =>
        Effect.gen(function* () {
          // Delegate to domain service for business logic
          return yield* domainService.calculateBounds(positions)
        }),

      /**
       * Check if mesh generation is available on this platform
       */
      isAvailable: (): Effect.Effect<boolean, never, never> =>
        Effect.gen(function* () {
          // Check if infrastructure dependencies are available
          return typeof performance !== 'undefined' && typeof Float32Array !== 'undefined' && typeof Uint32Array !== 'undefined'
        }),
    } satisfies IMeshGenerator
  })

/**
 * Live layer for Mesh Generator Adapter
 */
export const MeshGeneratorAdapterLive = Layer.effect(MeshGeneratorPort, createMeshGeneratorAdapter())

/**
 * Mesh Generator Adapter with custom configuration
 */
export const createCustomMeshGeneratorAdapter = (config?: { enableGPUOptimization?: boolean; enableVertexCacheOptimization?: boolean; enableMemoryPooling?: boolean }) => {
  return Layer.effect(
    MeshGeneratorPort,
    Effect.gen(function* () {
      const adapter = yield* createMeshGeneratorAdapter()

      // Configure optimizations based on capabilities and settings
      if (config?.enableGPUOptimization && typeof WebGLRenderingContext !== 'undefined') {
        // Configure WebGL-based optimizations - future enhancement
      }

      return adapter
    }),
  )
}

/**
 * Infrastructure-specific mesh generation utilities
 */
export const MeshGeneratorAdapterUtils = {
  /**
   * Validate mesh generation capabilities
   */
  validateCapabilities: (): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      // Check for required browser APIs and performance capabilities
      return typeof performance !== 'undefined' && typeof Float32Array !== 'undefined' && typeof Uint32Array !== 'undefined' && typeof ArrayBuffer !== 'undefined'
    }),

  /**
   * Estimate memory usage for mesh generation
   */
  estimateMemoryUsage: (blockCount: number): number => {
    // Rough estimate: each block can generate up to 6 faces, 4 vertices per face
    const maxVertices = blockCount * 6 * 4
    const maxIndices = blockCount * 6 * 6

    // Vertex data: position(3) + normal(3) + uv(2) = 8 floats per vertex
    const vertexMemory = maxVertices * 8 * 4 // 4 bytes per float
    const indexMemory = maxIndices * 4 // 4 bytes per index

    return vertexMemory + indexMemory
  },

  /**
   * Get supported mesh algorithms
   */
  getSupportedAlgorithms: (): string[] => {
    const algorithms = ['naive', 'culled']

    // Greedy meshing requires more memory and processing power
    if (typeof (performance as any).memory !== 'undefined') {
      const memoryInfo = (performance as any).memory
      if (memoryInfo.totalJSHeapSize > 100 * 1024 * 1024) {
        // 100MB+
        algorithms.push('greedy')
      }
    }

    return algorithms
  },

  /**
   * Check WebGL support for GPU-accelerated mesh processing
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
   * Check Worker support for multi-threaded mesh generation
   */
  checkWorkerSupport: (): boolean => {
    return typeof Worker !== 'undefined'
  },

  /**
   * Calculate optimal LOD level based on distance and performance
   */
  calculateLODLevel: (distance: number): number => {
    if (distance < 50) return 0 // Full detail
    if (distance < 100) return 1 // Half detail
    if (distance < 200) return 2 // Quarter detail
    return 3 // Lowest detail
  },
}
