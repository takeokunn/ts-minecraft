/**
 * Mesh Generator Adapter Tests
 * 
 * Comprehensive test suite for MeshGeneratorAdapter using Effect-TS patterns.
 * Tests mesh generation algorithms, optimization utilities, and error handling.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as Effect from 'effect/Effect'
import * as TestContext from 'effect/TestContext'

import { 
  MeshGeneratorAdapterService, 
  MeshGeneratorAdapterLive 
} from '../mesh-generator.adapter'
import type {
  MeshGenerationRequest,
  ChunkData,
  MeshGenerationOptions,
  BoundingVolume
} from '@domain/ports/mesh-generator.port'
import { MeshGenerationDomainServiceLive } from '@domain/services/mesh-generation.domain-service'

// Helper to run effects in test context
const runTest = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(effect.pipe(
    Effect.provide(MeshGeneratorAdapterLive),
    Effect.provide(MeshGenerationDomainServiceLive),
    Effect.provide(TestContext.TestContext)
  ))

// Test data factories
const createTestChunkData = (size = 16): ChunkData => {
  const blockCount = size * size * size
  const blocks = new Array(blockCount).fill(0).map((_, i) => {
    // Create a simple pattern: solid blocks on bottom, air on top
    const y = Math.floor(i / (size * size)) % size
    return y < size / 2 ? 1 : 0 // 1 = solid block, 0 = air
  })

  return {
    chunkX: 0,
    chunkZ: 0,
    blocks,
    chunkSize: size,
    blockTypes: ['air', 'stone', 'dirt', 'grass']
  }
}

const createTestMeshGenerationRequest = (
  chunkData: ChunkData = createTestChunkData(),
  options?: MeshGenerationOptions
): MeshGenerationRequest => ({
  chunkData,
  algorithm: 'greedy',
  options: {
    generateNormals: true,
    generateUVs: true,
    optimizeVertices: true,
    ...options
  }
})

const createTestPositions = (): Float32Array => {
  // Create a simple cube
  return new Float32Array([
    // Front face
    -1, -1,  1,
     1, -1,  1,
     1,  1,  1,
    -1,  1,  1,
    // Back face
    -1, -1, -1,
    -1,  1, -1,
     1,  1, -1,
     1, -1, -1
  ])
}

describe('MeshGeneratorAdapter', () => {
  describe('Mesh Generation', () => {
    it('should generate mesh using greedy algorithm', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService
        const chunkData = createTestChunkData(4) // Small chunk for testing
        const request = createTestMeshGenerationRequest(chunkData)

        const result = yield* adapter.generateMesh(request)

        expect(result.success).toBe(true)
        expect(result.meshData).toBeDefined()
        
        if (result.meshData) {
          expect(result.meshData.vertices).toBeInstanceOf(Float32Array)
          expect(result.meshData.indices).toBeInstanceOf(Uint32Array)
          expect(result.meshData.vertices.length).toBeGreaterThan(0)
          expect(result.meshData.indices.length).toBeGreaterThan(0)
          expect(result.meshData.vertexCount).toBeGreaterThan(0)
          expect(result.meshData.triangleCount).toBeGreaterThan(0)
        }

        expect(result.metadata).toBeDefined()
        expect(result.metadata.generationTimeMs).toBeGreaterThan(0)
        expect(result.metadata.algorithm).toBe('greedy')
      }))
    })

    it('should generate mesh using naive algorithm', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService
        const chunkData = createTestChunkData(4)
        const options: MeshGenerationOptions = {
          generateNormals: true,
          generateUVs: false,
          optimizeVertices: false
        }

        const meshData = yield* adapter.generateNaiveMesh(chunkData, options)

        expect(meshData.vertices).toBeInstanceOf(Float32Array)
        expect(meshData.indices).toBeInstanceOf(Uint32Array)
        expect(meshData.vertices.length).toBeGreaterThan(0)
        expect(meshData.indices.length).toBeGreaterThan(0)
        expect(meshData.vertexCount).toBeGreaterThan(0)
        expect(meshData.triangleCount).toBeGreaterThan(0)

        // Should have normals but no UVs based on options
        expect(meshData.normals).toBeDefined()
        expect(meshData.normals!.length).toBeGreaterThan(0)
        expect(meshData.uvs).toBeUndefined()
      }))
    })

    it('should generate mesh with optional attributes based on options', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService
        const chunkData = createTestChunkData(4)

        // Test with normals and UVs enabled
        const optionsWithAll: MeshGenerationOptions = {
          generateNormals: true,
          generateUVs: true,
          optimizeVertices: true
        }

        const meshWithAll = yield* adapter.generateGreedyMesh(chunkData, optionsWithAll)

        expect(meshWithAll.normals).toBeDefined()
        expect(meshWithAll.uvs).toBeDefined()
        expect(meshWithAll.normals!.length).toBe(meshWithAll.vertices.length) // Same length as vertices
        expect(meshWithAll.uvs!.length).toBe((meshWithAll.vertices.length / 3) * 2) // 2 UV coords per vertex

        // Test with minimal attributes
        const optionsMinimal: MeshGenerationOptions = {
          generateNormals: false,
          generateUVs: false,
          optimizeVertices: false
        }

        const meshMinimal = yield* adapter.generateGreedyMesh(chunkData, optionsMinimal)

        expect(meshMinimal.normals).toBeUndefined()
        expect(meshMinimal.uvs).toBeUndefined()
        expect(meshMinimal.vertices.length).toBeGreaterThan(0)
        expect(meshMinimal.indices.length).toBeGreaterThan(0)
      }))
    })

    it('should handle empty chunk data', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService
        
        // Create chunk with all air blocks
        const emptyChunkData: ChunkData = {
          chunkX: 0,
          chunkZ: 0,
          blocks: new Array(8 * 8 * 8).fill(0), // All air
          chunkSize: 8,
          blockTypes: ['air']
        }

        const meshData = yield* adapter.generateNaiveMesh(emptyChunkData)

        // Empty chunk should produce empty mesh
        expect(meshData.vertices.length).toBe(0)
        expect(meshData.indices.length).toBe(0)
        expect(meshData.vertexCount).toBe(0)
        expect(meshData.triangleCount).toBe(0)
      }))
    })

    it('should calculate bounding volumes correctly', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService
        const positions = createTestPositions()

        const bounds = yield* adapter.calculateBounds(positions)

        expect(bounds.min).toEqual({ x: -1, y: -1, z: -1 })
        expect(bounds.max).toEqual({ x: 1, y: 1, z: 1 })
        expect(bounds.center).toEqual({ x: 0, y: 0, z: 0 })
        expect(bounds.size).toEqual({ x: 2, y: 2, z: 2 })
      }))
    })

    it('should handle single point for bounding calculation', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService
        const singlePoint = new Float32Array([5, 10, -3])

        const bounds = yield* adapter.calculateBounds(singlePoint)

        expect(bounds.min).toEqual({ x: 5, y: 10, z: -3 })
        expect(bounds.max).toEqual({ x: 5, y: 10, z: -3 })
        expect(bounds.center).toEqual({ x: 5, y: 10, z: -3 })
        expect(bounds.size).toEqual({ x: 0, y: 0, z: 0 })
      }))
    })

    it('should optimize vertex buffers correctly', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService
        const chunkData = createTestChunkData(4)

        // Generate mesh with optimization enabled
        const optimizedMesh = yield* adapter.generateGreedyMesh(chunkData, {
          generateNormals: true,
          generateUVs: true,
          optimizeVertices: true
        })

        // Generate mesh without optimization
        const unoptimizedMesh = yield* adapter.generateNaiveMesh(chunkData, {
          generateNormals: true,
          generateUVs: true,
          optimizeVertices: false
        })

        // Optimized mesh should generally have fewer vertices (due to vertex merging)
        // This is a heuristic test as the exact optimization depends on the chunk content
        expect(optimizedMesh.vertexCount).toBeLessThanOrEqual(unoptimizedMesh.vertexCount)
      }))
    })
  })

  describe('Algorithm Comparison', () => {
    it('should produce different results between naive and greedy algorithms', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService
        const chunkData = createTestChunkData(6)
        const options: MeshGenerationOptions = {
          generateNormals: false,
          generateUVs: false,
          optimizeVertices: false
        }

        const naiveMesh = yield* adapter.generateNaiveMesh(chunkData, options)
        const greedyMesh = yield* adapter.generateGreedyMesh(chunkData, options)

        // Greedy algorithm should generally produce fewer vertices and triangles
        // than naive algorithm for the same chunk data
        expect(greedyMesh.vertexCount).toBeLessThanOrEqual(naiveMesh.vertexCount)
        expect(greedyMesh.triangleCount).toBeLessThanOrEqual(naiveMesh.triangleCount)
      }))
    })

    it('should handle different chunk sizes efficiently', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService

        const sizes = [4, 8, 16]
        const results = []

        for (const size of sizes) {
          const chunkData = createTestChunkData(size)
          const request = createTestMeshGenerationRequest(chunkData)

          const result = yield* adapter.generateMesh(request)
          results.push(result)

          expect(result.success).toBe(true)
          expect(result.meshData?.vertices.length).toBeGreaterThan(0)
        }

        // Larger chunks should generally produce more vertices
        const vertexCounts = results.map(r => r.meshData?.vertexCount || 0)
        expect(vertexCounts[1]).toBeGreaterThan(vertexCounts[0])
        expect(vertexCounts[2]).toBeGreaterThan(vertexCounts[1])
      }))
    })
  })

  describe('Performance Characteristics', () => {
    it('should complete mesh generation within reasonable time', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService
        const chunkData = createTestChunkData(16) // Moderately sized chunk
        const request = createTestMeshGenerationRequest(chunkData)

        const startTime = Date.now()
        const result = yield* adapter.generateMesh(request)
        const endTime = Date.now()

        const actualTime = endTime - startTime
        const reportedTime = result.metadata.generationTimeMs

        expect(result.success).toBe(true)
        expect(reportedTime).toBeGreaterThan(0)
        expect(reportedTime).toBeLessThan(5000) // Should complete within 5 seconds
        expect(Math.abs(actualTime - reportedTime)).toBeLessThan(100) // Times should be close
      }))
    })

    it('should handle concurrent mesh generation', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService

        // Create multiple different chunks
        const chunks = [
          createTestChunkData(4),
          createTestChunkData(6),
          createTestChunkData(8)
        ]

        const requests = chunks.map(chunkData => createTestMeshGenerationRequest(chunkData))

        // Generate all meshes concurrently
        const effects = requests.map(request => adapter.generateMesh(request))
        const results = yield* Effect.all(effects, { concurrency: 3 })

        // All should succeed
        expect(results.length).toBe(3)
        results.forEach(result => {
          expect(result.success).toBe(true)
          expect(result.meshData?.vertices.length).toBeGreaterThan(0)
        })
      }))
    })

    it('should provide accurate metadata', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService
        const chunkData = createTestChunkData(8)
        const request = createTestMeshGenerationRequest(chunkData, {
          generateNormals: true,
          generateUVs: false,
          optimizeVertices: true
        })

        const result = yield* adapter.generateMesh(request)

        expect(result.success).toBe(true)
        expect(result.metadata).toBeDefined()
        expect(result.metadata.algorithm).toBe('greedy')
        expect(result.metadata.chunkSize).toBe(8)
        expect(result.metadata.generationTimeMs).toBeGreaterThan(0)
        expect(result.metadata.vertexCount).toBe(result.meshData?.vertexCount)
        expect(result.metadata.triangleCount).toBe(result.meshData?.triangleCount)
        expect(result.metadata.hasNormals).toBe(true)
        expect(result.metadata.hasUVs).toBe(false)
        expect(result.metadata.isOptimized).toBe(true)
      }))
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid chunk data gracefully', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService

        // Create invalid chunk data
        const invalidChunkData: ChunkData = {
          chunkX: 0,
          chunkZ: 0,
          blocks: [], // Empty blocks array
          chunkSize: 16,
          blockTypes: []
        }

        const result = yield* Effect.exit(adapter.generateNaiveMesh(invalidChunkData))

        expect(result._tag).toBe('Failure')
      }))
    })

    it('should handle mismatched block array size', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService

        // Create chunk data with mismatched array size
        const invalidChunkData: ChunkData = {
          chunkX: 0,
          chunkZ: 0,
          blocks: [1, 0, 1], // Only 3 blocks instead of 16^3
          chunkSize: 16,
          blockTypes: ['air', 'stone']
        }

        const result = yield* Effect.exit(adapter.generateNaiveMesh(invalidChunkData))

        expect(result._tag).toBe('Failure')
      }))
    })

    it('should handle empty positions array for bounds calculation', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService
        const emptyPositions = new Float32Array([])

        const result = yield* Effect.exit(adapter.calculateBounds(emptyPositions))

        expect(result._tag).toBe('Failure')
      }))
    })

    it('should handle invalid positions array for bounds calculation', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService
        
        // Array length not divisible by 3 (invalid for 3D positions)
        const invalidPositions = new Float32Array([1, 2]) // Missing Z component

        const result = yield* Effect.exit(adapter.calculateBounds(invalidPositions))

        expect(result._tag).toBe('Failure')
      }))
    })
  })

  describe('Edge Cases', () => {
    it('should handle chunk with single block type', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService

        // All solid blocks
        const solidChunkData: ChunkData = {
          chunkX: 0,
          chunkZ: 0,
          blocks: new Array(4 * 4 * 4).fill(1), // All solid
          chunkSize: 4,
          blockTypes: ['air', 'stone']
        }

        const meshData = yield* adapter.generateGreedyMesh(solidChunkData)

        // Should generate a cube mesh (6 faces, 8 vertices minimum after optimization)
        expect(meshData.vertices.length).toBeGreaterThan(0)
        expect(meshData.indices.length).toBeGreaterThan(0)
        expect(meshData.triangleCount).toBe(12) // 2 triangles per face, 6 faces
      }))
    })

    it('should handle checkerboard pattern efficiently', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService

        // Create checkerboard pattern (alternating solid/air)
        const size = 4
        const blocks = new Array(size * size * size).fill(0).map((_, i) => {
          const x = i % size
          const y = Math.floor(i / (size * size)) % size
          const z = Math.floor(i / size) % size
          return (x + y + z) % 2 // Checkerboard pattern
        })

        const checkerboardChunkData: ChunkData = {
          chunkX: 0,
          chunkZ: 0,
          blocks,
          chunkSize: size,
          blockTypes: ['air', 'stone']
        }

        const naiveMesh = yield* adapter.generateNaiveMesh(checkerboardChunkData)
        const greedyMesh = yield* adapter.generateGreedyMesh(checkerboardChunkData)

        // Both should succeed
        expect(naiveMesh.vertices.length).toBeGreaterThan(0)
        expect(greedyMesh.vertices.length).toBeGreaterThan(0)

        // For checkerboard pattern, greedy algorithm should not provide significant optimization
        // since there are no adjacent faces to merge
        const naiveTriangles = naiveMesh.triangleCount
        const greedyTriangles = greedyMesh.triangleCount

        // The ratio should be close to 1 (minimal optimization possible)
        const optimizationRatio = greedyTriangles / naiveTriangles
        expect(optimizationRatio).toBeGreaterThan(0.7) // Less than 30% optimization expected
      }))
    })

    it('should handle large flat surfaces efficiently', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* MeshGeneratorAdapterService

        // Create large flat surface (solid bottom layer, air above)
        const size = 8
        const blocks = new Array(size * size * size).fill(0).map((_, i) => {
          const y = Math.floor(i / (size * size)) % size
          return y < 2 ? 1 : 0 // Bottom 2 layers are solid
        })

        const flatSurfaceChunkData: ChunkData = {
          chunkX: 0,
          chunkZ: 0,
          blocks,
          chunkSize: size,
          blockTypes: ['air', 'stone']
        }

        const naiveMesh = yield* adapter.generateNaiveMesh(flatSurfaceChunkData)
        const greedyMesh = yield* adapter.generateGreedyMesh(flatSurfaceChunkData)

        // Greedy algorithm should provide significant optimization for flat surfaces
        const optimizationRatio = greedyMesh.triangleCount / naiveMesh.triangleCount
        expect(optimizationRatio).toBeLessThan(0.5) // At least 50% optimization expected

        // Both should produce valid meshes
        expect(naiveMesh.vertices.length).toBeGreaterThan(0)
        expect(greedyMesh.vertices.length).toBeGreaterThan(0)
      }))
    })
  })
})