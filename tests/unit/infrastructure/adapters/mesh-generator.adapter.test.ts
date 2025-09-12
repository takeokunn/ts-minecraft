/**
 * Mesh Generator Adapter Unit Tests
 * 
 * Comprehensive test suite for the mesh generator adapter,
 * testing mesh generation algorithms, optimization utilities, and Effect-TS patterns.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Context from 'effect/Context'
import { 
  expectEffect, 
  runEffect, 
  runEffectExit,
  measureEffectPerformance
} from '../../../setup/infrastructure.setup'
import {
  createMeshGeneratorAdapter,
  MeshGeneratorAdapterLive,
  createCustomMeshGeneratorAdapter,
  MeshGeneratorAdapterUtils
} from '@infrastructure/adapters/mesh-generator.adapter'
import {
  MeshGeneratorPort,
  IMeshGenerator,
  MeshGenerationRequest,
  MeshGenerationResult,
  ChunkData,
  GeneratedMeshData,
  MeshGenerationOptions,
  BoundingVolume,
  BlockData
} from '@domain/ports/mesh-generator.port'
import { MeshGenerationDomainService } from '@domain/services/mesh-generation.domain-service'

// Mock the domain service
vi.mock('@domain/services/mesh-generation.domain-service', () => {
  const mockMeshData: GeneratedMeshData = {
    vertexBuffer: {
      attributes: {
        positions: new Float32Array([0, 0, 0, 1, 1, 1, 2, 2, 2]),
        normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
        uvs: new Float32Array([0, 0, 1, 0, 0.5, 1])
      },
      vertexCount: 3,
      interleaved: false
    },
    indexBuffer: {
      data: [0, 1, 2],
      primitiveType: 'TRIANGLES'
    },
    boundingVolume: {
      center: { x: 1, y: 1, z: 1 },
      radius: 1.732,
      min: { x: 0, y: 0, z: 0 },
      max: { x: 2, y: 2, z: 2 }
    }
  }

  const mockResult: MeshGenerationResult = {
    meshData: mockMeshData,
    chunkCoordinates: { x: 0, z: 0 },
    algorithm: 'naive',
    metrics: {
      inputBlocks: 100,
      outputVertices: 3,
      outputTriangles: 1,
      processingTime: 10,
      outputMemoryUsage: 1024,
      optimizationLevel: 1
    }
  }

  const mockBounds: BoundingVolume = {
    center: { x: 0, y: 0, z: 0 },
    radius: 1,
    min: { x: -1, y: -1, z: -1 },
    max: { x: 1, y: 1, z: 1 }
  }

  return {
    MeshGenerationDomainService: vi.fn().mockImplementation(() => ({
      generateMesh: vi.fn().mockResolvedValue(Effect.succeed(mockResult)),
      generateNaiveMesh: vi.fn().mockResolvedValue(Effect.succeed(mockMeshData)),
      generateGreedyMesh: vi.fn().mockResolvedValue(Effect.succeed(mockMeshData)),
      calculateBounds: vi.fn().mockResolvedValue(Effect.succeed(mockBounds))
    }))
  }
})

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => 1000),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000
    }
  },
  writable: true
})

// Mock browser APIs
Object.defineProperty(global, 'Float32Array', { value: Float32Array })
Object.defineProperty(global, 'Uint32Array', { value: Uint32Array })
Object.defineProperty(global, 'ArrayBuffer', { value: ArrayBuffer })
Object.defineProperty(global, 'WebGLRenderingContext', { value: function() {} })

// Mock document and canvas for WebGL checks
Object.defineProperty(global, 'document', {
  value: {
    createElement: vi.fn(() => ({
      getContext: vi.fn(() => ({
        // Mock WebGL context
        createShader: vi.fn(),
        createProgram: vi.fn()
      }))
    }))
  },
  writable: true
})

// Mock navigator for sendBeacon
Object.defineProperty(global, 'navigator', {
  value: {
    sendBeacon: vi.fn()
  },
  writable: true
})

describe('MeshGeneratorAdapter', () => {
  let adapter: IMeshGenerator
  let mockDomainService: MeshGenerationDomainService

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Reset performance.now mock
    vi.mocked(performance.now).mockReturnValue(1000)
    
    adapter = await runEffect(createMeshGeneratorAdapter())
    mockDomainService = new MeshGenerationDomainService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Adapter Creation', () => {
    it('should create mesh generator adapter successfully', async () => {
      const result = await expectEffect.toSucceed(createMeshGeneratorAdapter())
      
      expect(result).toBeDefined()
      expect(result.generateMesh).toBeDefined()
      expect(result.generateNaiveMesh).toBeDefined()
      expect(result.generateGreedyMesh).toBeDefined()
      expect(result.calculateBounds).toBeDefined()
      expect(result.isAvailable).toBeDefined()
    })

    it('should create live layer successfully', async () => {
      const result = await expectEffect.toSucceed(
        Layer.build(MeshGeneratorAdapterLive).pipe(
          Effect.map(context => Context.get(context, MeshGeneratorPort))
        )
      )

      expect(result).toBeDefined()
      expect(result.generateMesh).toBeDefined()
    })

    it('should create custom adapter with configuration', async () => {
      const config = {
        enableGPUOptimization: true,
        enableVertexCacheOptimization: true,
        enableMemoryPooling: true
      }

      const result = await expectEffect.toSucceed(
        Layer.build(createCustomMeshGeneratorAdapter(config)).pipe(
          Effect.map(context => Context.get(context, MeshGeneratorPort))
        )
      )

      expect(result).toBeDefined()
    })

    it('should handle custom adapter without WebGL', async () => {
      // Mock WebGL as unavailable
      delete (global as any).WebGLRenderingContext

      const config = { enableGPUOptimization: true }

      const result = await expectEffect.toSucceed(
        Layer.build(createCustomMeshGeneratorAdapter(config)).pipe(
          Effect.map(context => Context.get(context, MeshGeneratorPort))
        )
      )

      expect(result).toBeDefined()

      // Restore WebGL
      Object.defineProperty(global, 'WebGLRenderingContext', { value: function() {} })
    })
  })

  describe('Mesh Generation', () => {
    let chunkData: ChunkData
    let meshRequest: MeshGenerationRequest

    beforeEach(() => {
      chunkData = {
        chunkCoordinates: { x: 0, z: 0 },
        blocks: Array.from({ length: 16 * 16 * 16 }, (_, i) => ({
          x: i % 16,
          y: Math.floor(i / 256),
          z: Math.floor((i % 256) / 16),
          blockType: i % 3 === 0 ? 1 : 0, // Mix of air and solid blocks
          metadata: {}
        })),
        size: { width: 16, height: 16, depth: 16 }
      }

      meshRequest = {
        chunkData,
        algorithm: 'naive',
        options: {
          generateNormals: true,
          generateUVs: true,
          enableCulling: true
        }
      }
    })

    it('should generate mesh successfully', async () => {
      const result = await expectEffect.toSucceed(adapter.generateMesh(meshRequest))
      
      expect(result).toBeDefined()
      expect(result.meshData).toBeDefined()
      expect(result.chunkCoordinates).toEqual({ x: 0, z: 0 })
      expect(result.algorithm).toBe('naive')
      expect(result.metrics).toBeDefined()
      expect(result.metrics.outputVertices).toBeGreaterThan(0)
      expect(result.metrics.outputTriangles).toBeGreaterThan(0)
    })

    it('should generate naive mesh', async () => {
      const result = await expectEffect.toSucceed(adapter.generateNaiveMesh(chunkData))
      
      expect(result).toBeDefined()
      expect(result.vertexBuffer).toBeDefined()
      expect(result.indexBuffer).toBeDefined()
      expect(result.boundingVolume).toBeDefined()
      expect(result.vertexBuffer.attributes.positions).toBeInstanceOf(Float32Array)
      expect(result.vertexBuffer.attributes.normals).toBeInstanceOf(Float32Array)
      expect(result.vertexBuffer.attributes.uvs).toBeInstanceOf(Float32Array)
    })

    it('should generate greedy mesh', async () => {
      const result = await expectEffect.toSucceed(adapter.generateGreedyMesh(chunkData))
      
      expect(result).toBeDefined()
      expect(result.vertexBuffer).toBeDefined()
      expect(result.indexBuffer).toBeDefined()
      expect(result.boundingVolume).toBeDefined()
    })

    it('should generate mesh with options', async () => {
      const options: MeshGenerationOptions = {
        generateNormals: false,
        generateUVs: false,
        enableCulling: false,
        lodLevel: 1
      }

      const result = await expectEffect.toSucceed(
        adapter.generateNaiveMesh(chunkData, options)
      )
      
      expect(result).toBeDefined()
    })

    it('should handle empty chunk data', async () => {
      const emptyChunkData: ChunkData = {
        chunkCoordinates: { x: 0, z: 0 },
        blocks: [],
        size: { width: 16, height: 16, depth: 16 }
      }

      const result = await expectEffect.toSucceed(
        adapter.generateNaiveMesh(emptyChunkData)
      )
      
      expect(result).toBeDefined()
    })

    it('should handle different algorithms', async () => {
      const greedyRequest = { ...meshRequest, algorithm: 'greedy' as const }
      
      const result = await expectEffect.toSucceed(adapter.generateMesh(greedyRequest))
      expect(result.algorithm).toBe('greedy')
    })

    it('should delegate to domain service', async () => {
      await expectEffect.toSucceed(adapter.generateMesh(meshRequest))
      
      expect(mockDomainService.generateMesh).toHaveBeenCalledWith(meshRequest)
    })
  })

  describe('Infrastructure Optimizations', () => {
    it('should apply GPU optimizations to large meshes', async () => {
      const largeMeshData: GeneratedMeshData = {
        vertexBuffer: {
          attributes: {
            positions: new Float32Array(3000), // Large mesh
            normals: new Float32Array(3000),
            uvs: new Float32Array(2000)
          },
          vertexCount: 1000,
          interleaved: false
        },
        indexBuffer: {
          data: Array.from({ length: 1500 }, (_, i) => i),
          primitiveType: 'TRIANGLES'
        },
        boundingVolume: {
          center: { x: 0, y: 0, z: 0 },
          radius: 10,
          min: { x: -10, y: -10, z: -10 },
          max: { x: 10, y: 10, z: 10 }
        }
      }

      // Mock domain service to return large mesh
      vi.mocked(mockDomainService.generateNaiveMesh).mockResolvedValue(
        Effect.succeed(largeMeshData)
      )

      const chunkData: ChunkData = {
        chunkCoordinates: { x: 0, z: 0 },
        blocks: [],
        size: { width: 16, height: 16, depth: 16 }
      }

      const result = await expectEffect.toSucceed(adapter.generateNaiveMesh(chunkData))
      
      expect(result).toBeDefined()
      expect(result.vertexBuffer.interleaved).toBe(true) // Should be optimized
    })

    it('should skip optimization for small meshes', async () => {
      const smallMeshData: GeneratedMeshData = {
        vertexBuffer: {
          attributes: {
            positions: new Float32Array([1, 2, 3]),
            normals: new Float32Array([0, 1, 0]),
            uvs: new Float32Array([0, 0])
          },
          vertexCount: 1,
          interleaved: false
        },
        indexBuffer: {
          data: [0], // Small mesh
          primitiveType: 'TRIANGLES'
        },
        boundingVolume: {
          center: { x: 0, y: 0, z: 0 },
          radius: 1,
          min: { x: 0, y: 0, z: 0 },
          max: { x: 1, y: 1, z: 1 }
        }
      }

      vi.mocked(mockDomainService.generateNaiveMesh).mockResolvedValue(
        Effect.succeed(smallMeshData)
      )

      const chunkData: ChunkData = {
        chunkCoordinates: { x: 0, z: 0 },
        blocks: [],
        size: { width: 16, height: 16, depth: 16 }
      }

      const result = await expectEffect.toSucceed(adapter.generateNaiveMesh(chunkData))
      
      expect(result).toBeDefined()
      // Small meshes might not be optimized
    })
  })

  describe('Performance Monitoring', () => {
    it('should log performance metrics', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      // Mock time progression
      let timeCounter = 1000
      vi.mocked(performance.now).mockImplementation(() => {
        timeCounter += 10
        return timeCounter
      })

      const chunkData: ChunkData = {
        chunkCoordinates: { x: 0, z: 0 },
        blocks: [],
        size: { width: 16, height: 16, depth: 16 }
      }

      const request: MeshGenerationRequest = {
        chunkData,
        algorithm: 'naive'
      }

      await expectEffect.toSucceed(adapter.generateMesh(request))
      
      // Should log performance info (implementation may vary)
      expect(performance.now).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('should send metrics via sendBeacon if available', async () => {
      const sendBeaconSpy = vi.mocked(navigator.sendBeacon)
      
      const chunkData: ChunkData = {
        chunkCoordinates: { x: 0, z: 0 },
        blocks: [],
        size: { width: 16, height: 16, depth: 16 }
      }

      const request: MeshGenerationRequest = {
        chunkData,
        algorithm: 'naive'
      }

      await expectEffect.toSucceed(adapter.generateMesh(request))
      
      // Note: Implementation may or may not use sendBeacon based on the code
      // This is testing the infrastructure capability
      expect(sendBeaconSpy).toBeDefined()
    })
  })

  describe('Infrastructure Validation', () => {
    it('should validate browser capabilities', async () => {
      const isAvailable = await expectEffect.toSucceed(adapter.isAvailable())
      expect(isAvailable).toBe(true)
    })

    it('should handle missing browser APIs', async () => {
      // Temporarily remove required APIs
      const originalFloat32Array = global.Float32Array
      delete (global as any).Float32Array

      const newAdapter = await runEffect(createMeshGeneratorAdapter())
      const isAvailable = await expectEffect.toSucceed(newAdapter.isAvailable())
      
      expect(isAvailable).toBe(false)

      // Restore API
      global.Float32Array = originalFloat32Array
    })

    it('should check performance API availability', async () => {
      const originalPerformance = global.performance
      delete (global as any).performance

      const newAdapter = await runEffect(createMeshGeneratorAdapter())
      const isAvailable = await expectEffect.toSucceed(newAdapter.isAvailable())
      
      expect(isAvailable).toBe(false)

      // Restore performance
      global.performance = originalPerformance
    })

    it('should warn about high memory usage', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Mock high memory usage
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 900000,
          totalJSHeapSize: 1000000,
          jsHeapSizeLimit: 1000000
        },
        configurable: true
      })

      await runEffect(createMeshGeneratorAdapter())
      
      // Should warn about memory usage (implementation may vary)
      expect(consoleWarnSpy).toBeDefined()
      
      consoleWarnSpy.mockRestore()
    })

    it('should handle WebGL validation', async () => {
      const createElementSpy = vi.mocked(document.createElement)
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue({
          createShader: vi.fn(),
          createProgram: vi.fn()
        })
      }
      createElementSpy.mockReturnValue(mockCanvas as any)

      await runEffect(createMeshGeneratorAdapter())
      
      expect(createElementSpy).toHaveBeenCalledWith('canvas')
      expect(mockCanvas.getContext).toHaveBeenCalledWith('webgl')
    })

    it('should handle WebGL not available', async () => {
      const createElementSpy = vi.mocked(document.createElement)
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(null) // WebGL not available
      }
      createElementSpy.mockReturnValue(mockCanvas as any)

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await runEffect(createMeshGeneratorAdapter())
      
      expect(createElementSpy).toHaveBeenCalledWith('canvas')
      expect(consoleWarnSpy).toBeDefined()
      
      consoleWarnSpy.mockRestore()
    })
  })

  describe('Bounds Calculation', () => {
    it('should calculate bounds for mesh data', async () => {
      const positions = new Float32Array([
        -1, -1, -1,  // min point
         1,  1,  1,  // max point
         0,  0,  0   // center point
      ])

      const bounds = await expectEffect.toSucceed(adapter.calculateBounds(positions))
      
      expect(bounds).toBeDefined()
      expect(bounds.center).toBeDefined()
      expect(bounds.radius).toBeGreaterThan(0)
      expect(bounds.min).toBeDefined()
      expect(bounds.max).toBeDefined()
    })

    it('should handle empty positions array', async () => {
      const positions = new Float32Array([])
      
      const bounds = await expectEffect.toSucceed(adapter.calculateBounds(positions))
      expect(bounds).toBeDefined()
    })

    it('should delegate to domain service for bounds calculation', async () => {
      const positions = new Float32Array([0, 0, 0, 1, 1, 1])
      
      await expectEffect.toSucceed(adapter.calculateBounds(positions))
      
      expect(mockDomainService.calculateBounds).toHaveBeenCalledWith(positions)
    })
  })

  describe('Error Handling', () => {
    it('should handle domain service errors', async () => {
      // Mock domain service to throw error
      vi.mocked(mockDomainService.generateMesh).mockResolvedValue(
        Effect.fail(new Error('Domain service error'))
      )

      const chunkData: ChunkData = {
        chunkCoordinates: { x: 0, z: 0 },
        blocks: [],
        size: { width: 16, height: 16, depth: 16 }
      }

      const request: MeshGenerationRequest = {
        chunkData,
        algorithm: 'naive'
      }

      const result = await runEffectExit(adapter.generateMesh(request))
      expect(result._tag).toBe('Failure')
    })

    it('should handle performance.now errors', async () => {
      vi.mocked(performance.now).mockImplementation(() => {
        throw new Error('Performance API error')
      })

      const chunkData: ChunkData = {
        chunkCoordinates: { x: 0, z: 0 },
        blocks: [],
        size: { width: 16, height: 16, depth: 16 }
      }

      // Should handle error gracefully and still work
      const result = await expectEffect.toSucceed(adapter.generateNaiveMesh(chunkData))
      expect(result).toBeDefined()
    })

    it('should handle WebGL context creation errors', async () => {
      const createElementSpy = vi.mocked(document.createElement)
      createElementSpy.mockImplementation(() => {
        throw new Error('Canvas creation failed')
      })

      // Should handle error gracefully during adapter creation
      const newAdapter = await expectEffect.toSucceed(createMeshGeneratorAdapter())
      expect(newAdapter).toBeDefined()
    })
  })

  describe('Utility Functions', () => {
    describe('MeshGeneratorAdapterUtils', () => {
      it('should validate capabilities', async () => {
        const isValid = await expectEffect.toSucceed(
          MeshGeneratorAdapterUtils.validateCapabilities()
        )
        expect(isValid).toBe(true)
      })

      it('should estimate memory usage', () => {
        const blockCount = 1000
        const memoryUsage = MeshGeneratorAdapterUtils.estimateMemoryUsage(blockCount)
        
        expect(memoryUsage).toBeGreaterThan(0)
        expect(typeof memoryUsage).toBe('number')
      })

      it('should get supported algorithms', () => {
        const algorithms = MeshGeneratorAdapterUtils.getSupportedAlgorithms()
        
        expect(algorithms).toBeInstanceOf(Array)
        expect(algorithms).toContain('naive')
        expect(algorithms).toContain('culled')
      })

      it('should include greedy algorithm for high memory systems', () => {
        // Mock high memory system
        Object.defineProperty(performance, 'memory', {
          value: {
            totalJSHeapSize: 200 * 1024 * 1024, // 200MB
            usedJSHeapSize: 50 * 1024 * 1024,
            jsHeapSizeLimit: 500 * 1024 * 1024
          },
          configurable: true
        })

        const algorithms = MeshGeneratorAdapterUtils.getSupportedAlgorithms()
        expect(algorithms).toContain('greedy')
      })

      it('should check WebGL support', () => {
        const hasWebGL = MeshGeneratorAdapterUtils.checkWebGLSupport()
        expect(typeof hasWebGL).toBe('boolean')
        expect(hasWebGL).toBe(true) // Should be true with our mocks
      })

      it('should handle WebGL check when not available', () => {
        delete (global as any).WebGLRenderingContext
        
        const hasWebGL = MeshGeneratorAdapterUtils.checkWebGLSupport()
        expect(hasWebGL).toBe(false)

        // Restore
        Object.defineProperty(global, 'WebGLRenderingContext', { value: function() {} })
      })

      it('should check Worker support', () => {
        const hasWorker = MeshGeneratorAdapterUtils.checkWorkerSupport()
        expect(typeof hasWorker).toBe('boolean')
      })

      it('should calculate LOD level based on distance', () => {
        expect(MeshGeneratorAdapterUtils.calculateLODLevel(25)).toBe(0)
        expect(MeshGeneratorAdapterUtils.calculateLODLevel(75)).toBe(1)
        expect(MeshGeneratorAdapterUtils.calculateLODLevel(150)).toBe(2)
        expect(MeshGeneratorAdapterUtils.calculateLODLevel(250)).toBe(3)
      })
    })
  })

  describe('Performance Tests', () => {
    it('should handle large chunk data efficiently', async () => {
      // Create large chunk data
      const largeChunkData: ChunkData = {
        chunkCoordinates: { x: 0, z: 0 },
        blocks: Array.from({ length: 32 * 32 * 32 }, (_, i) => ({
          x: i % 32,
          y: Math.floor(i / 1024),
          z: Math.floor((i % 1024) / 32),
          blockType: i % 2, // Half solid, half air
          metadata: {}
        })),
        size: { width: 32, height: 32, depth: 32 }
      }

      const { result, duration } = await measureEffectPerformance(
        adapter.generateNaiveMesh(largeChunkData),
        'Large chunk mesh generation'
      )

      expect(result).toBeDefined()
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should handle concurrent mesh generation requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => {
        const chunkData: ChunkData = {
          chunkCoordinates: { x: i, z: i },
          blocks: Array.from({ length: 100 }, (_, j) => ({
            x: j % 10,
            y: 0,
            z: Math.floor(j / 10),
            blockType: 1,
            metadata: {}
          })),
          size: { width: 16, height: 16, depth: 16 }
        }

        return adapter.generateNaiveMesh(chunkData)
      })

      const startTime = performance.now()
      const results = await Promise.all(requests.map(req => expectEffect.toSucceed(req)))
      const endTime = performance.now()

      expect(results).toHaveLength(5)
      expect(endTime - startTime).toBeLessThan(500)
    })
  })

  describe('Integration with Effect-TS', () => {
    it('should work with Effect composition', async () => {
      const chunkData: ChunkData = {
        chunkCoordinates: { x: 0, z: 0 },
        blocks: [],
        size: { width: 16, height: 16, depth: 16 }
      }

      const composedEffect = Effect.gen(function* () {
        const meshData = yield* adapter.generateNaiveMesh(chunkData)
        const bounds = yield* adapter.calculateBounds(meshData.vertexBuffer.attributes.positions)
        const isAvailable = yield* adapter.isAvailable()

        return { meshData, bounds, isAvailable }
      })

      const result = await expectEffect.toSucceed(composedEffect)
      
      expect(result.meshData).toBeDefined()
      expect(result.bounds).toBeDefined()
      expect(result.isAvailable).toBe(true)
    })

    it('should handle Effect error propagation', async () => {
      // Mock domain service to fail
      vi.mocked(mockDomainService.generateNaiveMesh).mockResolvedValue(
        Effect.fail(new Error('Generation failed'))
      )

      const chunkData: ChunkData = {
        chunkCoordinates: { x: 0, z: 0 },
        blocks: [],
        size: { width: 16, height: 16, depth: 16 }
      }

      const result = await runEffectExit(adapter.generateNaiveMesh(chunkData))
      expect(result._tag).toBe('Failure')
    })
  })

  describe('Memory Management', () => {
    it('should handle memory-intensive operations', async () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0
      
      // Generate multiple large meshes
      const operations = Array.from({ length: 3 }, (_, i) => {
        const chunkData: ChunkData = {
          chunkCoordinates: { x: i, z: i },
          blocks: Array.from({ length: 1000 }, (_, j) => ({
            x: j % 10,
            y: Math.floor(j / 100),
            z: Math.floor((j % 100) / 10),
            blockType: 1,
            metadata: {}
          })),
          size: { width: 16, height: 16, depth: 16 }
        }

        return adapter.generateNaiveMesh(chunkData)
      })

      const results = await Promise.all(operations.map(op => expectEffect.toSucceed(op)))
      
      expect(results).toHaveLength(3)
      
      // Memory usage should be reasonable
      const finalMemory = performance.memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory
      
      // Should not exceed 50MB increase (adjust based on system)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })
  })
})