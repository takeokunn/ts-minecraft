import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Array as Arr, Effect } from 'effect'
import {
  PerspectiveCameraService,
  PerspectiveCameraServiceLive,
  PerspectiveCameraParamsSchema,
  DEFAULT_CAMERA_OFFSET,
  DEFAULT_LERP_FACTOR,
} from './perspective'
import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// THREE.js mock — avoid full renderer setup in tests
// ---------------------------------------------------------------------------
const makeMockCamera = (fov = 75, aspect = 1.6, near = 0.1, far = 1000) => ({
  fov,
  aspect,
  near,
  far,
  position: { x: 0, y: 0, z: 0, set: (x: number, y: number, z: number) => { camera.position.x = x; camera.position.y = y; camera.position.z = z } },
  updateProjectionMatrix: () => {},
  lookAt: (_x: number, _y: number, _z: number) => {},
  projectionMatrix: { elements: Arr.makeBy(16, () => 0) },
  matrixWorldInverse: { elements: Arr.makeBy(16, () => 0) },
  updateMatrixWorld: () => {},
})
type MockCamera = ReturnType<typeof makeMockCamera>
let camera: MockCamera

describe('infrastructure/three/camera/perspective', () => {
  describe('constants', () => {
    it('DEFAULT_CAMERA_OFFSET has correct shape', () => {
      expect(DEFAULT_CAMERA_OFFSET).toEqual({ x: 0, y: 5, z: 10 })
    })

    it('DEFAULT_LERP_FACTOR is 0.1', () => {
      expect(DEFAULT_LERP_FACTOR).toBe(0.1)
    })
  })

  describe('PerspectiveCameraParamsSchema', () => {
    it('should accept valid params', () => {
      const params = { fov: 75, aspect: 1.6, near: 0.1, far: 1000 }
      const result = Schema.decodeUnknownSync(PerspectiveCameraParamsSchema)(params)
      expect(result).toEqual(params)
    })

    it('should reject fov=0 (not between 1 and 179)', () => {
      expect(() =>
        Schema.decodeUnknownSync(PerspectiveCameraParamsSchema)({ fov: 0, aspect: 1, near: 0.1, far: 1000 })
      ).toThrow()
    })

    it('should reject negative aspect', () => {
      expect(() =>
        Schema.decodeUnknownSync(PerspectiveCameraParamsSchema)({ fov: 75, aspect: -1, near: 0.1, far: 1000 })
      ).toThrow()
    })

    it('should reject near=0 (not positive)', () => {
      expect(() =>
        Schema.decodeUnknownSync(PerspectiveCameraParamsSchema)({ fov: 75, aspect: 1, near: 0, far: 1000 })
      ).toThrow()
    })
  })

  describe('PerspectiveCameraService via Layer', () => {
    it.effect('should expose all required methods', () =>
      Effect.gen(function* () {
        const service = yield* PerspectiveCameraService
        expect(typeof service.create).toBe('function')
        expect(typeof service.updateAspect).toBe('function')
        expect(typeof service.updateProjectionMatrix).toBe('function')
        expect(typeof service.setPosition).toBe('function')
        expect(typeof service.lookAt).toBe('function')
        expect(typeof service.smoothFollow).toBe('function')
      }).pipe(Effect.provide(PerspectiveCameraServiceLive))
    )

    it.effect('updateAspect should update camera.aspect', () => {
      camera = makeMockCamera()
      return Effect.gen(function* () {
        const service = yield* PerspectiveCameraService
        yield* service.updateAspect(camera as never, 2.0)
        expect(camera.aspect).toBe(2.0)
      }).pipe(Effect.provide(PerspectiveCameraServiceLive))
    })

    it.effect('setPosition should update camera.position', () => {
      camera = makeMockCamera()
      return Effect.gen(function* () {
        const service = yield* PerspectiveCameraService
        yield* service.setPosition(camera as never, { x: 5, y: 10, z: 15 })
        expect(camera.position.x).toBe(5)
        expect(camera.position.y).toBe(10)
        expect(camera.position.z).toBe(15)
      }).pipe(Effect.provide(PerspectiveCameraServiceLive))
    })

    it.effect('smoothFollow should move camera toward target', () => {
      camera = makeMockCamera()
      camera.position.x = 0
      camera.position.y = 0
      camera.position.z = 0
      return Effect.gen(function* () {
        const service = yield* PerspectiveCameraService
        yield* service.smoothFollow(
          camera as never,
          { x: 10, y: 10, z: 10 },
          { x: 0, y: 5, z: 10 },
          1.0 // lerp=1 means instant jump to target
        )
        // With lerpFactor=1: camera jumps to targetX=10+0=10, targetY=10+5=15, targetZ=10+10=20
        expect(camera.position.x).toBeCloseTo(10)
        expect(camera.position.y).toBeCloseTo(15)
        expect(camera.position.z).toBeCloseTo(20)
      }).pipe(Effect.provide(PerspectiveCameraServiceLive))
    })
  })
})
