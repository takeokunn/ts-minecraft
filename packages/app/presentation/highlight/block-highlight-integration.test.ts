import { describe, it } from '@effect/vitest'
import { Effect, Layer, MutableRef, Option } from 'effect'
import { expect, vi } from 'vitest'
import * as THREE from 'three'
import {
  BlockHighlightService,
  BlockHighlightLive,
} from '@ts-minecraft/app/presentation/highlight/block-highlight'
import { RaycastingService, type RaycastHit } from '@ts-minecraft/rendering'
import {
  createMockRaycastingService,
  createMockScene,
  createMockCamera,
} from './block-highlight-test-utils'

describe('BlockHighlightService (update & integration)', () => {
  describe('integration scenarios', () => {
    it.effect('should handle show -> hide -> show cycle correctly', () => {
      const hitCountRef = MutableRef.make(0)
      const mockRaycastingService = RaycastingService.of({
        _tag: '@minecraft/infrastructure/three/RaycastingService' as const,
        raycastFromCamera: vi.fn(() => {
          const count = MutableRef.updateAndGet(hitCountRef, n => n + 1)
          if (count === 1 || count === 3) {
            return Effect.sync(() => Option.some({
              point: { x: 1.5, y: 2.5, z: 3.5 },
              normal: { x: 0, y: 1, z: 0 },
              distance: 2.0,
              blockX: 1,
              blockY: 2,
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

      const { scene, getChildren } = createMockScene()
      const camera = createMockCamera()

      return Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlightService
        yield* blockHighlight.initialize(scene)

        // First update: hit
        yield* blockHighlight.update(camera, scene)
        const target1 = yield* blockHighlight.getTargetBlock()
        expect(target1).toEqual(Option.some({ x: 1, y: 2, z: 3 }))

        yield* blockHighlight.invalidateCache()

        // Second update: no hit
        yield* blockHighlight.update(camera, scene)
        const target2 = yield* blockHighlight.getTargetBlock()
        expect(target2).toEqual(Option.none())

        yield* blockHighlight.invalidateCache()

        // Third update: hit again
        yield* blockHighlight.update(camera, scene)
        const result = yield* blockHighlight.getTargetBlock()
        expect(result).toEqual(Option.some({ x: 1, y: 2, z: 3 }))

        const mesh = getChildren()[0] as THREE.LineSegments
        expect(mesh.visible).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should handle multiple different block positions', () => {
      const positions: Array<RaycastHit> = [
        { point: { x: 0.5, y: 0.5, z: 0.5 }, normal: { x: 0, y: 1, z: 0 }, distance: 1, blockX: 0, blockY: 0, blockZ: 0 },
        { point: { x: 10.5, y: 20.5, z: 30.5 }, normal: { x: 1, y: 0, z: 0 }, distance: 2, blockX: 10, blockY: 20, blockZ: 30 },
        { point: { x: -5.5, y: -10.5, z: -15.5 }, normal: { x: 0, y: 0, z: 1 }, distance: 3, blockX: -6, blockY: -11, blockZ: -16 },
      ]

      const indexRef = MutableRef.make(0)
      const mockRaycastingService = RaycastingService.of({
        _tag: '@minecraft/infrastructure/three/RaycastingService' as const,
        raycastFromCamera: vi.fn(() => {
          const idx = MutableRef.getAndSet(indexRef, MutableRef.get(indexRef) + 1)
          const hit = positions[idx % positions.length]
          return Effect.sync(() => Option.some(hit))
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

      const { scene, getChildren } = createMockScene()
      const camera = createMockCamera()

      return Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlightService
        yield* blockHighlight.initialize(scene)

        const results = yield* Effect.forEach(positions, (_pos) =>
          blockHighlight.invalidateCache().pipe(
            Effect.andThen(blockHighlight.update(camera, scene)),
            Effect.andThen(blockHighlight.getTargetBlock())
          ), { concurrency: 1 })

        expect(results[0]).toEqual(Option.some({ x: 0, y: 0, z: 0 }))
        expect(results[1]).toEqual(Option.some({ x: 10, y: 20, z: 30 }))
        expect(results[2]).toEqual(Option.some({ x: -6, y: -11, z: -16 }))

        const mesh = getChildren()[0] as THREE.LineSegments
        expect(mesh.position.x).toBe(-5.5) // -6 + 0.5
        expect(mesh.position.y).toBe(-10.5) // -11 + 0.5
        expect(mesh.position.z).toBe(-15.5) // -16 + 0.5
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should handle setVisible override independently of raycast', () => {
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
        yield* blockHighlight.setVisible(false)

        const target = yield* blockHighlight.getTargetBlock()
        expect(target).toEqual(Option.some({ x: 5, y: 10, z: 3 }))

        const mesh = getChildren()[0] as THREE.LineSegments
        expect(mesh.visible).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
