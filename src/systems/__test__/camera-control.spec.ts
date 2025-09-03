import { describe, it, vi, assert } from '@effect/vitest'
import { Effect, Layer, Ref } from 'effect'
import { cameraControlSystem } from '../camera-control'
import { InputManager, World } from '@/runtime/services'
import { toEntityId } from '@/domain/entity'
import { CameraState, InputState } from '@/domain/components'
import { clampPitch } from '@/domain/camera-logic'
import { SoAResult } from '@/domain/types'
import { playerQuery } from '@/domain/queries'
import { toFloat } from '@/domain/common'

const MOUSE_SENSITIVITY = 0.002

describe('cameraControlSystem', () => {
  const mockInputState: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    place: false,
    destroy: false,
    isLocked: false,
  }

  it.effect('should update camera state for multiple entities when mouse moves', () =>
    Effect.gen(function* (_) {
      const entityId1 = toEntityId(1)
      const entityId2 = toEntityId(2)
      const initialPitch1 = toFloat(0.5)
      const initialYaw1 = toFloat(1.0)
      const initialPitch2 = toFloat(0.2)
      const initialYaw2 = toFloat(0.8)
      const cameraState1: CameraState = { pitch: initialPitch1, yaw: initialYaw1 }
      const cameraState2: CameraState = { pitch: initialPitch2, yaw: initialYaw2 }
      const mouseDelta = { dx: 10, dy: 20 }

      const soa: SoAResult<typeof playerQuery.components> = {
        entities: [entityId1, entityId2],
        components: {
          position: [],
          velocity: [],
          player: [],
          inputState: [],
          cameraState: [cameraState1, cameraState2],
          hotbar: [],
          gravity: [],
          collider: [],
          target: [],
        },
      }

      const updateComponentSpy = vi.fn(() => Effect.succeed(undefined))

      const mockWorld: World = {
        querySoA: () => Effect.succeed(soa as any),
        updateComponent: updateComponentSpy,
      } as unknown as World

      const mockInputManager: InputManager = {
        isLocked: Ref.unsafeMake(false),
        getState: () => Effect.succeed(mockInputState),
        getMouseState: () => Effect.succeed(mouseDelta),
      }

      const testLayer = Layer.merge(
        Layer.succeed(World, mockWorld),
        Layer.succeed(InputManager, mockInputManager),
      )

      yield* _(cameraControlSystem.pipe(Effect.provide(testLayer)))

      const deltaPitch = -mouseDelta.dy * MOUSE_SENSITIVITY
      const deltaYaw = -mouseDelta.dx * MOUSE_SENSITIVITY

      const expectedPitch1 = clampPitch(toFloat(initialPitch1 + deltaPitch))
      const expectedYaw1 = toFloat(initialYaw1 + deltaYaw)
      const expectedPitch2 = clampPitch(toFloat(initialPitch2 + deltaPitch))
      const expectedYaw2 = toFloat(initialYaw2 + deltaYaw)

      assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 2)
      assert.deepStrictEqual(
        updateComponentSpy.mock.calls[0],
        [entityId1, 'cameraState', { pitch: expectedPitch1, yaw: expectedYaw1 }],
      )
      assert.deepStrictEqual(
        updateComponentSpy.mock.calls[1],
        [entityId2, 'cameraState', { pitch: expectedPitch2, yaw: expectedYaw2 }],
      )
    }))

  it.effect('should not update camera state when mouse does not move', () =>
    Effect.gen(function* (_) {
      const mouseDelta = { dx: 0, dy: 0 }

      const querySoaSpy = vi.fn(() => Effect.succeed({ entities: [], components: {} } as any))
      const updateComponentSpy = vi.fn(() => Effect.succeed(undefined))

      const mockWorld: World = {
        querySoA: querySoaSpy,
        updateComponent: updateComponentSpy,
      } as unknown as World

      const mockInputManager: InputManager = {
        isLocked: Ref.unsafeMake(false),
        getState: () => Effect.succeed(mockInputState),
        getMouseState: () => Effect.succeed(mouseDelta),
      }

      const testLayer = Layer.merge(
        Layer.succeed(World, mockWorld),
        Layer.succeed(InputManager, mockInputManager),
      )

      yield* _(cameraControlSystem.pipe(Effect.provide(testLayer)))

      assert.deepStrictEqual(querySoaSpy.mock.calls.length, 0)
      assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 0)
    }))

  it.effect('should not fail when there are no player entities', () =>
    Effect.gen(function* (_) {
      const mouseDelta = { dx: 10, dy: 20 }
      const soa: SoAResult<typeof playerQuery.components> = {
        entities: [],
        components: {
          position: [],
          velocity: [],
          player: [],
          inputState: [],
          cameraState: [],
          hotbar: [],
          gravity: [],
          collider: [],
          target: [],
        },
      }

      const updateComponentSpy = vi.fn(() => Effect.succeed(undefined))

      const mockWorld: World = {
        querySoA: () => Effect.succeed(soa as any),
        updateComponent: updateComponentSpy,
      } as unknown as World

      const mockInputManager: InputManager = {
        isLocked: Ref.unsafeMake(false),
        getState: () => Effect.succeed(mockInputState),
        getMouseState: () => Effect.succeed(mouseDelta),
      }

      const testLayer = Layer.merge(
        Layer.succeed(World, mockWorld),
        Layer.succeed(InputManager, mockInputManager),
      )

      yield* _(cameraControlSystem.pipe(Effect.provide(testLayer)))

      assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 0)
    }))
})
