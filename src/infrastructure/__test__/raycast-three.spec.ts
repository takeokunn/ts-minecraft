import { Effect, Layer, Option } from 'effect'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'
import { RaycastService, RaycastServiceLive, findHitEntity } from '../raycast-three'
import { ThreeCameraService } from '../camera-three'
import { type EntityId } from '@/domain/entity'
import type { ThreeCamera } from '../types'

// Mocks
const mockCamera = new THREE.PerspectiveCamera()
const mockThreeCamera: ThreeCamera = {
  camera: mockCamera,
  controls: {} as any,
}

const mockThreeCameraService: ThreeCameraService = {
  camera: mockThreeCamera,
  syncToComponent: () => Effect.void,
  moveRight: () => Effect.void,
  rotatePitch: () => Effect.void,
  rotateYaw: () => Effect.void,
  getYaw: Effect.succeed(0),
  getPitch: Effect.succeed(0),
  handleResize: () => Effect.void,
  lock: Effect.void,
  unlock: Effect.void,
}

const ThreeCameraServiceMock = Layer.succeed(ThreeCameraService, mockThreeCameraService)

const setFromCameraMock = vi.fn()
const intersectObjectsMock = vi.fn()

vi.mock('three', async () => {
  const actualThree = await vi.importActual('three')
  return {
    ...actualThree,
    Raycaster: vi.fn().mockImplementation(() => ({
      setFromCamera: setFromCameraMock,
      intersectObjects: intersectObjectsMock,
    })),
  }
})

describe('findHitEntity', () => {
  it('should return none if intersection.face is null', () => {
    const intersection = { face: null } as any
    const result = findHitEntity(intersection, new Map())
    expect(Option.isNone(result)).toBe(true)
  })

  it('should return none if the block key is not in the map', () => {
    const intersection = {
      point: new THREE.Vector3(0.5, 0.5, 0.5),
      face: { normal: new THREE.Vector3(0, 1, 0) },
    } as any
    const terrainBlockMap = new Map<string, EntityId>() // Empty map
    const result = findHitEntity(intersection, terrainBlockMap)
    expect(Option.isNone(result)).toBe(true)
  })
})

describe('RaycastService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return a hit result when an object is intersected within reach', async () => {
    const entityId = 1 as EntityId
    const terrainBlockMap = new Map<string, EntityId>([['0,0,0', entityId]])
    const scene = new THREE.Scene()
    const object = new THREE.Object3D()
    object.userData = { type: 'chunk' }
    scene.add(object)

    const intersection: THREE.Intersection = {
      distance: 5,
      point: new THREE.Vector3(0.5, 0.5, 0.5),
      face: { normal: new THREE.Vector3(0, 1, 0) } as any,
      object,
    } as any
    intersectObjectsMock.mockReturnValue([intersection])

    const program = Effect.gen(function* (_) {
      const raycastService = yield* _(RaycastService)
      const result = yield* _(raycastService.cast(scene, terrainBlockMap))

      expect(Option.isSome(result)).toBe(true)
      const value = Option.getOrThrow(result)
      expect(value.entityId).toBe(entityId)
      expect(value.face).toEqual({ x: 0, y: 1, z: 0 })
      expect(setFromCameraMock).toHaveBeenCalledWith(expect.any(THREE.Vector2), mockCamera)
      expect(intersectObjectsMock).toHaveBeenCalledWith(scene.children, false)
    })

    await Effect.runPromise(Effect.provide(program, RaycastServiceLive.pipe(Layer.provide(ThreeCameraServiceMock))))
  })

  it('should return none if no object is intersected', async () => {
    intersectObjectsMock.mockReturnValue([])
    const scene = new THREE.Scene()
    const terrainBlockMap = new Map<string, EntityId>()

    const program = Effect.gen(function* (_) {
      const raycastService = yield* _(RaycastService)
      const result = yield* _(raycastService.cast(scene, terrainBlockMap))
      expect(Option.isNone(result)).toBe(true)
    })

    await Effect.runPromise(Effect.provide(program, RaycastServiceLive.pipe(Layer.provide(ThreeCameraServiceMock))))
  })

  it('should return none if intersected object is out of reach', async () => {
    const intersection: THREE.Intersection = {
      distance: 10, // REACH is 8
      point: new THREE.Vector3(0.5, 0.5, 0.5),
      face: { normal: new THREE.Vector3(0, 1, 0) } as any,
      object: { userData: { type: 'chunk' } } as any,
    } as any
    intersectObjectsMock.mockReturnValue([intersection])
    const scene = new THREE.Scene()
    const terrainBlockMap = new Map<string, EntityId>()

    const program = Effect.gen(function* (_) {
      const raycastService = yield* _(RaycastService)
      const result = yield* _(raycastService.cast(scene, terrainBlockMap))
      expect(Option.isNone(result)).toBe(true)
    })

    await Effect.runPromise(Effect.provide(program, RaycastServiceLive.pipe(Layer.provide(ThreeCameraServiceMock))))
  })

  it('should return none if intersected object is not a chunk', async () => {
    const intersection: THREE.Intersection = {
      distance: 5,
      point: new THREE.Vector3(0.5, 0.5, 0.5),
      face: { normal: new THREE.Vector3(0, 1, 0) } as any,
      object: { userData: { type: 'other' } } as any,
    } as any
    intersectObjectsMock.mockReturnValue([intersection])
    const scene = new THREE.Scene()
    const terrainBlockMap = new Map<string, EntityId>()

    const program = Effect.gen(function* (_) {
      const raycastService = yield* _(RaycastService)
      const result = yield* _(raycastService.cast(scene, terrainBlockMap))
      expect(Option.isNone(result)).toBe(true)
    })

    await Effect.runPromise(Effect.provide(program, RaycastServiceLive.pipe(Layer.provide(ThreeCameraServiceMock))))
  })

  it('should return none if hit position does not map to an entity', async () => {
    const intersection: THREE.Intersection = {
      distance: 5,
      point: new THREE.Vector3(10.5, 10.5, 10.5), // This will result in key "10,10,10"
      face: { normal: new THREE.Vector3(0, 1, 0) } as any,
      object: { userData: { type: 'chunk' } } as any,
    } as any
    intersectObjectsMock.mockReturnValue([intersection])
    const scene = new THREE.Scene()
    const terrainBlockMap = new Map<string, EntityId>([['0,0,0', 1 as EntityId]]) // Does not contain "10,10,10"

    const program = Effect.gen(function* (_) {
      const raycastService = yield* _(RaycastService)
      const result = yield* _(raycastService.cast(scene, terrainBlockMap))
      expect(Option.isNone(result)).toBe(true)
    })

    await Effect.runPromise(Effect.provide(program, RaycastServiceLive.pipe(Layer.provide(ThreeCameraServiceMock))))
  })
})
