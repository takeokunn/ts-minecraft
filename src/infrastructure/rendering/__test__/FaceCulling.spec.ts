import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Exit, pipe, Match } from 'effect'
import {
  FaceCullingError,
  isFaceCullingError,
  FaceCullingService,
  FaceCullingLive,
  calculateFaceCullingStats,
  optimizeFaceVisibility,
} from '../FaceCulling'
import type { FaceVisibility, CullingConfig } from '../FaceCulling'
import type { ChunkData } from '../MeshGenerator'

// ========================================
// Test Helpers
// ========================================

const createTestChunk = (size: number, pattern: 'empty' | 'full' | 'hollow' | 'single'): ChunkData => {
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
    Match.when('hollow', () => {
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          for (let z = 0; z < size; z++) {
            if (x === 0 || x === size - 1 || y === 0 || y === size - 1 || z === 0 || z === size - 1) {
              blocks[x]![y]![z] = 1
            }
          }
        }
      }
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

describe('FaceCulling', () => {
  describe('Type Guards and Interfaces', () => {
    it.effect('should create valid FaceVisibility objects', () =>
      Effect.gen(function* () {
        const visibility: FaceVisibility = {
          top: true,
          bottom: false,
          front: true,
          back: false,
          left: true,
          right: false,
        }

        expect(visibility.top).toBe(true)
        expect(visibility.bottom).toBe(false)
        expect(visibility.front).toBe(true)
        expect(visibility.back).toBe(false)
        expect(visibility.left).toBe(true)
        expect(visibility.right).toBe(false)
      })
    )

    it.effect('should create valid CullingConfig', () =>
      Effect.gen(function* () {
        const config: CullingConfig = {
          enableBackfaceCulling: true,
          enableOcclusionCulling: true,
          transparentBlocks: new Set([0, 10, 20]),
        }

        expect(config.enableBackfaceCulling).toBe(true)
        expect(config.enableOcclusionCulling).toBe(true)
        expect(config.transparentBlocks.has(0)).toBe(true)
        expect(config.transparentBlocks.has(10)).toBe(true)
        expect(config.transparentBlocks.has(20)).toBe(true)
      })
    )
  })

  describe('FaceCullingService - checkFaceVisibility', () => {
    const getService = () => pipe(FaceCullingService, Effect.provide(FaceCullingLive), Effect.runSync)

    it.effect('should return no visible faces for air block', () =>
      Effect.gen(function* () {
        const chunk = createTestChunk(4, 'empty')

        const visibility = pipe(
          getService().checkFaceVisibility(chunk.blocks as number[][][], 0, 0, 0, chunk.size),
          Effect.runSync
        )

        expect(visibility.top).toBe(false)
        expect(visibility.bottom).toBe(false)
        expect(visibility.front).toBe(false)
        expect(visibility.back).toBe(false)
        expect(visibility.left).toBe(false)
        expect(visibility.right).toBe(false)
      })
    )

    it.effect('should detect all visible faces for isolated block', () =>
      Effect.gen(function* () {
        const chunk = createTestChunk(5, 'single')
        const mid = 2

        const visibility = pipe(
          getService().checkFaceVisibility(chunk.blocks as number[][][], mid, mid, mid, chunk.size),
          Effect.runSync
        )

        expect(visibility.top).toBe(true)
        expect(visibility.bottom).toBe(true)
        expect(visibility.front).toBe(true)
        expect(visibility.back).toBe(true)
        expect(visibility.left).toBe(true)
        expect(visibility.right).toBe(true)
      })
    )

    it.effect('should detect edge faces at chunk boundaries', () =>
      Effect.gen(function* () {
        const chunk = createTestChunk(4, 'full')

        // Corner block
        const visibility = pipe(
          getService().checkFaceVisibility(chunk.blocks as number[][][], 0, 0, 0, chunk.size),
          Effect.runSync
        )

        expect(visibility.left).toBe(true) // At boundary
        expect(visibility.bottom).toBe(true) // At boundary
        expect(visibility.back).toBe(true) // At boundary
        expect(visibility.right).toBe(false) // Has neighbor
        expect(visibility.top).toBe(false) // Has neighbor
        expect(visibility.front).toBe(false) // Has neighbor
      })
    )

    it.effect('should handle out of bounds coordinates gracefully', () =>
      Effect.gen(function* () {
        const chunk = createTestChunk(4, 'full')

        // Out of bounds coordinates
        const visibility = pipe(
          getService().checkFaceVisibility(chunk.blocks as number[][][], -1, -1, -1, chunk.size),
          Effect.runSync
        )

        // Air blocks have no visible faces
        expect(visibility.top).toBe(false)
        expect(visibility.bottom).toBe(false)
      })
    )

    it.effect('should handle errors in face visibility check', () =>
      Effect.gen(function* () {
        const result = runEffect(getService().checkFaceVisibility(null as any, 0, 0, 0, 4))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result)) {
          const error = result.cause._tag === 'Fail' ? result.cause.error : null
          expect(isFaceCullingError(error)).toBe(true)
        }
      })
    )
  })

  describe('FaceCullingService - shouldRenderFace', () => {
    const getService = () => pipe(FaceCullingService, Effect.provide(FaceCullingLive), Effect.runSync)

    it.effect('should not render face for air block', () =>
      Effect.gen(function* () {
        const shouldRender = pipe(getService().shouldRenderFace(0, 1), Effect.runSync)

        expect(shouldRender).toBe(false)
      })
    )

    it.effect('should render face when neighbor is air', () =>
      Effect.gen(function* () {
        const shouldRender = pipe(getService().shouldRenderFace(1, 0), Effect.runSync)

        expect(shouldRender).toBe(true)
      })
    )

    it.effect('should not render face when neighbor is solid', () =>
      Effect.gen(function* () {
        const shouldRender = pipe(getService().shouldRenderFace(1, 1), Effect.runSync)

        expect(shouldRender).toBe(false)
      })
    )

    it.effect('should handle transparent blocks correctly', () =>
      Effect.gen(function* () {
        const transparentBlocks = new Set([10, 20])

        const shouldRenderForTransparent = pipe(getService().shouldRenderFace(1, 10, transparentBlocks), Effect.runSync)

        expect(shouldRenderForTransparent).toBe(true)

        const shouldRenderForSolid = pipe(getService().shouldRenderFace(1, 5, transparentBlocks), Effect.runSync)

        expect(shouldRenderForSolid).toBe(false)
      })
    )

    it.effect('should use default transparent blocks when not specified', () =>
      Effect.gen(function* () {
        const shouldRender = pipe(getService().shouldRenderFace(1, 0), Effect.runSync)

        expect(shouldRender).toBe(true)
      })
    )
  })

  describe('FaceCullingService - cullHiddenFaces', () => {
    const getService = () => pipe(FaceCullingService, Effect.provide(FaceCullingLive), Effect.runSync)

    it.effect('should return empty array for empty chunk', () =>
      Effect.gen(function* () {
        const chunk = createTestChunk(4, 'empty')

        const visibleBlocks = pipe(getService().cullHiddenFaces(chunk), Effect.runSync)

        expect(visibleBlocks).toHaveLength(0)
      })
    )

    it.effect('should identify all blocks in hollow cube', () =>
      Effect.gen(function* () {
        const chunk = createTestChunk(4, 'hollow')

        const visibleBlocks = pipe(getService().cullHiddenFaces(chunk), Effect.runSync)

        // All blocks on the surface should be visible
        expect(visibleBlocks.length).toBeGreaterThan(0)

        // Check that each visible block has at least one visible face
        visibleBlocks.forEach(([x, y, z, visibility]) => {
          const faceCount = [
            visibility.top,
            visibility.bottom,
            visibility.front,
            visibility.back,
            visibility.left,
            visibility.right,
          ].filter((v) => v).length

          expect(faceCount).toBeGreaterThan(0)
        })
      })
    )

    it.effect('should cull interior blocks in full chunk', () =>
      Effect.gen(function* () {
        const chunk = createTestChunk(4, 'full')

        const visibleBlocks = pipe(getService().cullHiddenFaces(chunk), Effect.runSync)

        // Only surface blocks should be visible
        const totalBlocks = 4 * 4 * 4
        const interiorBlocks = 2 * 2 * 2
        const surfaceBlocks = totalBlocks - interiorBlocks

        expect(visibleBlocks.length).toBe(surfaceBlocks)
      })
    )

    it.effect('should include visibility data for each block', () =>
      Effect.gen(function* () {
        const chunk = createTestChunk(4, 'single')

        const visibleBlocks = pipe(getService().cullHiddenFaces(chunk), Effect.runSync)

        expect(visibleBlocks).toHaveLength(1)
        const [x, y, z, visibility] = visibleBlocks[0]!

        expect(typeof x).toBe('number')
        expect(typeof y).toBe('number')
        expect(typeof z).toBe('number')
        expect(visibility).toBeDefined()
        expect(visibility.top).toBe(true)
        expect(visibility.bottom).toBe(true)
      })
    )

    it.effect('should handle errors in face culling', () =>
      Effect.gen(function* () {
        const invalidChunk = {
          position: { x: 0, y: 0, z: 0 },
          blocks: null as any,
          size: 4,
        }

        const result = runEffect(getService().cullHiddenFaces(invalidChunk))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result)) {
          const error = result.cause._tag === 'Fail' ? result.cause.error : null
          expect(isFaceCullingError(error)).toBe(true)
          if (isFaceCullingError(error)) {
            expect(error.context).toBe('cullHiddenFaces')
          }
        }
      })
    )
  })

  describe('Utility Functions', () => {
    it.effect('should calculate face culling stats correctly', () =>
      Effect.gen(function* () {
        const stats1 = calculateFaceCullingStats(100, 25)
        expect(stats1.culledFaces).toBe(75)
        expect(stats1.cullingRatio).toBe(0.75)

        const stats2 = calculateFaceCullingStats(50, 50)
        expect(stats2.culledFaces).toBe(0)
        expect(stats2.cullingRatio).toBe(0)

        const stats3 = calculateFaceCullingStats(0, 0)
        expect(stats3.culledFaces).toBe(0)
        expect(stats3.cullingRatio).toBe(0)
      })
    )

    it.effect('should optimize face visibility correctly', () =>
      Effect.gen(function* () {
        const visibilities: FaceVisibility[] = [
          { top: true, bottom: true, front: false, back: false, left: false, right: false },
          { top: false, bottom: false, front: true, back: true, left: false, right: false },
          { top: false, bottom: false, front: false, back: false, left: true, right: true },
        ]

        const totalVisible = optimizeFaceVisibility(visibilities)
        expect(totalVisible).toBe(6)
      })
    )

    it.effect('should handle empty visibility array', () =>
      Effect.gen(function* () {
        const totalVisible = optimizeFaceVisibility([])
        expect(totalVisible).toBe(0)
      })
    )

    it.effect('should count all visible faces correctly', () =>
      Effect.gen(function* () {
        const allVisible: FaceVisibility = {
          top: true,
          bottom: true,
          front: true,
          back: true,
          left: true,
          right: true,
        }

        const noneVisible: FaceVisibility = {
          top: false,
          bottom: false,
          front: false,
          back: false,
          left: false,
          right: false,
        }

        expect(optimizeFaceVisibility([allVisible])).toBe(6)
        expect(optimizeFaceVisibility([noneVisible])).toBe(0)
      })
    )
  })

  describe('Error Handling', () => {
    it.effect('should create FaceCullingError with correct properties', () =>
      Effect.gen(function* () {
        const error = FaceCullingError('Test error', 'test', Date.now())

        expect(isFaceCullingError(error)).toBe(true)
        expect(error.reason).toBe('Test error')
        expect(error.context).toBe('test')
        expect(error.timestamp).toBeGreaterThan(0)
      })
    )
  })

  describe('Performance', () => {
    it.effect('should cull faces efficiently for large chunks', () =>
      Effect.gen(function* () {
        const getService = () => pipe(FaceCullingService, Effect.provide(FaceCullingLive), Effect.runSync)

        const chunk = createTestChunk(16, 'full')

        const startTime = performance.now()
        const result = pipe(getService().cullHiddenFaces(chunk), Effect.runSync)
        const endTime = performance.now()

        // Should complete within 200ms for 16x16x16 chunk (adjusted for CI environment)
        expect(endTime - startTime).toBeLessThan(200)

        // Should have culled interior blocks
        const totalBlocks = 16 * 16 * 16
        expect(result.length).toBeLessThan(totalBlocks)
      })
    )

    it.effect('should achieve high culling ratio for dense chunks', () =>
      Effect.gen(function* () {
        const getService = () => pipe(FaceCullingService, Effect.provide(FaceCullingLive), Effect.runSync)

        const chunk = createTestChunk(8, 'full')
        const totalBlocks = 8 * 8 * 8
        const totalFaces = totalBlocks * 6

        const visibleBlocks = pipe(getService().cullHiddenFaces(chunk), Effect.runSync)

        // Count visible faces
        let visibleFaces = 0
        visibleBlocks.forEach(([_, __, ___, visibility]) => {
          if (visibility.top) visibleFaces++
          if (visibility.bottom) visibleFaces++
          if (visibility.front) visibleFaces++
          if (visibility.back) visibleFaces++
          if (visibility.left) visibleFaces++
          if (visibility.right) visibleFaces++
        })

        const stats = calculateFaceCullingStats(totalFaces, visibleFaces)

        // Should achieve high culling ratio for full chunk
        expect(stats.cullingRatio).toBeGreaterThan(0.5)
      })
    )
  })

  describe('Layer Construction', () => {
    it.effect('should provide FaceCullingLive layer', () =>
      Effect.gen(function* () {
        const program = pipe(
          FaceCullingService,
          Effect.map((service) => {
            expect(service).toBeDefined()
            expect(service.checkFaceVisibility).toBeDefined()
            expect(service.shouldRenderFace).toBeDefined()
            expect(service.cullHiddenFaces).toBeDefined()
            return true
          })
        )

        const result = pipe(program, Effect.provide(FaceCullingLive), Effect.runSync)

        expect(result).toBe(true)
      })
    )
  })
})
