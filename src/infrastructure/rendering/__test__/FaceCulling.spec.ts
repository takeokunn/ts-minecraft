import { describe, it, expect } from 'vitest'
import { Effect, Exit, pipe } from 'effect'
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
    case 'hollow':
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          for (let z = 0; z < size; z++) {
            if (x === 0 || x === size - 1 || y === 0 || y === size - 1 || z === 0 || z === size - 1) {
              blocks[x]![y]![z] = 1
            }
          }
        }
      }
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

describe('FaceCulling', () => {
  describe('Type Guards and Interfaces', () => {
    it('should create valid FaceVisibility objects', () => {
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

    it('should create valid CullingConfig', () => {
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
  })

  describe('FaceCullingService - checkFaceVisibility', () => {
    const getService = () => pipe(FaceCullingService, Effect.provide(FaceCullingLive), Effect.runSync)

    it('should return no visible faces for air block', async () => {
      const chunk = createTestChunk(4, 'empty')

      const visibility = await pipe(
        getService().checkFaceVisibility(chunk.blocks as number[][][], 0, 0, 0, chunk.size),
        Effect.runPromise
      )

      expect(visibility.top).toBe(false)
      expect(visibility.bottom).toBe(false)
      expect(visibility.front).toBe(false)
      expect(visibility.back).toBe(false)
      expect(visibility.left).toBe(false)
      expect(visibility.right).toBe(false)
    })

    it('should detect all visible faces for isolated block', async () => {
      const chunk = createTestChunk(5, 'single')
      const mid = 2

      const visibility = await pipe(
        getService().checkFaceVisibility(chunk.blocks as number[][][], mid, mid, mid, chunk.size),
        Effect.runPromise
      )

      expect(visibility.top).toBe(true)
      expect(visibility.bottom).toBe(true)
      expect(visibility.front).toBe(true)
      expect(visibility.back).toBe(true)
      expect(visibility.left).toBe(true)
      expect(visibility.right).toBe(true)
    })

    it('should detect edge faces at chunk boundaries', async () => {
      const chunk = createTestChunk(4, 'full')

      // Corner block
      const visibility = await pipe(
        getService().checkFaceVisibility(chunk.blocks as number[][][], 0, 0, 0, chunk.size),
        Effect.runPromise
      )

      expect(visibility.left).toBe(true) // At boundary
      expect(visibility.bottom).toBe(true) // At boundary
      expect(visibility.back).toBe(true) // At boundary
      expect(visibility.right).toBe(false) // Has neighbor
      expect(visibility.top).toBe(false) // Has neighbor
      expect(visibility.front).toBe(false) // Has neighbor
    })

    it('should handle out of bounds coordinates gracefully', async () => {
      const chunk = createTestChunk(4, 'full')

      // Out of bounds coordinates
      const visibility = await pipe(
        getService().checkFaceVisibility(chunk.blocks as number[][][], -1, -1, -1, chunk.size),
        Effect.runPromise
      )

      // Air blocks have no visible faces
      expect(visibility.top).toBe(false)
      expect(visibility.bottom).toBe(false)
    })

    it('should handle errors in face visibility check', async () => {
      const result = runEffect(getService().checkFaceVisibility(null as any, 0, 0, 0, 4))

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const error = result.cause._tag === 'Fail' ? result.cause.error : null
        expect(isFaceCullingError(error)).toBe(true)
      }
    })
  })

  describe('FaceCullingService - shouldRenderFace', () => {
    const getService = () => pipe(FaceCullingService, Effect.provide(FaceCullingLive), Effect.runSync)

    it('should not render face for air block', async () => {
      const shouldRender = await pipe(getService().shouldRenderFace(0, 1), Effect.runPromise)

      expect(shouldRender).toBe(false)
    })

    it('should render face when neighbor is air', async () => {
      const shouldRender = await pipe(getService().shouldRenderFace(1, 0), Effect.runPromise)

      expect(shouldRender).toBe(true)
    })

    it('should not render face when neighbor is solid', async () => {
      const shouldRender = await pipe(getService().shouldRenderFace(1, 1), Effect.runPromise)

      expect(shouldRender).toBe(false)
    })

    it('should handle transparent blocks correctly', async () => {
      const transparentBlocks = new Set([10, 20])

      const shouldRenderForTransparent = await pipe(
        getService().shouldRenderFace(1, 10, transparentBlocks),
        Effect.runPromise
      )

      expect(shouldRenderForTransparent).toBe(true)

      const shouldRenderForSolid = await pipe(getService().shouldRenderFace(1, 5, transparentBlocks), Effect.runPromise)

      expect(shouldRenderForSolid).toBe(false)
    })

    it('should use default transparent blocks when not specified', async () => {
      const shouldRender = await pipe(getService().shouldRenderFace(1, 0), Effect.runPromise)

      expect(shouldRender).toBe(true)
    })
  })

  describe('FaceCullingService - cullHiddenFaces', () => {
    const getService = () => pipe(FaceCullingService, Effect.provide(FaceCullingLive), Effect.runSync)

    it('should return empty array for empty chunk', async () => {
      const chunk = createTestChunk(4, 'empty')

      const visibleBlocks = await pipe(getService().cullHiddenFaces(chunk), Effect.runPromise)

      expect(visibleBlocks).toHaveLength(0)
    })

    it('should identify all blocks in hollow cube', async () => {
      const chunk = createTestChunk(4, 'hollow')

      const visibleBlocks = await pipe(getService().cullHiddenFaces(chunk), Effect.runPromise)

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

    it('should cull interior blocks in full chunk', async () => {
      const chunk = createTestChunk(4, 'full')

      const visibleBlocks = await pipe(getService().cullHiddenFaces(chunk), Effect.runPromise)

      // Only surface blocks should be visible
      const totalBlocks = 4 * 4 * 4
      const interiorBlocks = 2 * 2 * 2
      const surfaceBlocks = totalBlocks - interiorBlocks

      expect(visibleBlocks.length).toBe(surfaceBlocks)
    })

    it('should include visibility data for each block', async () => {
      const chunk = createTestChunk(4, 'single')

      const visibleBlocks = await pipe(getService().cullHiddenFaces(chunk), Effect.runPromise)

      expect(visibleBlocks).toHaveLength(1)
      const [x, y, z, visibility] = visibleBlocks[0]!

      expect(typeof x).toBe('number')
      expect(typeof y).toBe('number')
      expect(typeof z).toBe('number')
      expect(visibility).toBeDefined()
      expect(visibility.top).toBe(true)
      expect(visibility.bottom).toBe(true)
    })

    it('should handle errors in face culling', async () => {
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
  })

  describe('Utility Functions', () => {
    it('should calculate face culling stats correctly', () => {
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

    it('should optimize face visibility correctly', () => {
      const visibilities: FaceVisibility[] = [
        { top: true, bottom: true, front: false, back: false, left: false, right: false },
        { top: false, bottom: false, front: true, back: true, left: false, right: false },
        { top: false, bottom: false, front: false, back: false, left: true, right: true },
      ]

      const totalVisible = optimizeFaceVisibility(visibilities)
      expect(totalVisible).toBe(6)
    })

    it('should handle empty visibility array', () => {
      const totalVisible = optimizeFaceVisibility([])
      expect(totalVisible).toBe(0)
    })

    it('should count all visible faces correctly', () => {
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
  })

  describe('Error Handling', () => {
    it('should create FaceCullingError with correct properties', () => {
      const error = FaceCullingError('Test error', 'test', Date.now())

      expect(isFaceCullingError(error)).toBe(true)
      expect(error.reason).toBe('Test error')
      expect(error.context).toBe('test')
      expect(error.timestamp).toBeGreaterThan(0)
    })
  })

  describe('Performance', () => {
    it('should cull faces efficiently for large chunks', async () => {
      const getService = () => pipe(FaceCullingService, Effect.provide(FaceCullingLive), Effect.runSync)

      const chunk = createTestChunk(16, 'full')

      const startTime = performance.now()
      const result = await pipe(getService().cullHiddenFaces(chunk), Effect.runPromise)
      const endTime = performance.now()

      // Should complete within 100ms for 16x16x16 chunk
      expect(endTime - startTime).toBeLessThan(100)

      // Should have culled interior blocks
      const totalBlocks = 16 * 16 * 16
      expect(result.length).toBeLessThan(totalBlocks)
    })

    it('should achieve high culling ratio for dense chunks', async () => {
      const getService = () => pipe(FaceCullingService, Effect.provide(FaceCullingLive), Effect.runSync)

      const chunk = createTestChunk(8, 'full')
      const totalBlocks = 8 * 8 * 8
      const totalFaces = totalBlocks * 6

      const visibleBlocks = await pipe(getService().cullHiddenFaces(chunk), Effect.runPromise)

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
  })

  describe('Layer Construction', () => {
    it('should provide FaceCullingLive layer', async () => {
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

      const result = await pipe(program, Effect.provide(FaceCullingLive), Effect.runPromise)

      expect(result).toBe(true)
    })
  })
})
