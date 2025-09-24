import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Exit, pipe, Match } from 'effect'
import {
  GreedyMeshingError,
  isGreedyMeshingError,
  GreedyMeshingService,
  GreedyMeshingLive,
  calculateVertexReduction,
} from '../GreedyMeshing'
import type { Quad, GreedyMeshingConfig } from '../GreedyMeshing'
import type { ChunkData, MeshData } from '../MeshGenerator'
import { BrandedTypes } from '../../../shared/types/branded'

// ========================================
// Test Helpers
// ========================================

const createTestChunk = (size: number, fillPattern: 'empty' | 'full' | 'checkerboard' | 'single'): ChunkData => {
  const blocks: number[][][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => 0))
  )

  pipe(fillPattern, (pattern) => {
    // Match.valueを使用したパターンマッチング
    Match.value(pattern).pipe(
      Match.when('full', () => {
        for (let x = 0; x < size; x++) {
          for (let y = 0; y < size; y++) {
            for (let z = 0; z < size; z++) {
              blocks[x]![y]![z] = 1
            }
          }
        }
      }),
      Match.when('checkerboard', () => {
        for (let x = 0; x < size; x++) {
          for (let y = 0; y < size; y++) {
            for (let z = 0; z < size; z++) {
              blocks[x]![y]![z] = (x + y + z) % 2 === 0 ? 1 : 0
            }
          }
        }
      }),
      Match.when('single', () => {
        blocks[0]![0]![0] = 1
      }),
      Match.when('empty', () => {
        // 空のパターン - 何もしない
      }),
      Match.orElse(() => {
        // デフォルトケース - 何もしない
      })
    )
  })

  return {
    position: { x: 0, y: 0, z: 0 },
    blocks,
    size,
  }
}

const runEffect = <A, E>(effect: Effect.Effect<A, E>) => Effect.runSyncExit(effect)

// ========================================
// Tests
// ========================================

describe('GreedyMeshing', () => {
  describe('Type Guards and Interfaces', () => {
    it.effect('should create valid Quad objects', () =>
      Effect.gen(function* () {
        const quad: Quad = {
          x: 0,
          y: 0,
          z: 0,
          width: BrandedTypes.createMeshDimension(1),
          height: BrandedTypes.createMeshDimension(1),
          axis: 0,
          blockType: 1,
          normal: [1, 0, 0],
        }

        expect(quad.x).toBe(0)
        expect(quad.y).toBe(0)
        expect(quad.z).toBe(0)
        expect(quad.width).toBe(BrandedTypes.createMeshDimension(1))
        expect(quad.height).toBe(BrandedTypes.createMeshDimension(1))
        expect(quad.axis).toBe(0)
        expect(quad.blockType).toBe(1)
        expect(quad.normal).toEqual([1, 0, 0])
      })
    )

    it.effect('should create valid GreedyMeshingConfig', () =>
      Effect.gen(function* () {
        const config: GreedyMeshingConfig = {
          chunkSize: 16,
          mergeThreshold: 0.95,
          optimizationLevel: 'balanced',
        }

        expect(config.chunkSize).toBe(16)
        expect(config.mergeThreshold).toBe(0.95)
        expect(config.optimizationLevel).toBe('balanced')
      })
    )

    it.effect('should handle all optimization levels', () =>
      Effect.gen(function* () {
        const levels: GreedyMeshingConfig['optimizationLevel'][] = ['basic', 'balanced', 'aggressive']

        levels.forEach((level) => {
          const config: GreedyMeshingConfig = {
            chunkSize: 16,
            mergeThreshold: 0.95,
            optimizationLevel: level,
          }
          expect(config.optimizationLevel).toBe(level)
        })
      })
    )
  })

  describe('GreedyMeshingService - generateGreedyMesh', () => {
    const getService = () => pipe(GreedyMeshingService, Effect.provide(GreedyMeshingLive), Effect.runSync)

    it.effect('should generate mesh for empty chunk', () =>
      Effect.gen(function* () {
        const chunk = createTestChunk(4, 'empty')

        const result = pipe(getService().generateGreedyMesh(chunk), Effect.runSync)

        expect(result.vertices).toHaveLength(0)
        expect(result.normals).toHaveLength(0)
        expect(result.uvs).toHaveLength(0)
        expect(result.indices).toHaveLength(0)
      })
    )

    it.effect('should generate optimized mesh for full chunk', () =>
      Effect.gen(function* () {
        const chunk = createTestChunk(4, 'full')

        const result = pipe(getService().generateGreedyMesh(chunk), Effect.runSync)

        // Full 4x4x4 chunk should be optimized to 6 large quads (one per face)
        expect(result.vertices.length).toBeGreaterThan(0)
        expect(result.vertices.length).toBeLessThan(4 * 4 * 4 * 24 * 3) // Less than naive cube vertices

        // Should have proper normals and uvs
        expect(result.normals.length).toBe(result.vertices.length)
        expect(result.uvs.length).toBe((result.vertices.length / 3) * 2)

        // Indices should be divisible by 3 (triangles)
        expect(result.indices.length % 3).toBe(0)
      })
    )

    it.effect('should handle checkerboard pattern efficiently', () =>
      Effect.gen(function* () {
        const chunk = createTestChunk(4, 'checkerboard')

        const result = pipe(getService().generateGreedyMesh(chunk), Effect.runSync)

        expect(result.vertices.length).toBeGreaterThan(0)
        expect(result.normals.length).toBe(result.vertices.length)
        expect(result.indices.length % 6).toBe(0) // Each quad has 6 indices (2 triangles)
      })
    )

    it.effect('should generate mesh for single block', () =>
      Effect.gen(function* () {
        const chunk = createTestChunk(4, 'single')

        const result = pipe(getService().generateGreedyMesh(chunk), Effect.runSync)

        // Single block should generate 6 faces
        expect(result.vertices.length).toBe(6 * 4 * 3) // 6 faces * 4 vertices * 3 coords
        expect(result.normals.length).toBe(result.vertices.length)
        expect(result.uvs.length).toBe(6 * 4 * 2) // 6 faces * 4 vertices * 2 UV coords
        expect(result.indices.length).toBe(6 * 6) // 6 faces * 6 indices per face
      })
    )

    it.effect('should handle large chunks efficiently', () =>
      Effect.gen(function* () {
        const chunk = createTestChunk(16, 'full')

        const startTime = performance.now()
        const result = pipe(getService().generateGreedyMesh(chunk), Effect.runSync)
        const endTime = performance.now()

        // Should complete within reasonable time (CI環境では処理が遅くなることを考慮)
        expect(endTime - startTime).toBeLessThan(150)

        // Should produce valid mesh
        expect(result.vertices.length).toBeGreaterThan(0)
        expect(result.normals.length).toBe(result.vertices.length)
      })
    )

    it.effect('should handle invalid chunk data gracefully', () =>
      Effect.gen(function* () {
        const invalidChunk = {
          position: { x: 0, y: 0, z: 0 },
          blocks: null as any,
          size: 4,
        }

        const result = runEffect(getService().generateGreedyMesh(invalidChunk))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result)) {
          const error = result.cause._tag === 'Fail' ? result.cause.error : null
          expect(isGreedyMeshingError(error)).toBe(true)
        }
      })
    )
  })

  describe('GreedyMeshingService - generateQuads', () => {
    const getService = () => pipe(GreedyMeshingService, Effect.provide(GreedyMeshingLive), Effect.runSync)

    it.effect('should generate quads for empty chunk', () =>
      Effect.gen(function* () {
        const chunk = createTestChunk(4, 'empty')

        const quads = pipe(getService().generateQuads(chunk), Effect.runSync)

        expect(quads).toHaveLength(0)
      })
    )

    it.effect('should generate quads with correct properties', () =>
      Effect.gen(function* () {
        const chunk = createTestChunk(4, 'single')

        const quads = pipe(getService().generateQuads(chunk), Effect.runSync)

        expect(quads.length).toBeGreaterThan(0)

        quads.forEach((quad) => {
          expect(quad.x).toBeGreaterThanOrEqual(0)
          expect(quad.y).toBeGreaterThanOrEqual(0)
          expect(quad.z).toBeGreaterThanOrEqual(0)
          expect(quad.width).toBeGreaterThan(0)
          expect(quad.height).toBeGreaterThan(0)
          expect(quad.axis).toBeGreaterThanOrEqual(0)
          expect(quad.axis).toBeLessThanOrEqual(2)
          expect(quad.blockType).toBeGreaterThan(0)
          expect(quad.normal).toHaveLength(3)
        })
      })
    )

    it.effect('should generate optimized quads for full chunk', () =>
      Effect.gen(function* () {
        const chunk = createTestChunk(4, 'full')

        const quads = pipe(getService().generateQuads(chunk), Effect.runSync)

        // Should merge adjacent faces
        expect(quads.length).toBeLessThan(4 * 4 * 4 * 6) // Less than naive cube faces

        // Check that quads have proper normals
        const normalDirections = new Set(quads.map((q) => q.normal.join(',')))
        expect(normalDirections.size).toBeLessThanOrEqual(6) // At most 6 normal directions
      })
    )

    it.effect('should handle all three axes', () =>
      Effect.gen(function* () {
        const chunk = createTestChunk(4, 'full')

        const quads = pipe(getService().generateQuads(chunk), Effect.runSync)

        const axes = new Set(quads.map((q) => q.axis))
        expect(axes.size).toBe(3) // Should have quads for all 3 axes
        expect(axes.has(0)).toBe(true)
        expect(axes.has(1)).toBe(true)
        expect(axes.has(2)).toBe(true)
      })
    )

    it.effect('should handle errors in quad generation', () =>
      Effect.gen(function* () {
        const invalidChunk = {
          position: { x: 0, y: 0, z: 0 },
          blocks: [[[]]] as any,
          size: -1,
        }

        const result = runEffect(getService().generateQuads(invalidChunk))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result)) {
          const error = result.cause._tag === 'Fail' ? result.cause.error : null
          expect(isGreedyMeshingError(error)).toBe(true)
          if (isGreedyMeshingError(error)) {
            expect(error.context).toBe('generateQuads')
          }
        }
      })
    )
  })

  describe('GreedyMeshingService - optimizeMesh', () => {
    const getService = () => pipe(GreedyMeshingService, Effect.provide(GreedyMeshingLive), Effect.runSync)

    it.effect('should optimize mesh data', () =>
      Effect.gen(function* () {
        const meshData: MeshData = {
          vertices: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
          normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          indices: [0, 1, 2, 0, 2, 3],
        }

        const optimized = pipe(getService().optimizeMesh(meshData), Effect.runSync)

        // For now, optimization returns the same mesh
        expect(optimized.vertices).toEqual(meshData.vertices)
        expect(optimized.normals).toEqual(meshData.normals)
        expect(optimized.uvs).toEqual(meshData.uvs)
        expect(optimized.indices).toEqual(meshData.indices)
      })
    )

    it.effect('should handle empty mesh data', () =>
      Effect.gen(function* () {
        const emptyMesh: MeshData = {
          vertices: [],
          normals: [],
          uvs: [],
          indices: [],
        }

        const optimized = pipe(getService().optimizeMesh(emptyMesh), Effect.runSync)

        expect(optimized.vertices).toEqual([])
        expect(optimized.normals).toEqual([])
        expect(optimized.uvs).toEqual([])
        expect(optimized.indices).toEqual([])
      })
    )
  })

  describe('Utility Functions', () => {
    it.effect('should calculate vertex reduction correctly', () =>
      Effect.gen(function* () {
        expect(calculateVertexReduction(100, 50)).toBe(50)
        expect(calculateVertexReduction(1000, 100)).toBe(90)
        expect(calculateVertexReduction(0, 0)).toBe(0)
        expect(calculateVertexReduction(100, 100)).toBe(0)
        expect(calculateVertexReduction(50, 100)).toBe(-100)
      })
    )

    it.effect('should handle edge cases in vertex reduction', () =>
      Effect.gen(function* () {
        expect(calculateVertexReduction(0, 100)).toBe(0) // Division by zero protection
        expect(calculateVertexReduction(-100, 50)).toBe(150) // (-100 - 50) / -100 * 100 = 150
        expect(calculateVertexReduction(100, -50)).toBe(150) // (100 - (-50)) / 100 * 100 = 150
      })
    )
  })

  describe('Error Handling', () => {
    it.effect('should create GreedyMeshingError with correct properties', () =>
      Effect.gen(function* () {
        const error = GreedyMeshingError('Test error', 'test', Date.now())

        expect(isGreedyMeshingError(error)).toBe(true)
        expect(error.reason).toBe('Test error')
        expect(error.context).toBe('test')
        expect(error.timestamp).toBeGreaterThan(0)
      })
    )

    it.effect('should handle errors in service methods', () =>
      Effect.gen(function* () {
        const getService = () => pipe(GreedyMeshingService, Effect.provide(GreedyMeshingLive), Effect.runSync)

        // Test with undefined blocks
        const badChunk = {
          position: { x: 0, y: 0, z: 0 },
          blocks: undefined as any,
          size: 4,
        }

        const result = runEffect(getService().generateGreedyMesh(badChunk))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe('Performance', () => {
    it.effect('should achieve significant vertex reduction', () =>
      Effect.gen(function* () {
        const getService = () => pipe(GreedyMeshingService, Effect.provide(GreedyMeshingLive), Effect.runSync)

        const chunk = createTestChunk(8, 'full')

        // Calculate naive vertex count (6 faces * 4 vertices * 3 coords per block)
        const naiveVertexCount = 8 * 8 * 8 * 6 * 4 * 3

        const result = pipe(getService().generateGreedyMesh(chunk), Effect.runSync)

        const optimizedVertexCount = result.vertices.length
        const reduction = calculateVertexReduction(naiveVertexCount, optimizedVertexCount)

        // Should achieve at least 90% reduction for a full chunk
        expect(reduction).toBeGreaterThan(90)
      })
    )

    it.effect('should complete within performance budget', () =>
      Effect.gen(function* () {
        const getService = () => pipe(GreedyMeshingService, Effect.provide(GreedyMeshingLive), Effect.runSync)

        const chunk = createTestChunk(16, 'checkerboard')

        const startTime = performance.now()
        pipe(getService().generateGreedyMesh(chunk), Effect.runSync)
        const endTime = performance.now()

        // Should complete within 300ms for 16x16x16 chunk (adjusted for CI environment)
        expect(endTime - startTime).toBeLessThan(300)
      })
    )
  })

  describe('Layer Construction', () => {
    it.effect('should provide GreedyMeshingLive layer', () =>
      Effect.gen(function* () {
        const program = pipe(
          GreedyMeshingService,
          Effect.map((service) => {
            expect(service).toBeDefined()
            expect(service.generateGreedyMesh).toBeDefined()
            expect(service.generateQuads).toBeDefined()
            expect(service.optimizeMesh).toBeDefined()
            return true
          })
        )

        const result = pipe(program, Effect.provide(GreedyMeshingLive), Effect.runSync)

        expect(result).toBe(true)
      })
    )
  })
})
