import { describe, assert, it } from '@effect/vitest'
import { clampPitch, getCameraLookAt, updateCamera, updateCameraPosition } from '../camera-logic'
import { Camera, Position, TargetBlock, TargetNone } from '../components'
import { Effect, Option, Gen } from 'effect'
import { Vector3Int, toFloat, toInt } from '../common'
import { toEntityId } from '../entity'
import * as fc from 'effect/FastCheck'
import * as S from 'effect/Schema'

const PI_HALF = Math.PI / 2

describe('clampPitch', () => {
  it.effect('should always return a value between -PI/2 and PI/2', () =>
    Gen.flatMap(fc.gen(S.Float), (pitch) =>
      Effect.sync(() => {
        const clamped = clampPitch(pitch)
        assert.isAtLeast(clamped, -PI_HALF)
        assert.isAtMost(clamped, PI_HALF)
      }),
    ))

  it.effect('should return 0 for NaN input', () =>
    Effect.sync(() => {
      const clamped = clampPitch(toFloat(NaN))
      assert.strictEqual(clamped, 0)
    }))

  it.effect('should not change values within the valid range', () =>
    Effect.sync(() => {
      let clamped = clampPitch(toFloat(0))
      assert.closeTo(clamped, 0, 0.0001)
      clamped = clampPitch(toFloat(PI_HALF / 2))
      assert.closeTo(clamped, PI_HALF / 2, 0.0001)
      clamped = clampPitch(toFloat(-PI_HALF / 2))
      assert.closeTo(clamped, -PI_HALF / 2, 0.0001)
    }))

  it.effect('should clamp values outside the valid range', () =>
    Effect.sync(() => {
      let clamped = clampPitch(toFloat(Math.PI))
      assert.closeTo(clamped, PI_HALF, 0.0001)
      clamped = clampPitch(toFloat(-Math.PI))
      assert.closeTo(clamped, -PI_HALF, 0.0001)
    }))
})

describe('updateCamera', () => {
  it.effect('should update camera target when target is a block', () =>
    Effect.sync(() => {
      const camera: Camera = {
        position: { x: toFloat(0), y: toFloat(0), z: toFloat(0) },
        damping: toFloat(0.1),
      }
      const position: Position = { x: toFloat(1), y: toFloat(2), z: toFloat(3) }
      const entityId = toEntityId(1)
      const face: Vector3Int = [toInt(0), toInt(1), toInt(0)]
      const target: TargetBlock = { _tag: 'block', position, entityId, face }
      const updatedCamera = updateCamera(camera, Option.some(target))
      assert.deepStrictEqual(updatedCamera.target, position)
    }))

  it.effect('should remove camera target when target is none', () =>
    Effect.sync(() => {
      const camera: Camera = {
        position: { x: toFloat(0), y: toFloat(0), z: toFloat(0) },
        damping: toFloat(0.1),
        target: { x: toFloat(1), y: toFloat(1), z: toFloat(1) },
      }
      const target: TargetNone = { _tag: 'none' }
      const updatedCamera = updateCamera(camera, Option.some(target))
      assert.isUndefined(updatedCamera.target)
    }))

  it.effect('should not update camera target when target is not present', () =>
    Effect.sync(() => {
      const camera: Camera = {
        position: { x: toFloat(0), y: toFloat(0), z: toFloat(0) },
        damping: toFloat(0.1),
      }
      const updatedCamera = updateCamera(camera, Option.none())
      assert.isUndefined(updatedCamera.target)
    }))
})

describe('updateCameraPosition', () => {
  it.effect('should update camera position towards target', () =>
    Effect.sync(() => {
      const camera: Camera = {
        position: { x: toFloat(0), y: toFloat(0), z: toFloat(0) },
        damping: toFloat(0.1),
      }
      const targetPosition: Position = { x: toFloat(10), y: toFloat(10), z: toFloat(10) }
      const deltaTime = 0.1
      const updatedCamera = updateCameraPosition(camera, Option.some(targetPosition), deltaTime)
      assert.notDeepEqual(updatedCamera.position, camera.position)
    }))

  it.effect('should not update camera position when target is not present', () =>
    Effect.sync(() => {
      const camera: Camera = {
        position: { x: toFloat(0), y: toFloat(0), z: toFloat(0) },
        damping: toFloat(0.1),
      }
      const deltaTime = 0.1
      const updatedCamera = updateCameraPosition(camera, Option.none(), deltaTime)
      assert.deepStrictEqual(updatedCamera.position, camera.position)
    }))
})

describe('getCameraLookAt', () => {
  it.effect('should return a look at vector', () =>
    Effect.sync(() => {
      const camera: Camera = {
        position: { x: toFloat(1), y: toFloat(2), z: toFloat(3) },
        damping: toFloat(0.1),
      }
      const lookAt = getCameraLookAt(camera)
      assert.deepStrictEqual(lookAt, [toFloat(1), toFloat(2), toFloat(2)])
    }))
})