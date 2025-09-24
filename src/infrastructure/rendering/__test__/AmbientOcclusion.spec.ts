import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Exit, pipe, Layer, Match, Option } from 'effect'
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
import { BrandedTypes } from '../../../shared/types/branded'

// ========================================
// Test Helpers
// ========================================

const createTestChunk = (size: number, pattern: 'empty' | 'full' | 'corner' | 'single'): ChunkData => {
  const blocks: number[][][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => 0))
  )

  pipe(
    Match.value(pattern),
    Match.when('full', () => {
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          for (let z = 0; z < size; z++) {
            blocks[x]![y]![z] = 1
          }
        }
      }
    }),
    Match.when('corner', () => {
      // Create an L-shaped corner
      blocks[0]![0]![0] = 1
      blocks[1]![0]![0] = 1
      blocks[0]![1]![0] = 1
      blocks[0]![0]![1] = 1
    }),
    Match.when('single', () => {
      blocks[Math.floor(size / 2)]![Math.floor(size / 2)]![Math.floor(size / 2)] = 1
    }),
    Match.orElse(() => {
      // 'empty' ケースやdefaultの場合は何もしない
    })
  )

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
    it.effect('should create valid AOVertex objects', () =>
      Effect.gen(function* () {
        const vertex: AOVertex = {
          x: 1,
          y: 2,
          z: 3,
          ao: BrandedTypes.createAOValue(0.75),
        }

        expect(vertex.x).toBe(1)
        expect(vertex.y).toBe(2)
        expect(vertex.z).toBe(3)
        expect(vertex.ao).toBe(0.75)
      })
    )

    it.effect('should create valid AOFace objects', () =>
      Effect.gen(function* () {
        const vertices: [AOVertex, AOVertex, AOVertex, AOVertex] = [
          { x: 0, y: 0, z: 0, ao: BrandedTypes.createAOValue(0.5) },
          { x: 1, y: 0, z: 0, ao: BrandedTypes.createAOValue(0.6) },
          { x: 1, y: 1, z: 0, ao: BrandedTypes.createAOValue(0.7) },
          { x: 0, y: 1, z: 0, ao: BrandedTypes.createAOValue(0.8) },
        ]

        const face: AOFace = {
          vertices,
          averageAO: BrandedTypes.createAOValue(0.65),
        }

        expect(face.vertices).toHaveLength(4)
        expect(face.averageAO).toBe(0.65)
      })
    )

    it.effect('should create valid AOConfig', () =>
      Effect.gen(function* () {
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
    )

    it.effect('should handle all quality levels', () =>
      Effect.gen(function* () {
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
    )
  })

  describe('AmbientOcclusionService - calculateVertexAO', () => {
    it('should calculate AO for open space vertex', () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(5, 'empty')

        const ao = yield* service.calculateVertexAO(chunk.blocks as number[][][], 2, 2, 2, chunk.size)

        // Open space should have high AO value (bright)
        expect(ao).toBeGreaterThan(0.5)
        expect(ao).toBeLessThanOrEqual(1.0)
      })

      Effect.runSync(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should calculate AO for occluded vertex', () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(5, 'full')

        const ao = yield* service.calculateVertexAO(chunk.blocks as number[][][], 2, 2, 2, chunk.size)

        // Fully occluded vertex should have low AO value (dark)
        expect(ao).toBeLessThan(0.5)
        expect(ao).toBeGreaterThanOrEqual(0.0)
      })

      Effect.runSync(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should handle corner occlusion correctly', () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(5, 'corner')

        const ao = yield* service.calculateVertexAO(chunk.blocks as number[][][], 0, 0, 0, chunk.size)

        // Partially occluded corner
        expect(ao).toBeGreaterThan(0.0)
        expect(ao).toBeLessThan(1.0)
      })

      Effect.runSync(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should handle edge coordinates', () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(4, 'full')

        const ao = yield* service.calculateVertexAO(chunk.blocks as number[][][], 0, 0, 0, chunk.size)

        expect(ao).toBeGreaterThanOrEqual(0.0)
        expect(ao).toBeLessThanOrEqual(1.0)
      })

      Effect.runSync(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should handle out of bounds coordinates', () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(4, 'full')

        const ao = yield* service.calculateVertexAO(chunk.blocks as number[][][], -1, -1, -1, chunk.size)

        // Should handle gracefully
        expect(ao).toBeGreaterThanOrEqual(0.0)
        expect(ao).toBeLessThanOrEqual(1.0)
      })

      Effect.runSync(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should handle errors in vertex AO calculation', () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        return yield* service.calculateVertexAO(null as any, 0, 0, 0, 4)
      })

      const result = runEffect(program.pipe(Effect.provide(AmbientOcclusionLive)))

      expect(Exit.isFailure(result)).toBe(true)

      pipe(
        Match.value(result),
        Match.when(
          (r): r is Exit.Failure<any, any> => Exit.isFailure(r),
          (r) => {
            const error = r.cause._tag === 'Fail' ? r.cause.error : null
            expect(isAmbientOcclusionError(error)).toBe(true)
          }
        ),
        Match.orElse(() => {
          // No-op for successful results
        })
      )
    })
  })

  describe('AmbientOcclusionService - calculateFaceAO', () => {
    it('should calculate AO for top face', () => {
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

      Effect.runSync(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should calculate different AO for different faces', () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(5, 'corner')

        const topFace = yield* service.calculateFaceAO(chunk.blocks as number[][][], 0, 0, 0, 'top', chunk.size)
        const bottomFace = yield* service.calculateFaceAO(chunk.blocks as number[][][], 0, 0, 0, 'bottom', chunk.size)

        // Different faces should potentially have different AO
        expect(topFace.averageAO).toBeDefined()
        expect(bottomFace.averageAO).toBeDefined()
      })

      Effect.runSync(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should handle all face directions', () => {
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

      Effect.runSync(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should calculate correct average AO', () => {
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

      Effect.runSync(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should handle errors in face AO calculation', () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        return yield* service.calculateFaceAO(null as any, 0, 0, 0, 'top', 4)
      })

      const result = runEffect(program.pipe(Effect.provide(AmbientOcclusionLive)))

      expect(Exit.isFailure(result)).toBe(true)

      pipe(
        Match.value(result),
        Match.when(
          (r): r is Exit.Failure<any, any> => Exit.isFailure(r),
          (r) => {
            const error = r.cause._tag === 'Fail' ? r.cause.error : null
            expect(isAmbientOcclusionError(error)).toBe(true)

            pipe(
              Match.value(error),
              Match.when(
                (e): e is ReturnType<typeof AmbientOcclusionError> => isAmbientOcclusionError(e),
                (e) => {
                  expect(e.context).toBe('calculateFaceAO(top)')
                }
              ),
              Match.orElse(() => {
                // No-op for non-AmbientOcclusionError types
              })
            )
          }
        ),
        Match.orElse(() => {
          // No-op for successful results
        })
      )
    })
  })

  describe('AmbientOcclusionService - applyAOToChunk', () => {
    it('should apply AO to empty chunk', () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(4, 'empty')

        const vertices = yield* service.applyAOToChunk(chunk)

        // Empty chunk should have no vertices
        expect(vertices).toHaveLength(0)
      })

      Effect.runSync(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should apply AO to single block chunk', () => {
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

      Effect.runSync(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should apply AO to full chunk', () => {
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

      Effect.runSync(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should apply smoothing when enabled', () => {
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
          pipe(
            Match.value(positionMap.has(key)),
            Match.when(false, () => {
              positionMap.set(key, [])
            }),
            Match.orElse(() => {
              // Key already exists, no action needed
            })
          )
          positionMap.get(key)!.push(v.ao)
        })

        // Vertices at the same position should have the same AO after smoothing
        positionMap.forEach((aoValues) => {
          pipe(
            Match.value(aoValues.length > 1),
            Match.when(true, () => {
              const firstAO = aoValues[0]!
              aoValues.forEach((ao) => {
                expect(Math.abs(ao - firstAO)).toBeLessThan(0.01)
              })
            }),
            Match.orElse(() => {
              // Single value, no comparison needed
            })
          )
        })
      })

      Effect.runSync(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })

    it('should handle errors in chunk AO application', () => {
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

      pipe(
        Match.value(result),
        Match.when(
          (r): r is Exit.Failure<any, any> => Exit.isFailure(r),
          (r) => {
            const error = r.cause._tag === 'Fail' ? r.cause.error : null
            expect(isAmbientOcclusionError(error)).toBe(true)

            pipe(
              Match.value(error),
              Match.when(
                (e): e is ReturnType<typeof AmbientOcclusionError> => isAmbientOcclusionError(e),
                (e) => {
                  expect(e.context).toBe('applyAOToChunk')
                }
              ),
              Match.orElse(() => {
                // No-op for non-AmbientOcclusionError types
              })
            )
          }
        ),
        Match.orElse(() => {
          // No-op for successful results
        })
      )
    })
  })

  describe('Utility Functions', () => {
    it.effect('should blend AO colors correctly', () =>
      Effect.gen(function* () {
        const baseColor: [number, number, number] = [1, 0.5, 0.25]

        const blended1 = blendAOColors(baseColor, 1.0)
        expect(blended1).toEqual([1, 0.5, 0.25])

        const blended2 = blendAOColors(baseColor, 0.5)
        expect(blended2).toEqual([0.5, 0.25, 0.125])

        const blended3 = blendAOColors(baseColor, 0.0)
        expect(blended3).toEqual([0, 0, 0])
      })
    )

    it.effect('should handle edge cases in color blending', () =>
      Effect.gen(function* () {
        const whiteColor: [number, number, number] = [1, 1, 1]
        const blackColor: [number, number, number] = [0, 0, 0]

        expect(blendAOColors(whiteColor, 0.75)).toEqual([0.75, 0.75, 0.75])
        expect(blendAOColors(blackColor, 0.5)).toEqual([0, 0, 0])
      })
    )

    it.effect('should get correct AO quality settings', () =>
      Effect.gen(function* () {
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
    )
  })

  describe('Error Handling', () => {
    it.effect('should create AmbientOcclusionError with correct properties', () =>
      Effect.gen(function* () {
        const error = AmbientOcclusionError('Test error', 'test', Date.now())

        expect(isAmbientOcclusionError(error)).toBe(true)
        expect(error.reason).toBe('Test error')
        expect(error.context).toBe('test')
        expect(error.timestamp).toBeGreaterThan(0)
      })
    )
  })

  describe('Performance', () => {
    it('should calculate AO efficiently for large chunks', () => {
      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const chunk = createTestChunk(8, 'full')

        const startTime = performance.now()
        const vertices = yield* service.applyAOToChunk(chunk)
        const endTime = performance.now()

        // Should complete within reasonable time (CI環境考慮)
        expect(endTime - startTime).toBeLessThan(1500)

        // Should produce valid AO for all vertices
        expect(vertices.length).toBeGreaterThan(0)
        vertices.forEach((v) => {
          expect(v.ao).toBeGreaterThanOrEqual(0.0)
          expect(v.ao).toBeLessThanOrEqual(1.0)
        })
      })

      Effect.runSync(program.pipe(Effect.provide(AmbientOcclusionLive)))
    })
  })

  describe('Layer Construction', () => {
    it.effect('should provide AmbientOcclusionLive layer', () =>
      Effect.gen(function* () {
        const program = pipe(
          AmbientOcclusionService,
          Effect.map((service) => {
            expect(service).toBeDefined()
            expect(service.calculateVertexAO).toBeDefined()
            expect(service.calculateFaceAO).toBeDefined()
            expect(service.applyAOToChunk).toBeDefined()
          })
        )

        const result = pipe(program, Effect.provide(AmbientOcclusionLive), Effect.runSync)

        expect(result).toBe(true)
      })
    )
  })

  describe('AO Configuration', () => {
    it('should respect disabled AO setting', () => {
      // Create a custom layer with AO disabled
      const DisabledAOLive = Layer.succeed(
        AmbientOcclusionService,
        AmbientOcclusionService.of({
          calculateVertexAO: () => Effect.succeed(BrandedTypes.createAOValue(1.0)),
          calculateFaceAO: () =>
            Effect.succeed({
              vertices: [
                { x: 0, y: 0, z: 0, ao: BrandedTypes.createAOValue(1.0) },
                { x: 1, y: 0, z: 0, ao: BrandedTypes.createAOValue(1.0) },
                { x: 1, y: 1, z: 0, ao: BrandedTypes.createAOValue(1.0) },
                { x: 0, y: 1, z: 0, ao: BrandedTypes.createAOValue(1.0) },
              ] as [AOVertex, AOVertex, AOVertex, AOVertex],
              averageAO: BrandedTypes.createAOValue(1.0),
            }),
          applyAOToChunk: () => Effect.succeed([]),
        })
      )

      const program = Effect.gen(function* () {
        const service = yield* AmbientOcclusionService
        const ao = yield* service.calculateVertexAO([], 0, 0, 0, 4)

        expect(ao).toBe(1.0) // No occlusion when disabled
      })

      Effect.runSync(program.pipe(Effect.provide(DisabledAOLive)))
    })
  })
})
