import { describe, it } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import { expect, vi } from 'vitest'
import * as THREE from 'three'
import {
  BlockHighlight,
  BlockHighlightLive,
  createWireframeCube,
  DEFAULT_HIGHLIGHT_COLOR,
} from './block-highlight'
import { RaycastingService, type RaycastHit } from '../../application/raycasting/raycasting-service'

/**
 * Helper to create a mock RaycastingService
 */
const createMockRaycastingService = (
  hitResult: RaycastHit | null = null
) => {
  return {
    createRaycaster: () =>
      Effect.sync(() => {
        const raycaster = new THREE.Raycaster()
        raycaster.far = 5
        return raycaster
      }),
    raycastFromCamera: vi.fn(() => Effect.sync(() => hitResult === null ? Option.none() : Option.some(hitResult))),
    worldToBlock: vi.fn((worldPos: { x: number; y: number; z: number }) =>
      Effect.sync(() => ({
        x: Math.floor(worldPos.x),
        y: Math.floor(worldPos.y),
        z: Math.floor(worldPos.z),
      }))
    ),
  } as unknown as RaycastingService
}

/**
 * Helper to create a mock scene that tracks added objects
 */
const createMockScene = () => {
  const children: THREE.Object3D[] = []
  return {
    scene: {
      add: vi.fn((obj: THREE.Object3D) => {
        children.push(obj)
      }),
      remove: vi.fn((obj: THREE.Object3D) => {
        const index = children.indexOf(obj)
        if (index > -1) {
          children.splice(index, 1)
        }
      }),
      children,
    } as unknown as THREE.Scene,
    getChildren: () => children,
  }
}

/**
 * Helper to create a mock camera
 */
const createMockCamera = () => {
  return new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
}

describe('BlockHighlight', () => {
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
    it('should add wireframe mesh to scene', () => {
      const mockRaycastingService = createMockRaycastingService()
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene, getChildren } = createMockScene()

      const program = Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlight
        yield* blockHighlight.initialize(scene)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer)))

      expect(scene.add).toHaveBeenCalledTimes(1)
      expect(getChildren().length).toBe(1)
      expect(getChildren()[0]).toBeInstanceOf(THREE.LineSegments)
    })

    it('should set mesh visibility to false initially', () => {
      const mockRaycastingService = createMockRaycastingService()
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene, getChildren } = createMockScene()

      const program = Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlight
        yield* blockHighlight.initialize(scene)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer)))

      const mesh = getChildren()[0] as THREE.LineSegments
      expect(mesh.visible).toBe(false)
    })
  })

  describe('setVisible', () => {
    it('should set mesh visibility to true', () => {
      const mockRaycastingService = createMockRaycastingService()
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene, getChildren } = createMockScene()

      const program = Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlight
        yield* blockHighlight.initialize(scene)
        yield* blockHighlight.setVisible(true)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer)))

      const mesh = getChildren()[0] as THREE.LineSegments
      expect(mesh.visible).toBe(true)
    })

    it('should set mesh visibility to false', () => {
      const mockRaycastingService = createMockRaycastingService()
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene, getChildren } = createMockScene()

      const program = Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlight
        yield* blockHighlight.initialize(scene)
        yield* blockHighlight.setVisible(true)
        yield* blockHighlight.setVisible(false)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer)))

      const mesh = getChildren()[0] as THREE.LineSegments
      expect(mesh.visible).toBe(false)
    })

    it('should not crash when mesh is not initialized', () => {
      const mockRaycastingService = createMockRaycastingService()
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const program = Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlight
        // Don't initialize, just try to set visibility
        yield* blockHighlight.setVisible(true)
      })

      // Should not throw
      expect(() => Effect.runSync(program.pipe(Effect.provide(TestLayer)))).not.toThrow()
    })
  })

  describe('getTargetBlock', () => {
    it('should return null initially', () => {
      const mockRaycastingService = createMockRaycastingService()
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene } = createMockScene()

      const program = Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlight
        yield* blockHighlight.initialize(scene)
        return yield* blockHighlight.getTargetBlock()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))

      expect(result).toBeNull()
    })

    it('should return null when no block is targeted', () => {
      const mockRaycastingService = createMockRaycastingService(null)
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene } = createMockScene()
      const camera = createMockCamera()

      const program = Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlight
        yield* blockHighlight.initialize(scene)
        yield* blockHighlight.update(camera, scene)
        return yield* blockHighlight.getTargetBlock()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))

      expect(result).toBeNull()
    })
  })

  describe('update', () => {
    it('should position mesh at hit block location', () => {
      const hitResult: RaycastHit = {
        point: { x: 5.5, y: 10.5, z: 3.5 },
        normal: { x: 0, y: 1, z: 0 },
        distance: 2.5,
        blockX: 5,
        blockY: 10,
        blockZ: 3,
      }
      const mockRaycastingService = createMockRaycastingService(hitResult)
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene, getChildren } = createMockScene()
      const camera = createMockCamera()

      const program = Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlight
        yield* blockHighlight.initialize(scene)
        yield* blockHighlight.update(camera, scene)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer)))

      const mesh = getChildren()[0] as THREE.LineSegments
      // Position should be at block center (blockX + 0.5, blockY + 0.5, blockZ + 0.5)
      expect(mesh.position.x).toBe(5.5)
      expect(mesh.position.y).toBe(10.5)
      expect(mesh.position.z).toBe(3.5)
    })

    it('should make mesh visible when hit', () => {
      const hitResult: RaycastHit = {
        point: { x: 5.5, y: 10.5, z: 3.5 },
        normal: { x: 0, y: 1, z: 0 },
        distance: 2.5,
        blockX: 5,
        blockY: 10,
        blockZ: 3,
      }
      const mockRaycastingService = createMockRaycastingService(hitResult)
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene, getChildren } = createMockScene()
      const camera = createMockCamera()

      const program = Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlight
        yield* blockHighlight.initialize(scene)
        yield* blockHighlight.update(camera, scene)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer)))

      const mesh = getChildren()[0] as THREE.LineSegments
      expect(mesh.visible).toBe(true)
    })

    it('should hide mesh when no hit', () => {
      const mockRaycastingService = createMockRaycastingService(null)
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene, getChildren } = createMockScene()
      const camera = createMockCamera()

      const program = Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlight
        yield* blockHighlight.initialize(scene)
        yield* blockHighlight.update(camera, scene)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer)))

      const mesh = getChildren()[0] as THREE.LineSegments
      expect(mesh.visible).toBe(false)
    })

    it('should update target block when hit', () => {
      const hitResult: RaycastHit = {
        point: { x: 5.5, y: 10.5, z: 3.5 },
        normal: { x: 0, y: 1, z: 0 },
        distance: 2.5,
        blockX: 5,
        blockY: 10,
        blockZ: 3,
      }
      const mockRaycastingService = createMockRaycastingService(hitResult)
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene } = createMockScene()
      const camera = createMockCamera()

      const program = Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlight
        yield* blockHighlight.initialize(scene)
        yield* blockHighlight.update(camera, scene)
        return yield* blockHighlight.getTargetBlock()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))

      expect(result).toEqual({ x: 5, y: 10, z: 3 })
    })

    it('should clear target block when no hit', () => {
      // First return a hit, then no hit
      let hitCount = 0
      const mockRaycastingService = {
        createRaycaster: () =>
          Effect.sync(() => {
            const raycaster = new THREE.Raycaster()
            raycaster.far = 5
            return raycaster
          }),
        raycastFromCamera: vi.fn(() => {
          hitCount++
          if (hitCount === 1) {
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
      } as unknown as RaycastingService

      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene } = createMockScene()
      const camera = createMockCamera()

      const program = Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlight
        yield* blockHighlight.initialize(scene)

        // First update hits a block
        yield* blockHighlight.update(camera, scene)
        const target1 = yield* blockHighlight.getTargetBlock()
        expect(target1).toEqual({ x: 5, y: 10, z: 3 })

        // Second update has no hit
        yield* blockHighlight.update(camera, scene)
        return yield* blockHighlight.getTargetBlock()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))

      expect(result).toBeNull()
    })

    it('should do nothing when mesh is not initialized', () => {
      const mockRaycastingService = createMockRaycastingService()
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene } = createMockScene()
      const camera = createMockCamera()

      const program = Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlight
        // Don't initialize, just try to update
        yield* blockHighlight.update(camera, scene)
      })

      // Should not throw
      expect(() => Effect.runSync(program.pipe(Effect.provide(TestLayer)))).not.toThrow()
    })
  })

  describe('integration scenarios', () => {
    it('should handle show -> hide -> show cycle correctly', () => {
      let hitCount = 0
      const mockRaycastingService = {
        createRaycaster: () =>
          Effect.sync(() => {
            const raycaster = new THREE.Raycaster()
            raycaster.far = 5
            return raycaster
          }),
        raycastFromCamera: vi.fn(() => {
          hitCount++
          if (hitCount === 1 || hitCount === 3) {
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
      } as unknown as RaycastingService

      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene, getChildren } = createMockScene()
      const camera = createMockCamera()

      const program = Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlight
        yield* blockHighlight.initialize(scene)

        // First update: hit
        yield* blockHighlight.update(camera, scene)
        let target = yield* blockHighlight.getTargetBlock()
        expect(target).toEqual({ x: 1, y: 2, z: 3 })

        // Second update: no hit
        yield* blockHighlight.update(camera, scene)
        target = yield* blockHighlight.getTargetBlock()
        expect(target).toBeNull()

        // Third update: hit again
        yield* blockHighlight.update(camera, scene)
        return yield* blockHighlight.getTargetBlock()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))

      expect(result).toEqual({ x: 1, y: 2, z: 3 })

      const mesh = getChildren()[0] as THREE.LineSegments
      expect(mesh.visible).toBe(true)
    })

    it('should handle multiple different block positions', () => {
      const positions: Array<RaycastHit> = [
        { point: { x: 0.5, y: 0.5, z: 0.5 }, normal: { x: 0, y: 1, z: 0 }, distance: 1, blockX: 0, blockY: 0, blockZ: 0 },
        { point: { x: 10.5, y: 20.5, z: 30.5 }, normal: { x: 1, y: 0, z: 0 }, distance: 2, blockX: 10, blockY: 20, blockZ: 30 },
        { point: { x: -5.5, y: -10.5, z: -15.5 }, normal: { x: 0, y: 0, z: 1 }, distance: 3, blockX: -6, blockY: -11, blockZ: -16 },
      ]

      let index = 0
      const mockRaycastingService = {
        createRaycaster: () =>
          Effect.sync(() => {
            const raycaster = new THREE.Raycaster()
            raycaster.far = 5
            return raycaster
          }),
        raycastFromCamera: vi.fn(() => {
          const hit = positions[index % positions.length]
          index++
          return Effect.sync(() => Option.some(hit))
        }),
        worldToBlock: vi.fn((worldPos: { x: number; y: number; z: number }) =>
          Effect.sync(() => ({
            x: Math.floor(worldPos.x),
            y: Math.floor(worldPos.y),
            z: Math.floor(worldPos.z),
          }))
        ),
      } as unknown as RaycastingService

      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene, getChildren } = createMockScene()
      const camera = createMockCamera()

      const program = Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlight
        yield* blockHighlight.initialize(scene)

        const results: Array<{ x: number; y: number; z: number } | null> = []

        for (const _pos of positions) {
          yield* blockHighlight.update(camera, scene)
          const target = yield* blockHighlight.getTargetBlock()
          results.push(target)
        }

        return results
      })

      const results = Effect.runSync(program.pipe(Effect.provide(TestLayer)))

      expect(results[0]).toEqual({ x: 0, y: 0, z: 0 })
      expect(results[1]).toEqual({ x: 10, y: 20, z: 30 })
      expect(results[2]).toEqual({ x: -6, y: -11, z: -16 })

      const mesh = getChildren()[0] as THREE.LineSegments
      // Check final position
      expect(mesh.position.x).toBe(-5.5) // -6 + 0.5
      expect(mesh.position.y).toBe(-10.5) // -11 + 0.5
      expect(mesh.position.z).toBe(-15.5) // -16 + 0.5
    })

    it('should handle setVisible override independently of raycast', () => {
      const hitResult: RaycastHit = {
        point: { x: 5.5, y: 10.5, z: 3.5 },
        normal: { x: 0, y: 1, z: 0 },
        distance: 2.5,
        blockX: 5,
        blockY: 10,
        blockZ: 3,
      }
      const mockRaycastingService = createMockRaycastingService(hitResult)
      const MockLayer = Layer.succeed(RaycastingService, mockRaycastingService)
      const TestLayer = BlockHighlightLive.pipe(Layer.provide(MockLayer))

      const { scene, getChildren } = createMockScene()
      const camera = createMockCamera()

      const program = Effect.gen(function* () {
        const blockHighlight = yield* BlockHighlight
        yield* blockHighlight.initialize(scene)

        // Update makes mesh visible
        yield* blockHighlight.update(camera, scene)

        // Manually hide it
        yield* blockHighlight.setVisible(false)

        // Target block should still be set
        return yield* blockHighlight.getTargetBlock()
      })

      const target = Effect.runSync(program.pipe(Effect.provide(TestLayer)))

      // Target should still be tracked even though mesh is hidden
      expect(target).toEqual({ x: 5, y: 10, z: 3 })

      const mesh = getChildren()[0] as THREE.LineSegments
      expect(mesh.visible).toBe(false)
    })
  })
})
