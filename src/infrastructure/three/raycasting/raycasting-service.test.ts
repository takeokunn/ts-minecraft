import { describe, it, expect } from 'vitest'
import { Effect, Option, Schema } from 'effect'
import * as THREE from 'three'
import {
  RaycastingService,
  RaycastingServiceLive,
  RaycastHitSchema,
  DEFAULT_RAY_DISTANCE,
} from '@/infrastructure/three/raycasting/raycasting-service'

/**
 * Helper function to set up camera and scene for raycasting
 * Three.js requires world matrices to be updated for raycasting to work
 */
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
  for (const mesh of meshes) {
    mesh.updateMatrixWorld(true)
    scene.add(mesh)
  }
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

  describe('createRaycaster', () => {
    it('should create a raycaster with default max distance', () => {
      const program = Effect.gen(function* () {
        const service = yield* RaycastingService
        const raycaster = yield* service.createRaycaster()

        expect(raycaster).toBeInstanceOf(THREE.Raycaster)
        expect(raycaster.far).toBe(DEFAULT_RAY_DISTANCE)

        return { success: true }
      }).pipe(Effect.provide(RaycastingServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return an Effect that resolves to a Raycaster', () => {
      const program = Effect.gen(function* () {
        const service = yield* RaycastingService
        const createEffect = service.createRaycaster()

        expect(typeof createEffect.pipe).toBe('function')
        expect(typeof createEffect).toBe('object')

        return { success: true }
      }).pipe(Effect.provide(RaycastingServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('worldToBlock', () => {
    it('should convert positive world coordinates to block coordinates', () => {
      const program = Effect.gen(function* () {
        const service = yield* RaycastingService
        const blockPos = yield* service.worldToBlock({ x: 5.7, y: 3.2, z: 10.9 })

        expect(blockPos.x).toBe(5)
        expect(blockPos.y).toBe(3)
        expect(blockPos.z).toBe(10)

        return { success: true }
      }).pipe(Effect.provide(RaycastingServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should convert negative world coordinates to block coordinates', () => {
      const program = Effect.gen(function* () {
        const service = yield* RaycastingService
        const blockPos = yield* service.worldToBlock({ x: -5.7, y: -3.2, z: -10.9 })

        expect(blockPos.x).toBe(-6)
        expect(blockPos.y).toBe(-4)
        expect(blockPos.z).toBe(-11)

        return { success: true }
      }).pipe(Effect.provide(RaycastingServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should handle zero coordinates', () => {
      const program = Effect.gen(function* () {
        const service = yield* RaycastingService
        const blockPos = yield* service.worldToBlock({ x: 0, y: 0, z: 0 })

        expect(blockPos.x).toBe(0)
        expect(blockPos.y).toBe(0)
        expect(blockPos.z).toBe(0)

        return { success: true }
      }).pipe(Effect.provide(RaycastingServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should handle exact integer coordinates', () => {
      const program = Effect.gen(function* () {
        const service = yield* RaycastingService
        const blockPos = yield* service.worldToBlock({ x: 5.0, y: 10.0, z: 15.0 })

        expect(blockPos.x).toBe(5)
        expect(blockPos.y).toBe(10)
        expect(blockPos.z).toBe(15)

        return { success: true }
      }).pipe(Effect.provide(RaycastingServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('raycastFromCamera', () => {
    it('should return Option.none when no objects are hit', () => {
      const program = Effect.gen(function* () {
        const service = yield* RaycastingService

        // Create camera and empty scene
        const { camera, scene } = setupRaycastingTest(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, -1),
          []
        )

        const hit = yield* service.raycastFromCamera(camera, scene)

        expect(Option.isNone(hit)).toBe(true)

        return { success: true }
      }).pipe(Effect.provide(RaycastingServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return hit info when hitting an object', () => {
      const program = Effect.gen(function* () {
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
        if (Option.isSome(hitOption)) {
          const hit = hitOption.value
          expect(hit.distance).toBeGreaterThan(0)
          expect(hit.distance).toBeLessThan(DEFAULT_RAY_DISTANCE)
          expect(hit.point).toBeDefined()
          expect(hit.normal).toBeDefined()
          expect(typeof hit.blockX).toBe('number')
          expect(typeof hit.blockY).toBe('number')
          expect(typeof hit.blockZ).toBe('number')
        }

        return { success: true }
      }).pipe(Effect.provide(RaycastingServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should respect maxDistance parameter', () => {
      const program = Effect.gen(function* () {
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

        return { success: true }
      }).pipe(Effect.provide(RaycastingServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return correct point coordinates on hit', () => {
      const program = Effect.gen(function* () {
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
        if (Option.isSome(hitOption)) {
          const hit = hitOption.value
          // Hit should be near the front face of the box (around z = -1.5)
          expect(hit.point.z).toBeLessThan(-1)
          expect(hit.point.z).toBeGreaterThan(-3)
        }

        return { success: true }
      }).pipe(Effect.provide(RaycastingServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return surface normal on hit', () => {
      const program = Effect.gen(function* () {
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
        if (Option.isSome(hitOption)) {
          const hit = hitOption.value
          // Normal should be a unit vector
          const normalLength = Math.sqrt(
            hit.normal.x ** 2 + hit.normal.y ** 2 + hit.normal.z ** 2
          )
          expect(normalLength).toBeCloseTo(1, 5)
        }

        return { success: true }
      }).pipe(Effect.provide(RaycastingServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should calculate block coordinates from hit point', () => {
      const program = Effect.gen(function* () {
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
        if (Option.isSome(hitOption)) {
          const hit = hitOption.value
          expect(hit.blockX).toBe(5)
          expect(hit.blockY).toBe(10)
          expect(hit.blockZ).toBe(-6)
        }

        return { success: true }
      }).pipe(Effect.provide(RaycastingServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should hit the closest object when multiple objects are in range', () => {
      const program = Effect.gen(function* () {
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
        if (Option.isSome(hitOption)) {
          const hit = hitOption.value
          // Should hit the closer box
          expect(hit.distance).toBeLessThan(3)
        }

        return { success: true }
      }).pipe(Effect.provide(RaycastingServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should use default distance when maxDistance is not provided', () => {
      const program = Effect.gen(function* () {
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

        return { success: true }
      }).pipe(Effect.provide(RaycastingServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('RaycastHitSchema', () => {
    const decode = Schema.decodeUnknownSync(RaycastHitSchema)
    const encode = Schema.encodeSync(RaycastHitSchema)

    const validHit = {
      point: { x: 1.5, y: 10.5, z: -2.5 },
      normal: { x: 0, y: 1, z: 0 },
      distance: 3.2,
      blockX: 1,
      blockY: 10,
      blockZ: -3,
    }

    it('decodes a valid hit object', () => {
      const result = decode(validHit)
      expect(result.blockX).toBe(1)
      expect(result.blockY).toBe(10)
      expect(result.blockZ).toBe(-3)
      expect(result.distance).toBeCloseTo(3.2)
    })

    it('rejects fractional blockX (int() constraint)', () => {
      expect(() => decode({ ...validHit, blockX: 1.5 })).toThrow()
    })

    it('rejects fractional blockY (int() constraint)', () => {
      expect(() => decode({ ...validHit, blockY: 10.7 })).toThrow()
    })

    it('rejects fractional blockZ (int() constraint)', () => {
      expect(() => decode({ ...validHit, blockZ: -2.3 })).toThrow()
    })

    it('accepts negative integer block coordinates', () => {
      expect(() => decode({ ...validHit, blockX: -5, blockY: -1, blockZ: -100 })).not.toThrow()
    })

    it('rejects NaN for distance (Schema.finite() constraint)', () => {
      expect(() => decode({ ...validHit, distance: NaN })).toThrow()
    })

    it('rejects Infinity for distance (Schema.finite() constraint)', () => {
      expect(() => decode({ ...validHit, distance: Infinity })).toThrow()
    })

    it('rejects NaN in point vector', () => {
      expect(() => decode({ ...validHit, point: { x: NaN, y: 0, z: 0 } })).toThrow()
    })

    it('rejects Infinity in normal vector', () => {
      expect(() => decode({ ...validHit, normal: { x: Infinity, y: 0, z: 0 } })).toThrow()
    })

    it('rejects missing blockX field', () => {
      const { blockX: _omit, ...withoutBlockX } = validHit
      expect(() => decode(withoutBlockX)).toThrow()
    })

    it('rejects missing point field', () => {
      const { point: _omit, ...withoutPoint } = validHit
      expect(() => decode(withoutPoint)).toThrow()
    })

    it('rejects missing normal field', () => {
      const { normal: _omit, ...withoutNormal } = validHit
      expect(() => decode(withoutNormal)).toThrow()
    })

    it('encodes and decodes in round-trip', () => {
      const decoded = decode(validHit)
      const encoded = encode(decoded)
      const redecoded = decode(encoded)
      expect(redecoded.blockX).toBe(validHit.blockX)
      expect(redecoded.blockY).toBe(validHit.blockY)
      expect(redecoded.blockZ).toBe(validHit.blockZ)
      expect(redecoded.distance).toBeCloseTo(validHit.distance)
      expect(redecoded.point.x).toBeCloseTo(validHit.point.x)
      expect(redecoded.point.y).toBeCloseTo(validHit.point.y)
      expect(redecoded.point.z).toBeCloseTo(validHit.point.z)
    })

    it('Schema.decodeUnknownEither returns Left for fractional blockX', () => {
      const result = Schema.decodeUnknownEither(RaycastHitSchema)({ ...validHit, blockX: 1.5 })
      expect(result._tag).toBe('Left')
    })

    it('Schema.decodeUnknownEither returns Right for valid hit', () => {
      const result = Schema.decodeUnknownEither(RaycastHitSchema)(validHit)
      expect(result._tag).toBe('Right')
    })

    it('accepts zero distance (ray origin at surface)', () => {
      expect(() => decode({ ...validHit, distance: 0 })).not.toThrow()
    })

    it('accepts block coordinates of zero', () => {
      expect(() => decode({ ...validHit, blockX: 0, blockY: 0, blockZ: 0 })).not.toThrow()
    })
  })

  describe('service interface', () => {
    it('should provide RaycastingService as Layer', () => {
      const layer = RaycastingServiceLive

      expect(layer).toBeDefined()
      expect(typeof layer).toBe('object')
    })

    it('should have all required methods', () => {
      const program = Effect.gen(function* () {
        const service = yield* RaycastingService

        expect(typeof service.createRaycaster).toBe('function')
        expect(typeof service.raycastFromCamera).toBe('function')
        expect(typeof service.worldToBlock).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(RaycastingServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should support Effect composition', () => {
      const program = Effect.gen(function* () {
        const service = yield* RaycastingService

        const raycaster = yield* service.createRaycaster()
        const blockPos = yield* service.worldToBlock({ x: 1.5, y: 2.5, z: 3.5 })

        expect(raycaster).toBeInstanceOf(THREE.Raycaster)
        expect(blockPos.x).toBe(1)
        expect(blockPos.y).toBe(2)
        expect(blockPos.z).toBe(3)

        return { success: true }
      }).pipe(Effect.provide(RaycastingServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })
})
