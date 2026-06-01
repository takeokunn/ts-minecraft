import { describe, it } from '@effect/vitest'
import { Effect, Layer, MutableRef, Option } from 'effect'
import { expect, vi } from 'vitest'
import * as THREE from 'three'
import {
  BlockHighlightService,
  BlockHighlightLive,
} from '@ts-minecraft/presentation/highlight/block-highlight'
import { RaycastingService, type RaycastHit } from '@ts-minecraft/rendering'
import {
  createMockRaycastingService,
  createMockScene,
  createMockCamera,
} from './block-highlight-test-utils'

describe('BlockHighlightService (update & integration)', () => {
  describe('update', () => {
    it.effect('should position mesh at hit block location', () => {
      const hitResult: RaycastHit = {
        point: { x: 5.5, y: 10.5, z: 3.5 },
        normal: { x: 0, y: 1, z: 0 },
        distance: 2.5,
        blockX: 5,
        blockY: 10,
        blockZ: 3,
      }
      const mockRaycastingService = createMockRaycastingService(Option.some(hitResult))
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene, getChildren } = createMockScene()
      const camera = createMockCamera()

      return Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlightService
        yield* blockHighlight.initialize(scene)
        yield* blockHighlight.update(camera, scene)

        const mesh = getChildren()[0] as THREE.LineSegments
        // Position should be at block center (blockX + 0.5, blockY + 0.5, blockZ + 0.5)
        expect(mesh.position.x).toBe(5.5)
        expect(mesh.position.y).toBe(10.5)
        expect(mesh.position.z).toBe(3.5)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should make mesh visible when hit', () => {
      const hitResult: RaycastHit = {
        point: { x: 5.5, y: 10.5, z: 3.5 },
        normal: { x: 0, y: 1, z: 0 },
        distance: 2.5,
        blockX: 5,
        blockY: 10,
        blockZ: 3,
      }
      const mockRaycastingService = createMockRaycastingService(Option.some(hitResult))
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene, getChildren } = createMockScene()
      const camera = createMockCamera()

      return Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlightService
        yield* blockHighlight.initialize(scene)
        yield* blockHighlight.update(camera, scene)

        const mesh = getChildren()[0] as THREE.LineSegments
        expect(mesh.visible).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should hide mesh when no hit', () => {
      const mockRaycastingService = createMockRaycastingService()
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene, getChildren } = createMockScene()
      const camera = createMockCamera()

      return Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlightService
        yield* blockHighlight.initialize(scene)
        yield* blockHighlight.update(camera, scene)

        const mesh = getChildren()[0] as THREE.LineSegments
        expect(mesh.visible).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should update target block when hit', () => {
      const hitResult: RaycastHit = {
        point: { x: 5.5, y: 10.5, z: 3.5 },
        normal: { x: 0, y: 1, z: 0 },
        distance: 2.5,
        blockX: 5,
        blockY: 10,
        blockZ: 3,
      }
      const mockRaycastingService = createMockRaycastingService(Option.some(hitResult))
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene } = createMockScene()
      const camera = createMockCamera()

      return Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlightService
        yield* blockHighlight.initialize(scene)
        yield* blockHighlight.update(camera, scene)
        const result = yield* blockHighlight.getTargetBlock()
        expect(result).toEqual(Option.some({ x: 5, y: 10, z: 3 }))
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should clear target block when no hit', () => {
      // First return a hit, then no hit
      const hitCountRef = MutableRef.make(0)
      const mockRaycastingService = RaycastingService.of({
        _tag: '@minecraft/infrastructure/three/RaycastingService' as const,
        raycastFromCamera: vi.fn(() => {
          const count = MutableRef.updateAndGet(hitCountRef, n => n + 1)
          if (count === 1) {
            return Effect.sync(() => Option.some({
              point: { x: 5.5, y: 10.5, z: 3.5 },
              normal: { x: 0, y: 1, z: 0 },
              distance: 2.5,
              blockX: 5,
              blockY: 10,
              blockZ: 3,
            }))
          }
          return Effect.sync(() => Option.none())
        }),
        worldToBlock: vi.fn((worldPos: { x: number; y: number; z: number }) =>
          Effect.sync(() => ({
            x: Math.floor(worldPos.x),
            y: Math.floor(worldPos.y),
            z: Math.floor(worldPos.z),
          }))
        ),
      })

      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene } = createMockScene()
      const camera = createMockCamera()

      return Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlightService
        yield* blockHighlight.initialize(scene)

        // First update hits a block
        yield* blockHighlight.update(camera, scene)
        const target1 = yield* blockHighlight.getTargetBlock()
        expect(target1).toEqual(Option.some({ x: 5, y: 10, z: 3 }))

        yield* blockHighlight.invalidateCache()

        // Second update has no hit
        yield* blockHighlight.update(camera, scene)
        const result = yield* blockHighlight.getTargetBlock()
        expect(result).toEqual(Option.none())
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should reuse the cached raycast when camera pose is unchanged', () => {
      const hitResult: RaycastHit = {
        point: { x: 5.5, y: 10.5, z: 3.5 },
        normal: { x: 0, y: 1, z: 0 },
        distance: 2.5,
        blockX: 5,
        blockY: 10,
        blockZ: 3,
      }
      const mockRaycastingService = createMockRaycastingService(Option.some(hitResult))
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene } = createMockScene()
      const camera = createMockCamera()

      return Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlightService
        yield* blockHighlight.initialize(scene)
        yield* blockHighlight.update(camera, scene)
        yield* blockHighlight.update(camera, scene)

        expect(mockRaycastingService.raycastFromCamera).toHaveBeenCalledOnce()
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should do nothing when mesh is not initialized', () => {
      const mockRaycastingService = createMockRaycastingService()
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene } = createMockScene()
      const camera = createMockCamera()

      return Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlightService
        // Don't initialize, just try to update
        yield* blockHighlight.update(camera, scene)
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
