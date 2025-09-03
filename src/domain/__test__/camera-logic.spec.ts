import { describe, assert, it } from '@effect/vitest'
import { clampPitch, getCameraLookAt, updateCamera, updateCameraPosition } from '../camera-logic'
import { Camera, Position, TargetBlock, TargetNone } from '../components'
import { Effect, Option } from 'effect'
import * as S from 'effect/Schema'
import * as Arbitrary from 'effect/Arbitrary'
import * as fc from 'effect/FastCheck'
import { Vector3Int, toFloat, toInt, Float } from '../common'
import { toEntityId } from '../entity'
import { vec3 } from 'gl-matrix'

const PI_HALF = Math.PI / 2

const SafeFloatArbitrary = fc.float({ min: -1e5, max: 1e5, noNaN: true }).map(toFloat)

const PositionArbitrary = fc.record({
  x: SafeFloatArbitrary,
  y: SafeFloatArbitrary,
  z: SafeFloatArbitrary,
}).map(p => new Position(p))

const CameraArbitrary = fc.record({
  position: PositionArbitrary,
  target: fc.option(PositionArbitrary, { nil: undefined }),
  damping: fc.float({ min: 0, max: 1, noNaN: true }).map(toFloat),
}).map(c => new Camera(c))

describe('clampPitch', () => {
  it.effect('should always return a value between -PI/2 and PI/2', () =>
    Effect.sync(() =>
      fc.assert(
        fc.property(Arbitrary.make(S.Number), (pitch) => {
          const clamped = clampPitch(toFloat(pitch))
          assert.isAtLeast(clamped, -PI_HALF)
          assert.isAtMost(clamped, PI_HALF)
        }),
      ),
    ),
  )

  it.effect('should not change values within the valid range', () =>
    Effect.sync(() =>
      fc.assert(
        fc.property(fc.float({ min: Math.fround(-PI_HALF), max: Math.fround(PI_HALF), noNaN: true }), (pitch) => {
          const clamped = clampPitch(toFloat(pitch))
          assert.closeTo(clamped, pitch, 0.0001)
        }),
      ),
    ),
  )

  it.effect('should clamp values greater than PI/2', () =>
    Effect.sync(() =>
      fc.assert(
        fc.property(fc.float({ min: Math.fround(PI_HALF + Number.EPSILON), noNaN: true }), (pitch) => {
          const clamped = clampPitch(toFloat(pitch))
          assert.closeTo(clamped, PI_HALF, 0.0001)
        }),
      ),
    ),
  )

  it.effect('should clamp values less than -PI/2', () =>
    Effect.sync(() =>
      fc.assert(
        fc.property(fc.float({ max: Math.fround(-PI_HALF - Number.EPSILON), noNaN: true }), (pitch) => {
          const clamped = clampPitch(toFloat(pitch))
          assert.closeTo(clamped, -PI_HALF, 0.0001)
        }),
      ),
    ),
  )

  it.effect('should return 0 for NaN input', () =>
    Effect.sync(() => {
      const clamped = clampPitch(toFloat(NaN))
      assert.strictEqual(clamped, 0)
    }))
})

describe('updateCamera', () => {
  it.effect('should update camera target when target is a block', () =>
    Effect.sync(() => {
      const camera = new Camera({
        position: new Position({ x: toFloat(0), y: toFloat(0), z: toFloat(0) }),
        damping: toFloat(0.1),
      })
      const position = new Position({ x: toFloat(1), y: toFloat(2), z: toFloat(3) })
      const entityId = toEntityId(1)
      const face: Vector3Int = [toInt(0), toInt(1), toInt(0)]
      const target = new TargetBlock({ _tag: 'block', position, entityId, face })
      const updatedCamera = updateCamera(camera, Option.some(target))
      assert.deepStrictEqual(updatedCamera.target, position)
    }))

  it.effect('should remove camera target when target is none', () =>
    Effect.sync(() => {
      const camera = new Camera({
        position: new Position({ x: toFloat(0), y: toFloat(0), z: toFloat(0) }),
        damping: toFloat(0.1),
        target: new Position({ x: toFloat(1), y: toFloat(1), z: toFloat(1) }),
      })
      const target = new TargetNone({ _tag: 'none' })
      const updatedCamera = updateCamera(camera, Option.some(target))
      assert.isUndefined(updatedCamera.target)
    }))

  it.effect('should not update camera target when target is not present', () =>
    Effect.sync(() => {
      const camera = new Camera({
        position: new Position({ x: toFloat(0), y: toFloat(0), z: toFloat(0) }),
        damping: toFloat(0.1),
      })
      const updatedCamera = updateCamera(camera, Option.none())
      assert.isUndefined(updatedCamera.target)
    }))
})

describe('updateCameraPosition', () => {
  it.effect('should update camera position towards target', () =>
    Effect.sync(() => {
      const camera = new Camera({
        position: new Position({ x: toFloat(0), y: toFloat(0), z: toFloat(0) }),
        damping: toFloat(0.1),
      })
      const targetPosition = new Position({ x: toFloat(10), y: toFloat(10), z: toFloat(10) })
      const deltaTime = 0.1
      const updatedCamera = updateCameraPosition(camera, Option.some(targetPosition), deltaTime)
      assert.notDeepEqual(updatedCamera.position, camera.position)
    }))

  it.effect('should not update camera position when target is not present', () =>
    Effect.sync(() => {
      const camera = new Camera({
        position: new Position({ x: toFloat(0), y: toFloat(0), z: toFloat(0) }),
        damping: toFloat(0.1),
      })
      const deltaTime = 0.1
      const updatedCamera = updateCameraPosition(camera, Option.none(), deltaTime)
      assert.deepStrictEqual(updatedCamera.position, camera.position)
    }))

  it.effect('should move camera closer to the target', () =>
    Effect.sync(() =>
      fc.assert(
        fc.property(CameraArbitrary, PositionArbitrary, fc.float({ min: 0, max: 1, noNaN: true }), (camera, target, deltaTime) => {
          const initialPos = vec3.fromValues(camera.position.x, camera.position.y, camera.position.z)
          const targetPos = vec3.fromValues(target.x, target.y, target.z)
          const initialDist = vec3.dist(initialPos, targetPos)

          const updatedCamera = updateCameraPosition(camera, Option.some(target), deltaTime)
          const finalPos = vec3.fromValues(updatedCamera.position.x, updatedCamera.position.y, updatedCamera.position.z)
          const finalDist = vec3.dist(finalPos, targetPos)

          if (initialDist > 0.0001) {
            assert.isAtMost(finalDist, initialDist + 0.0001) // Allow for floating point inaccuracies
          } else {
            assert.closeTo(finalDist, 0, 0.0001)
          }
        }),
      ),
    ))
})

describe('getCameraLookAt', () => {
  it.effect('should return a look at vector', () =>
    Effect.sync(() => {
      const camera = new Camera({
        position: new Position({ x: toFloat(1), y: toFloat(2), z: toFloat(3) }),
        damping: toFloat(0.1),
      })
      const lookAt = getCameraLookAt(camera)
      assert.deepStrictEqual(lookAt, [toFloat(1), toFloat(2), toFloat(2)])
    }))

  it.effect('should not return NaN values', () =>
    Effect.sync(() =>
      fc.assert(
        fc.property(CameraArbitrary, (camera) => {
          const lookAt = getCameraLookAt(camera)
          assert.isFalse(Number.isNaN(lookAt[0]))
          assert.isFalse(Number.isNaN(lookAt[1]))
          assert.isFalse(Number.isNaN(lookAt[2]))
        }),
      ),
    ))
})
