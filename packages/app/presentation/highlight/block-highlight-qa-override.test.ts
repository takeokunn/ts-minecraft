import { describe, it } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import { expect } from 'vitest'
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

describe('BlockHighlightService (setTargetForQA / clearTargetForQA / override update)', () => {
  const qaTarget = { x: 7, y: 3, z: 12 }
  const qaHit: RaycastHit = {
    point: { x: 7.5, y: 3.5, z: 12.5 },
    normal: { x: 1, y: 0, z: 0 },
    distance: 4.0,
    blockX: 7,
    blockY: 3,
    blockZ: 12,
  }

  it.effect('setTargetForQA: getTargetBlock() returns the forced target', () => {
    const mockRaycastingService = createMockRaycastingService()
    const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
    const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

    const { scene } = createMockScene()

    return Effect.gen(function* () {
      const blockHighlight = yield* BlockHighlightService
      yield* blockHighlight.initialize(scene)
      yield* blockHighlight.setTargetForQA(qaTarget, qaHit)

      const result = yield* blockHighlight.getTargetBlock()
      expect(result).toEqual(Option.some(qaTarget))
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('setTargetForQA: getTargetHit() returns the forced hit', () => {
    const mockRaycastingService = createMockRaycastingService()
    const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
    const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

    const { scene } = createMockScene()

    return Effect.gen(function* () {
      const blockHighlight = yield* BlockHighlightService
      yield* blockHighlight.initialize(scene)
      yield* blockHighlight.setTargetForQA(qaTarget, qaHit)

      const result = yield* blockHighlight.getTargetHit()
      expect(Option.isSome(result)).toBe(true)
      const unwrapped = Option.getOrThrow(result)
      expect(unwrapped.blockX).toBe(qaHit.blockX)
      expect(unwrapped.blockY).toBe(qaHit.blockY)
      expect(unwrapped.blockZ).toBe(qaHit.blockZ)
      expect(unwrapped.distance).toBe(qaHit.distance)
      expect(unwrapped.normal).toEqual(qaHit.normal)
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('setTargetForQA: mesh is visible and positioned at target center', () => {
    const mockRaycastingService = createMockRaycastingService()
    const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
    const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

    const { scene, getChildren } = createMockScene()

    return Effect.gen(function* () {
      const blockHighlight = yield* BlockHighlightService
      yield* blockHighlight.initialize(scene)
      yield* blockHighlight.setTargetForQA(qaTarget, qaHit)

      const mesh = getChildren()[0] as THREE.LineSegments
      expect(mesh.visible).toBe(true)
      expect(mesh.position.x).toBe(qaTarget.x + 0.5)
      expect(mesh.position.y).toBe(qaTarget.y + 0.5)
      expect(mesh.position.z).toBe(qaTarget.z + 0.5)
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('setTargetForQA: does not crash when mesh is not initialized', () => {
    const mockRaycastingService = createMockRaycastingService()
    const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
    const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

    return Effect.gen(function* () {
      const blockHighlight = yield* BlockHighlightService
      // No initialize call — mesh Ref holds Option.none()
      yield* blockHighlight.setTargetForQA(qaTarget, qaHit)

      // State is still updated even without a mesh
      const target = yield* blockHighlight.getTargetBlock()
      expect(target).toEqual(Option.some(qaTarget))
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('clearTargetForQA: getTargetBlock() returns Option.none() after clear', () => {
    const mockRaycastingService = createMockRaycastingService()
    const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
    const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

    const { scene } = createMockScene()

    return Effect.gen(function* () {
      const blockHighlight = yield* BlockHighlightService
      yield* blockHighlight.initialize(scene)
      yield* blockHighlight.setTargetForQA(qaTarget, qaHit)
      yield* blockHighlight.clearTargetForQA()

      const result = yield* blockHighlight.getTargetBlock()
      expect(result).toEqual(Option.none())
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('clearTargetForQA: mesh is hidden after clear', () => {
    const mockRaycastingService = createMockRaycastingService()
    const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
    const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

    const { scene, getChildren } = createMockScene()

    return Effect.gen(function* () {
      const blockHighlight = yield* BlockHighlightService
      yield* blockHighlight.initialize(scene)
      yield* blockHighlight.setTargetForQA(qaTarget, qaHit)
      yield* blockHighlight.clearTargetForQA()

      const mesh = getChildren()[0] as THREE.LineSegments
      expect(mesh.visible).toBe(false)
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('clearTargetForQA: does not crash when mesh is not initialized', () => {
    const mockRaycastingService = createMockRaycastingService()
    const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
    const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

    return Effect.gen(function* () {
      const blockHighlight = yield* BlockHighlightService
      // No initialize call
      yield* blockHighlight.clearTargetForQA()

      const result = yield* blockHighlight.getTargetBlock()
      expect(result).toEqual(Option.none())
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('update override branch: does not call raycastFromCamera when override is set', () => {
    const mockRaycastingService = createMockRaycastingService()
    const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
    const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

    const { scene } = createMockScene()
    const camera = createMockCamera()

    return Effect.gen(function* () {
      const blockHighlight = yield* BlockHighlightService
      yield* blockHighlight.initialize(scene)
      yield* blockHighlight.setTargetForQA(qaTarget, qaHit)

      // Invalidate the cache so update will actually run its body
      yield* blockHighlight.invalidateCache()
      yield* blockHighlight.update(camera, scene)

      // The override branch should have short-circuited before calling raycastFromCamera
      expect(mockRaycastingService.raycastFromCamera).not.toHaveBeenCalled()
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('update override branch: keeps forced target after invalidateCache + update', () => {
    const mockRaycastingService = createMockRaycastingService()
    const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
    const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

    const { scene, getChildren } = createMockScene()
    const camera = createMockCamera()

    return Effect.gen(function* () {
      const blockHighlight = yield* BlockHighlightService
      yield* blockHighlight.initialize(scene)
      yield* blockHighlight.setTargetForQA(qaTarget, qaHit)

      yield* blockHighlight.invalidateCache()
      yield* blockHighlight.update(camera, scene)

      const target = yield* blockHighlight.getTargetBlock()
      expect(target).toEqual(Option.some(qaTarget))

      const mesh = getChildren()[0] as THREE.LineSegments
      expect(mesh.visible).toBe(true)
      expect(mesh.position.x).toBe(qaTarget.x + 0.5)
      expect(mesh.position.y).toBe(qaTarget.y + 0.5)
      expect(mesh.position.z).toBe(qaTarget.z + 0.5)
    }).pipe(Effect.provide(TestLayer))
  })
})
