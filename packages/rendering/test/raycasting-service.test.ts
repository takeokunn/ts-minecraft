import { describe,it } from '@effect/vitest'
import {
DEFAULT_RAY_DISTANCE,
RaycastingService,
RaycastingServiceLive
} from '@ts-minecraft/rendering'
import { Array as Arr,Effect,Option } from 'effect'
import * as THREE from 'three'
import { expect } from 'vitest'

// Set up camera and scene for raycasting tests.
// Three.js requires world matrices to be updated for raycasting to work.
const setupRaycastingTest = (
  cameraPos: THREE.Vector3,
  lookAt: THREE.Vector3,
  meshes: THREE.Mesh[]
): { camera: THREE.PerspectiveCamera; scene: THREE.Scene } => {
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  camera.position.copy(cameraPos)
  camera.lookAt(lookAt)
  camera.updateMatrixWorld(true)

  const scene = new THREE.Scene()
  Arr.forEach(meshes, mesh => {
    mesh.updateMatrixWorld(true)
    scene.add(mesh)
  })
  scene.updateMatrixWorld(true)

  return { camera, scene }
}

describe('RaycastingService', () => {
  describe('DEFAULT_RAY_DISTANCE', () => {
    it('should have a default ray distance of 5 blocks', () => {
      expect(DEFAULT_RAY_DISTANCE).toBe(5.0)
    })

    it('should be a positive number', () => {
      expect(DEFAULT_RAY_DISTANCE).toBeGreaterThan(0)
    })
  })

  describe('worldToBlock', () => {
    it.effect('should convert positive world coordinates to block coordinates', () =>
      Effect.gen(function* () {
        const service = yield* RaycastingService
        const blockPos = yield* service.worldToBlock({ x: 5.7, y: 3.2, z: 10.9 })

        expect(blockPos.x).toBe(5)
        expect(blockPos.y).toBe(3)
        expect(blockPos.z).toBe(10)
      }).pipe(Effect.provide(RaycastingServiceLive))
    )

    it.effect('should convert negative world coordinates to block coordinates', () =>
      Effect.gen(function* () {
        const service = yield* RaycastingService
        const blockPos = yield* service.worldToBlock({ x: -5.7, y: -3.2, z: -10.9 })

        expect(blockPos.x).toBe(-6)
        expect(blockPos.y).toBe(-4)
        expect(blockPos.z).toBe(-11)
      }).pipe(Effect.provide(RaycastingServiceLive))
    )

    it.effect('should handle zero coordinates', () =>
      Effect.gen(function* () {
        const service = yield* RaycastingService
        const blockPos = yield* service.worldToBlock({ x: 0, y: 0, z: 0 })

        expect(blockPos.x).toBe(0)
        expect(blockPos.y).toBe(0)
        expect(blockPos.z).toBe(0)
      }).pipe(Effect.provide(RaycastingServiceLive))
    )

    it.effect('should handle exact integer coordinates', () =>
      Effect.gen(function* () {
        const service = yield* RaycastingService
        const blockPos = yield* service.worldToBlock({ x: 5.0, y: 10.0, z: 15.0 })

        expect(blockPos.x).toBe(5)
        expect(blockPos.y).toBe(10)
        expect(blockPos.z).toBe(15)
      }).pipe(Effect.provide(RaycastingServiceLive))
    )
  })

  describe('raycastFromCamera', () => {
    it.effect('should return Option.none when no objects are hit', () =>
      Effect.gen(function* () {
        const service = yield* RaycastingService

        // Create camera and empty scene
        const { camera, scene } = setupRaycastingTest(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, -1),
          []
        )

        const hit = yield* service.raycastFromCamera(camera, scene)

        expect(Option.isNone(hit)).toBe(true)
      }).pipe(Effect.provide(RaycastingServiceLive))
    )

    it.effect('should return hit info when hitting an object', () =>
      Effect.gen(function* () {
        const service = yield* RaycastingService

        // Create a box at Z = -2
        const geometry = new THREE.BoxGeometry(1, 1, 1)
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(0, 0, -2)

        const { camera, scene } = setupRaycastingTest(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, -1),
          [mesh]
        )

        const hitOption = yield* service.raycastFromCamera(camera, scene)

        expect(Option.isSome(hitOption)).toBe(true)
        const hit = Option.getOrThrow(hitOption)
        expect(hit.distance).toBeGreaterThan(0)
        expect(hit.distance).toBeLessThan(DEFAULT_RAY_DISTANCE)
        expect(hit.point).toBeDefined()
        expect(hit.normal).toBeDefined()
        expect(typeof hit.blockX).toBe('number')
        expect(typeof hit.blockY).toBe('number')
        expect(typeof hit.blockZ).toBe('number')
      }).pipe(Effect.provide(RaycastingServiceLive))
    )

    it.effect('should respect maxDistance parameter', () =>
      Effect.gen(function* () {
        const service = yield* RaycastingService

        // Create a box at Z = -10 (beyond default distance)
        const geometry = new THREE.BoxGeometry(1, 1, 1)
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(0, 0, -10)

        const { camera, scene } = setupRaycastingTest(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, -1),
          [mesh]
        )

        // Should not hit with default distance (5)
        const hitDefault = yield* service.raycastFromCamera(camera, scene, 5)
        expect(Option.isNone(hitDefault)).toBe(true)

        // Should hit with extended distance (15)
        const hitExtended = yield* service.raycastFromCamera(camera, scene, 15)
        expect(Option.isSome(hitExtended)).toBe(true)
      }).pipe(Effect.provide(RaycastingServiceLive))
    )

    it.effect('should return correct point coordinates on hit', () =>
      Effect.gen(function* () {
        const service = yield* RaycastingService

        // Create a box centered at (0, 0, -2)
        const geometry = new THREE.BoxGeometry(1, 1, 1)
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(0, 0, -2)

        const { camera, scene } = setupRaycastingTest(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, -1),
          [mesh]
        )

        const hitOption = yield* service.raycastFromCamera(camera, scene)

        expect(Option.isSome(hitOption)).toBe(true)
        const hit = Option.getOrThrow(hitOption)
        // Hit should be near the front face of the box (around z = -1.5)
        expect(hit.point.z).toBeLessThan(-1)
        expect(hit.point.z).toBeGreaterThan(-3)
      }).pipe(Effect.provide(RaycastingServiceLive))
    )

    it.effect('should return surface normal on hit', () =>
      Effect.gen(function* () {
        const service = yield* RaycastingService

        // Create a box centered at (0, 0, -2)
        const geometry = new THREE.BoxGeometry(1, 1, 1)
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(0, 0, -2)

        const { camera, scene } = setupRaycastingTest(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, -1),
          [mesh]
        )

        const hitOption = yield* service.raycastFromCamera(camera, scene)

        expect(Option.isSome(hitOption)).toBe(true)
        const hit = Option.getOrThrow(hitOption)
        // Normal should be a unit vector
        const normalLength = Math.sqrt(
          hit.normal.x ** 2 + hit.normal.y ** 2 + hit.normal.z ** 2
        )
        expect(normalLength).toBeCloseTo(1, 5)
      }).pipe(Effect.provide(RaycastingServiceLive))
    )

    it.effect('should calculate block coordinates from hit point', () =>
      Effect.gen(function* () {
        const service = yield* RaycastingService

        // Create a box at exact block position (5, 10, -5)
        const geometry = new THREE.BoxGeometry(1, 1, 1)
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(5.5, 10.5, -5.5) // Center of block (5, 10, -5)

        // Camera in front of the block
        const { camera, scene } = setupRaycastingTest(
          new THREE.Vector3(5.5, 10.5, -3),
          new THREE.Vector3(5.5, 10.5, -6),
          [mesh]
        )

        const hitOption = yield* service.raycastFromCamera(camera, scene, 10)

        expect(Option.isSome(hitOption)).toBe(true)
        const hit = Option.getOrThrow(hitOption)
        expect(hit.blockX).toBe(5)
        expect(hit.blockY).toBe(10)
        expect(hit.blockZ).toBe(-6)
      }).pipe(Effect.provide(RaycastingServiceLive))
    )

    it.effect('should hit the closest object when multiple objects are in range', () =>
      Effect.gen(function* () {
        const service = yield* RaycastingService

        // Near box at Z = -2
        const nearGeometry = new THREE.BoxGeometry(1, 1, 1)
        const nearMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
        const nearMesh = new THREE.Mesh(nearGeometry, nearMaterial)
        nearMesh.position.set(0, 0, -2)

        // Far box at Z = -4
        const farGeometry = new THREE.BoxGeometry(1, 1, 1)
        const farMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        const farMesh = new THREE.Mesh(farGeometry, farMaterial)
        farMesh.position.set(0, 0, -4)

        const { camera, scene } = setupRaycastingTest(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, -1),
          [nearMesh, farMesh]
        )

        const hitOption = yield* service.raycastFromCamera(camera, scene)

        expect(Option.isSome(hitOption)).toBe(true)
        const hit = Option.getOrThrow(hitOption)
        // Should hit the closer box
        expect(hit.distance).toBeLessThan(3)
      }).pipe(Effect.provide(RaycastingServiceLive))
    )

    it.effect('should use default distance when maxDistance is not provided', () =>
      Effect.gen(function* () {
        const service = yield* RaycastingService

        // Create a box at Z = -3 (within default distance)
        const geometry = new THREE.BoxGeometry(1, 1, 1)
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(0, 0, -3)

        const { camera, scene } = setupRaycastingTest(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, -1),
          [mesh]
        )

        // Call without maxDistance parameter
        const hit = yield* service.raycastFromCamera(camera, scene)

        expect(Option.isSome(hit)).toBe(true)
      }).pipe(Effect.provide(RaycastingServiceLive))
    )
  })

})
