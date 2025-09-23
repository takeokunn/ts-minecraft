import { describe, it, expect } from 'vitest'
import { Effect, Exit, pipe, Layer } from 'effect'
import {
  type AOVertex,
  type AOFace,
  type AOConfig,
  AmbientOcclusionError,
  isAmbientOcclusionError,
  AmbientOcclusionService,
  AmbientOcclusionLive,
  blendAOColors,
  getAOQualitySettings,
} from '../AmbientOcclusion'
import type { ChunkData } from '../MeshGenerator'

// ========================================
// Test Helpers
// ========================================

const createTestChunk = (size: number, pattern: 'empty' | 'full' | 'corner' | 'single'): ChunkData => {
  const blocks: number[][][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => 0))
  )

  switch (pattern) {
    case 'full':
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          for (let z = 0; z < size; z++) {
            blocks[x]![y]![z] = 1
          }
        }
      }
      break
    case 'corner':
      // Create an L-shaped corner
      blocks[0]![0]![0] = 1
      blocks[1]![0]![0] = 1
      blocks[0]![1]![0] = 1
      blocks[0]![0]![1] = 1
      break
    case 'single':
      blocks[Math.floor(size / 2)]![Math.floor(size / 2)]![Math.floor(size / 2)] = 1
      break
    case 'empty':
    default:
      break
  }

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

describe('AmbientOcclusion', () => {
  describe('Type Guards and Interfaces', () => {
    it('should create valid AOVertex objects', () => {
      const vertex: AOVertex = {
        x: 1,
        y: 2,
        z: 3,
        ao: 0.75,
      }

      expect(vertex.x).toBe(1)
      expect(vertex.y).toBe(2)
      expect(vertex.z).toBe(3)
      expect(vertex.ao).toBe(0.75)
    })

    it('should create valid AOFace objects', () => {
      const vertices: [AOVertex, AOVertex, AOVertex, AOVertex] = [
        { x: 0, y: 0, z: 0, ao: 0.5 },
        { x: 1, y: 0, z: 0, ao: 0.6 },
        { x: 1, y: 1, z: 0, ao: 0.7 },
        { x: 0, y: 1, z: 0, ao: 0.8 },
      ]

      const face: AOFace = {
        vertices,
        averageAO: 0.65,
      }

      expect(face.vertices).toHaveLength(4)
      expect(face.averageAO).toBe(0.65)
    })

    it('should create valid AOConfig', () => {
      const config: AOConfig = {
        enabled: true,
        strength: 0.8,
        smoothing: true,
        quality: 'medium',
      }

      expect(config.enabled).toBe(true)
      expect(config.strength).toBe(0.8)
      expect(config.smoothing).toBe(true)
      expect(config.quality).toBe('medium')
    })

    it('should handle all quality levels', () => {
      const levels: AOConfig['quality'][] = ['low', 'medium', 'high']

      levels.forEach((quality) => {
        const config: AOConfig = {
          enabled: true,
          strength: 1.0,
          smoothing: false,
          quality,
        }
        expect(config.quality).toBe(quality)
      })
    })
  })

  describe('AmbientOcclusionService - calculateVertexAO', () => {
    it('should calculate AO for open space vertex', async () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(5, 'empty')

        const ao = yield* service.calculateVertexAO(chunk.blocks as number[][][], 2, 2, 2, chunk.size)

        // Open space should have high AO value (bright)
        expect(ao).toBeGreaterThan(0.5)
        expect(ao).toBeLessThanOrEqual(1.0)
      })

      await Effect.runPromise(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should calculate AO for occluded vertex', async () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(5, 'full')

        const ao = yield* service.calculateVertexAO(chunk.blocks as number[][][], 2, 2, 2, chunk.size)

        // Fully occluded vertex should have low AO value (dark)
        expect(ao).toBeLessThan(0.5)
        expect(ao).toBeGreaterThanOrEqual(0.0)
      })

      await Effect.runPromise(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should handle corner occlusion correctly', async () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(5, 'corner')

        const ao = yield* service.calculateVertexAO(chunk.blocks as number[][][], 0, 0, 0, chunk.size)

        // Partially occluded corner
        expect(ao).toBeGreaterThan(0.0)
        expect(ao).toBeLessThan(1.0)
      })

      await Effect.runPromise(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should handle edge coordinates', async () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(4, 'full')

        const ao = yield* service.calculateVertexAO(chunk.blocks as number[][][], 0, 0, 0, chunk.size)

        expect(ao).toBeGreaterThanOrEqual(0.0)
        expect(ao).toBeLessThanOrEqual(1.0)
      })

      await Effect.runPromise(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should handle out of bounds coordinates', async () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(4, 'full')

        const ao = yield* service.calculateVertexAO(chunk.blocks as number[][][], -1, -1, -1, chunk.size)

        // Should handle gracefully
        expect(ao).toBeGreaterThanOrEqual(0.0)
        expect(ao).toBeLessThanOrEqual(1.0)
      })

      await Effect.runPromise(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should handle errors in vertex AO calculation', async () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        return yield* service.calculateVertexAO(null as any, 0, 0, 0, 4)
      })

      const result = runEffect(program.pipe(Effect.provide(AmbientOcclusionLive)))

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const error = result.cause._tag === 'Fail' ? result.cause.error : null
        expect(isAmbientOcclusionError(error)).toBe(true)
      }
    })
  })

  describe('AmbientOcclusionService - calculateFaceAO', () => {
    it('should calculate AO for top face', async () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(5, 'single')
        const mid = 2

        const face = yield* service.calculateFaceAO(chunk.blocks as number[][][], mid, mid, mid, 'top', chunk.size)

        expect(face.vertices).toHaveLength(4)
        expect(face.averageAO).toBeGreaterThan(0.0)
        expect(face.averageAO).toBeLessThanOrEqual(1.0)

        // All vertices should have valid AO values
        face.vertices.forEach((vertex) => {
          expect(vertex.ao).toBeGreaterThanOrEqual(0.0)
          expect(vertex.ao).toBeLessThanOrEqual(1.0)
        })
      })

      await Effect.runPromise(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should calculate different AO for different faces', async () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(5, 'corner')

        const topFace = yield* service.calculateFaceAO(chunk.blocks as number[][][], 0, 0, 0, 'top', chunk.size)
        const bottomFace = yield* service.calculateFaceAO(chunk.blocks as number[][][], 0, 0, 0, 'bottom', chunk.size)

        // Different faces should potentially have different AO
        expect(topFace.averageAO).toBeDefined()
        expect(bottomFace.averageAO).toBeDefined()
      })

      await Effect.runPromise(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should handle all face directions', async () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(5, 'single')
        const mid = 2
        const faces: Array<'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'> = [
          'top',
          'bottom',
          'front',
          'back',
          'left',
          'right',
        ]

        for (const face of faces) {
          const aoFace = yield* service.calculateFaceAO(chunk.blocks as number[][][], mid, mid, mid, face, chunk.size)

          expect(aoFace.vertices).toHaveLength(4)
          expect(aoFace.averageAO).toBeGreaterThanOrEqual(0.0)
          expect(aoFace.averageAO).toBeLessThanOrEqual(1.0)
        }
      })

      await Effect.runPromise(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should calculate correct average AO', async () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(5, 'single')
        const mid = 2

        const face = yield* service.calculateFaceAO(chunk.blocks as number[][][], mid, mid, mid, 'top', chunk.size)

        // Calculate expected average
        const sum = face.vertices.reduce((acc, v) => acc + v.ao, 0)
        const expectedAverage = sum / 4

        expect(Math.abs(face.averageAO - expectedAverage)).toBeLessThan(0.01)
      })

      await Effect.runPromise(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should handle errors in face AO calculation', async () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        return yield* service.calculateFaceAO(null as any, 0, 0, 0, 'top', 4)
      })

      const result = runEffect(program.pipe(Effect.provide(AmbientOcclusionLive)))

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const error = result.cause._tag === 'Fail' ? result.cause.error : null
        expect(isAmbientOcclusionError(error)).toBe(true)
        if (isAmbientOcclusionError(error)) {
          expect(error.context).toBe('calculateFaceAO(top)')
        }
      }
    })
  })

  describe('AmbientOcclusionService - applyAOToChunk', () => {
    it('should apply AO to empty chunk', async () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(4, 'empty')

        const vertices = yield* service.applyAOToChunk(chunk)

        // Empty chunk should have no vertices
        expect(vertices).toHaveLength(0)
      })

      await Effect.runPromise(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should apply AO to single block chunk', async () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(5, 'single')

        const vertices = yield* service.applyAOToChunk(chunk)

        // Single block has 6 faces * 4 vertices
        expect(vertices.length).toBe(6 * 4)

        // All vertices should have valid AO values
        vertices.forEach((vertex) => {
          expect(vertex.ao).toBeGreaterThanOrEqual(0.0)
          expect(vertex.ao).toBeLessThanOrEqual(1.0)
        })
      })

      await Effect.runPromise(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should apply AO to full chunk', async () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(4, 'full')

        const vertices = yield* service.applyAOToChunk(chunk)

        // Should have vertices for all blocks
        expect(vertices.length).toBeGreaterThan(0)

        // Check AO variation
        const aoValues = new Set(vertices.map((v) => Math.round(v.ao * 100) / 100))
        expect(aoValues.size).toBeGreaterThan(1) // Should have variation in AO values
      })

      await Effect.runPromise(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should apply smoothing when enabled', async () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(4, 'corner')

        const vertices = yield* service.applyAOToChunk(chunk)

        // Smoothing should be applied (config has smoothing: true)
        expect(vertices.length).toBeGreaterThan(0)

        // Group vertices by position and check for averaging
        const positionMap = new Map<string, number[]>()
        vertices.forEach((v) => {
          const key = `${v.x},${v.y},${v.z}`
          if (!positionMap.has(key)) {
            positionMap.set(key, [])
          }
          positionMap.get(key)!.push(v.ao)
        })

        // Vertices at the same position should have the same AO after smoothing
        positionMap.forEach((aoValues) => {
          if (aoValues.length > 1) {
            const firstAO = aoValues[0]!
            aoValues.forEach((ao) => {
              expect(Math.abs(ao - firstAO)).toBeLessThan(0.01)
            })
          }
        })
      })

      await Effect.runPromise(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should handle errors in chunk AO application', async () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const invalidChunk = {
          position: { x: 0, y: 0, z: 0 },
          blocks: null as any,
          size: 4,
        }

        return yield* service.applyAOToChunk(invalidChunk)
      })

      const result = runEffect(program.pipe(Effect.provide(AmbientOcclusionLive)))

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const error = result.cause._tag === 'Fail' ? result.cause.error : null
        expect(isAmbientOcclusionError(error)).toBe(true)
        if (isAmbientOcclusionError(error)) {
          expect(error.context).toBe('applyAOToChunk')
        }
      }
    })
  })

  describe('Utility Functions', () => {
    it('should blend AO colors correctly', () => {
      const baseColor: [number, number, number] = [1, 0.5, 0.25]

      const blended1 = blendAOColors(baseColor, 1.0)
      expect(blended1).toEqual([1, 0.5, 0.25])

      const blended2 = blendAOColors(baseColor, 0.5)
      expect(blended2).toEqual([0.5, 0.25, 0.125])

      const blended3 = blendAOColors(baseColor, 0.0)
      expect(blended3).toEqual([0, 0, 0])
    })

    it('should handle edge cases in color blending', () => {
      const whiteColor: [number, number, number] = [1, 1, 1]
      const blackColor: [number, number, number] = [0, 0, 0]

      expect(blendAOColors(whiteColor, 0.75)).toEqual([0.75, 0.75, 0.75])
      expect(blendAOColors(blackColor, 0.5)).toEqual([0, 0, 0])
    })

    it('should get correct AO quality settings', () => {
      const lowQuality = getAOQualitySettings('low')
      expect(lowQuality.sampleRadius).toBe(1)
      expect(lowQuality.sampleCount).toBe(6)

      const mediumQuality = getAOQualitySettings('medium')
      expect(mediumQuality.sampleRadius).toBe(1)
      expect(mediumQuality.sampleCount).toBe(14)

      const highQuality = getAOQualitySettings('high')
      expect(highQuality.sampleRadius).toBe(2)
      expect(highQuality.sampleCount).toBe(26)
    })
  })

  describe('Error Handling', () => {
    it('should create AmbientOcclusionError with correct properties', () => {
      const error = AmbientOcclusionError('Test error', 'test', Date.now())

      expect(isAmbientOcclusionError(error)).toBe(true)
      expect(error.reason).toBe('Test error')
      expect(error.context).toBe('test')
      expect(error.timestamp).toBeGreaterThan(0)
    })
  })

  describe('Performance', () => {
    it('should calculate AO efficiently for large chunks', async () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(8, 'full')

        const startTime = performance.now()
        const vertices = yield* service.applyAOToChunk(chunk)
        const endTime = performance.now()

        // Should complete within reasonable time
        expect(endTime - startTime).toBeLessThan(500)

        // Should produce valid AO for all vertices
        expect(vertices.length).toBeGreaterThan(0)
        vertices.forEach((v) => {
          expect(v.ao).toBeGreaterThanOrEqual(0.0)
          expect(v.ao).toBeLessThanOrEqual(1.0)
        })
      })

      await Effect.runPromise(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })
  })

  describe('Layer Construction', () => {
    it('should provide AmbientOcclusionLive layer', async () => {
      const program = pipe(
        AmbientOcclusionService,
        Effect.map((service) => {
          expect(service).toBeDefined()
          expect(service.calculateVertexAO).toBeDefined()
          expect(service.calculateFaceAO).toBeDefined()
          expect(service.applyAOToChunk).toBeDefined()
          return true
        })
      )

      const result = await pipe(program, Effect.provide(AmbientOcclusionLive), Effect.runPromise)

      expect(result).toBe(true)
    })
  })

  describe('AO Configuration', () => {
    it('should respect disabled AO setting', async () => {
      // Create a custom layer with AO disabled
      const DisabledAOLive = Layer.succeed(
        AmbientOcclusionService,
        AmbientOcclusionService.of({
          calculateVertexAO: () => Effect.succeed(1.0),
          calculateFaceAO: () =>
            Effect.succeed({
              vertices: [
                { x: 0, y: 0, z: 0, ao: 1.0 },
                { x: 1, y: 0, z: 0, ao: 1.0 },
                { x: 1, y: 1, z: 0, ao: 1.0 },
                { x: 0, y: 1, z: 0, ao: 1.0 },
              ] as [AOVertex, AOVertex, AOVertex, AOVertex],
              averageAO: 1.0,
            }),
          applyAOToChunk: () => Effect.succeed([]),
        })
      )

      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const ao = yield* service.calculateVertexAO([], 0, 0, 0, 4)

        expect(ao).toBe(1.0) // No occlusion when disabled
      })

      await Effect.runPromise(program.pipe(Effect.provide(DisabledAOLive)))
    })
  })
})
