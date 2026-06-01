import { describe, it } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import { expect } from 'vitest'
import * as THREE from 'three'
import {
  BlockHighlightService,
  BlockHighlightLive,
  createWireframeCube,
  DEFAULT_HIGHLIGHT_COLOR,
} from '@ts-minecraft/presentation/highlight/block-highlight'
import { RaycastingService, type RaycastHit } from '@ts-minecraft/rendering'
import {
  createMockRaycastingService,
  createMockScene,
  createMockCamera,
} from './block-highlight-test-utils'

describe('BlockHighlightService', () => {
  describe('createWireframeCube', () => {
    it('should create a THREE.LineSegments object', () => {
      const mesh = createWireframeCube()
      expect(mesh).toBeInstanceOf(THREE.LineSegments)
    })

    it('should create a mesh with EdgesGeometry', () => {
      const mesh = createWireframeCube()
      expect(mesh.geometry).toBeInstanceOf(THREE.EdgesGeometry)
    })

    it('should create a mesh with LineBasicMaterial', () => {
      const mesh = createWireframeCube()
      expect(mesh.material).toBeInstanceOf(THREE.LineBasicMaterial)
    })

    it('should use default color when no color is specified', () => {
      const mesh = createWireframeCube()
      const material = mesh.material as THREE.LineBasicMaterial
      expect(material.color.getHex()).toBe(DEFAULT_HIGHLIGHT_COLOR)
    })

    it('should use custom color when specified', () => {
      const customColor = 0xffffff
      const mesh = createWireframeCube(customColor)
      const material = mesh.material as THREE.LineBasicMaterial
      expect(material.color.getHex()).toBe(customColor)
    })

    it('should be visible by default', () => {
      const mesh = createWireframeCube()
      expect(mesh.visible).toBe(true)
    })
  })

  describe('constants', () => {
    it('should have default highlight color as black (0x000000)', () => {
      expect(DEFAULT_HIGHLIGHT_COLOR).toBe(0x000000)
    })
  })

  describe('initialize', () => {
    it.effect('should add wireframe mesh to scene', () => {
      const mockRaycastingService = createMockRaycastingService()
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene, getChildren } = createMockScene()

      return Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlightService
        yield* blockHighlight.initialize(scene)

        expect(scene.add).toHaveBeenCalledTimes(1)
        expect(getChildren().length).toBe(1)
        expect(getChildren()[0]).toBeInstanceOf(THREE.LineSegments)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should set mesh visibility to false initially', () => {
      const mockRaycastingService = createMockRaycastingService()
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene, getChildren } = createMockScene()

      return Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlightService
        yield* blockHighlight.initialize(scene)

        const mesh = getChildren()[0] as THREE.LineSegments
        expect(mesh.visible).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('setVisible', () => {
    it.effect('should set mesh visibility to true', () => {
      const mockRaycastingService = createMockRaycastingService()
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene, getChildren } = createMockScene()

      return Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlightService
        yield* blockHighlight.initialize(scene)
        yield* blockHighlight.setVisible(true)

        const mesh = getChildren()[0] as THREE.LineSegments
        expect(mesh.visible).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should set mesh visibility to false', () => {
      const mockRaycastingService = createMockRaycastingService()
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene, getChildren } = createMockScene()

      return Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlightService
        yield* blockHighlight.initialize(scene)
        yield* blockHighlight.setVisible(true)
        yield* blockHighlight.setVisible(false)

        const mesh = getChildren()[0] as THREE.LineSegments
        expect(mesh.visible).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should not crash when mesh is not initialized', () => {
      const mockRaycastingService = createMockRaycastingService()
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      return Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlightService
        // Don't initialize, just try to set visibility
        yield* blockHighlight.setVisible(true)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('getTargetBlock', () => {
    it.effect('should return Option.none() initially', () => {
      const mockRaycastingService = createMockRaycastingService()
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene } = createMockScene()

      return Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlightService
        yield* blockHighlight.initialize(scene)
        const result = yield* blockHighlight.getTargetBlock()
        expect(result).toEqual(Option.none())
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should return Option.none() when no block is targeted', () => {
      const mockRaycastingService = createMockRaycastingService()
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene } = createMockScene()
      const camera = createMockCamera()

      return Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlightService
        yield* blockHighlight.initialize(scene)
        yield* blockHighlight.update(camera, scene)
        const result = yield* blockHighlight.getTargetBlock()
        expect(result).toEqual(Option.none())
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('getTargetHit', () => {
    it.effect('should return the full RaycastHit including distance and normal after update', () => {
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
        const result = yield* blockHighlight.getTargetHit()

        expect(Option.isSome(result)).toBe(true)
        const unwrapped = Option.getOrThrow(result)
        expect(unwrapped.distance).toBe(2.5)
        expect(unwrapped.normal).toEqual({ x: 0, y: 1, z: 0 })
        expect(unwrapped.blockX).toBe(5)
        expect(unwrapped.blockY).toBe(10)
        expect(unwrapped.blockZ).toBe(3)
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
