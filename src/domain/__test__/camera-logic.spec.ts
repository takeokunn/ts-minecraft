import { describe, assert, it } from '@effect/vitest'
import * as fc from 'fast-check'
import { clampPitch, getCameraLookAt, updateCamera, updateCameraPosition } from '../camera-logic'
import * as Arbitrary from 'effect/Arbitrary'
import { Camera, Position, TargetBlock, TargetNone } from '../components'
import { Option, Effect } from 'effect'
import { Vector3IntSchema } from '../common'
import { EntityIdSchema } from '../entity'

const PI_HALF = Math.PI / 2

describe('clampPitch', () => {
  it.effect('should always return a value between -PI/2 and PI/2', () =>
    Effect.gen(function*(_) {
      yield* _(
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(fc.float(), async (pitch) => {
              const clamped = await Effect.runPromise(clampPitch(pitch))
              assert.isAtLeast(clamped, -PI_HALF)
              assert.isAtMost(clamped, PI_HALF)
            }),
          ),
        ),
      )
    }),
  )

  it.effect('should return 0 for NaN input', () =>
    Effect.gen(function*(_) {
      const clamped = yield* _(clampPitch(NaN))
      assert.strictEqual(clamped, 0)
    }),
  )

  it.effect('should not change values within the valid range', () =>
    Effect.gen(function*(_) {
      let clamped = yield* _(clampPitch(0))
      assert.closeTo(clamped, 0, 0.0001)
      clamped = yield* _(clampPitch(PI_HALF / 2))
      assert.closeTo(clamped, PI_HALF / 2, 0.0001)
      clamped = yield* _(clampPitch(-PI_HALF / 2))
      assert.closeTo(clamped, -PI_HALF / 2, 0.0001)
    }),
  )

  it.effect('should clamp values outside the valid range', () =>
    Effect.gen(function*(_) {
      let clamped = yield* _(clampPitch(Math.PI))
      assert.closeTo(clamped, PI_HALF, 0.0001)
      clamped = yield* _(clampPitch(-Math.PI))
      assert.closeTo(clamped, -PI_HALF, 0.0001)
    }),
  )
})

describe('updateCamera', () => {
  const cameraArbitrary = Arbitrary.make(Camera)
  const positionArbitrary = Arbitrary.make(Position)
  const entityIdArbitrary = Arbitrary.make(EntityIdSchema)
  const vector3IntArbitrary = Arbitrary.make(Vector3IntSchema)

  it.prop('should update camera target when target is a block', [cameraArbitrary, positionArbitrary, entityIdArbitrary, vector3IntArbitrary], (camera, position, entityId, face) =>
    Effect.gen(function* (_) {
      const target: TargetBlock = { _tag: 'block', position, entityId, face }
      const updatedCamera = yield* _(updateCamera(camera, Option.some(target)))
      assert.deepStrictEqual(updatedCamera.target, position)
    }),
  )

  it.prop('should remove camera target when target is none', [cameraArbitrary], (camera) =>
    Effect.gen(function* (_) {
      const target: TargetNone = { _tag: 'none' }
      const updatedCamera = yield* _(updateCamera(camera, Option.some(target)))
      assert.isUndefined(updatedCamera.target)
    }),
  )

  it.prop('should not update camera target when target is not present', [cameraArbitrary], (camera) =>
    Effect.gen(function* (_) {
      const updatedCamera = yield* _(updateCamera(camera, Option.none()))
      assert.isUndefined(updatedCamera.target)
    }),
  )
})

describe('updateCameraPosition', () => {
  const cameraArbitrary = Arbitrary.make(Camera)
  const positionArbitrary = Arbitrary.make(Position)

  it.prop('should update camera position towards target', [cameraArbitrary, positionArbitrary], (camera, targetPosition) =>
    Effect.gen(function* (_) {
      const deltaTime = 0.1
      const updatedCamera = yield* _(updateCameraPosition(camera, Option.some(targetPosition), deltaTime))
      // This is a basic check. A more thorough test would check the lerp calculation.
      assert.notDeepStrictEqual(updatedCamera.position, camera.position)
    }),
  )

  it.prop('should not update camera position when target is not present', [cameraArbitrary], (camera) =>
    Effect.gen(function* (_) {
      const deltaTime = 0.1
      const updatedCamera = yield* _(updateCameraPosition(camera, Option.none(), deltaTime))
      assert.deepStrictEqual(updatedCamera.position, camera.position)
    }),
  )
})

describe('getCameraLookAt', () => {
  const cameraArbitrary = Arbitrary.make(Camera)

  it.prop('should return a look at vector', [cameraArbitrary], (camera) =>
    Effect.gen(function* (_) {
      const lookAt = yield* _(getCameraLookAt(camera))
      assert.deepStrictEqual(lookAt, [camera.position.x, camera.position.y, camera.position.z - 1])
    }),
  )
})