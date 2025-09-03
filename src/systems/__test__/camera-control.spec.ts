import { describe, it, expect, vi, beforeEach, assert } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { cameraControlSystem } from '../camera-control'
import { InputManager, World } from '@/runtime/services'
import { EntityId } from '@/domain/entity'
import { CameraState } from '@/domain/components'
import { clampPitch } from '@/domain/camera-logic'
import { Float } from '@/domain/common'
import { SoA } from '@/domain/world'
import { playerQuery } from '@/domain/queries'

const MOUSE_SENSITIVITY = 0.002

describe('cameraControlSystem', () => {
  it.effect('should update camera state for multiple entities when mouse moves', () =>
    Effect.gen(function* (_) {
      const entityId1 = EntityId('1')
      const entityId2 = EntityId('2')
      const initialPitch1 = Float(0.5)
      const initialYaw1 = Float(1.0)
      const initialPitch2 = Float(0.2)
      const initialYaw2 = Float(0.8)
      const cameraState1 = new CameraState({ pitch: initialPitch1, yaw: initialYaw1 })
      const cameraState2 = new CameraState({ pitch: initialPitch2, yaw: initialYaw2 })
      const mouseDelta = { dx: 10, dy: 20 }

      const soa: SoA<typeof playerQuery> = {
        entities: [entityId1, entityId2],
        components: {
          position: [],
          velocity: [],
          player: [],
          inputState: [],
          cameraState: [cameraState1, cameraState2],
          hotbar: [],
        },
      }

      const mockWorld: Partial<World> = {
        querySoA: () => Effect.succeed(soa),
        updateComponent: () => Effect.succeed(undefined),
      }

      const mockInputManager: Partial<InputManager> = {
        getMouseState: () => Effect.succeed(mouseDelta),
      }

      const worldLayer = Layer.succeed(World, mockWorld as World)
      const inputManagerLayer = Layer.succeed(InputManager, mockInputManager as InputManager)
      const testLayer = worldLayer.pipe(Layer.provide(inputManagerLayer))

      const world = yield* _(World)
      const updateComponentSpy = vi.spyOn(world, 'updateComponent')

      yield* _(cameraControlSystem.pipe(Effect.provide(testLayer)))

      const deltaPitch = -mouseDelta.dy * MOUSE_SENSITIVITY
      const deltaYaw = -mouseDelta.dx * MOUSE_SENSITIVITY

      const expectedPitch1 = clampPitch(Float(initialPitch1 + deltaPitch))
      const expectedYaw1 = Float(initialYaw1 + deltaYaw)
      const expectedPitch2 = clampPitch(Float(initialPitch2 + deltaPitch))
      const expectedYaw2 = Float(initialYaw2 + deltaYaw)

      assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 2)
      assert.deepStrictEqual(
        updateComponentSpy.mock.calls[0],
        [entityId1, 'cameraState', new CameraState({ pitch: expectedPitch1, yaw: expectedYaw1 })],
      )
      assert.deepStrictEqual(
        updateComponentSpy.mock.calls[1],
        [entityId2, 'cameraState', new CameraState({ pitch: expectedPitch2, yaw: expectedYaw2 })],
      )
    }))

  it.effect('should not update camera state when mouse does not move', () =>
    Effect.gen(function* (_) {
      const mouseDelta = { dx: 0, dy: 0 }

      const mockWorld: Partial<World> = {
        querySoA: () => Effect.succeed({ entities: [], components: {} } as any),
        updateComponent: () => Effect.succeed(undefined),
      }

      const mockInputManager: Partial<InputManager> = {
        getMouseState: () => Effect.succeed(mouseDelta),
      }

      const worldLayer = Layer.succeed(World, mockWorld as World)
      const inputManagerLayer = Layer.succeed(InputManager, mockInputManager as InputManager)
      const testLayer = worldLayer.pipe(Layer.provide(inputManagerLayer))

      const world = yield* _(World)
      const querySoaSpy = vi.spyOn(world, 'querySoA')
      const updateComponentSpy = vi.spyOn(world, 'updateComponent')

      yield* _(cameraControlSystem.pipe(Effect.provide(testLayer)))

      assert.deepStrictEqual(querySoaSpy.mock.calls.length, 0)
      assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 0)
    }))

  it.effect('should not fail when there are no player entities', () =>
    Effect.gen(function* (_) {
      const mouseDelta = { dx: 10, dy: 20 }
      const soa: SoA<typeof playerQuery> = {
        entities: [],
        components: {
          position: [],
          velocity: [],
          player: [],
          inputState: [],
          cameraState: [],
          hotbar: [],
        },
      }

      const mockWorld: Partial<World> = {
        querySoA: () => Effect.succeed(soa),
        updateComponent: () => Effect.succeed(undefined),
      }

      const mockInputManager: Partial<InputManager> = {
        getMouseState: () => Effect.succeed(mouseDelta),
      }

      const worldLayer = Layer.succeed(World, mockWorld as World)
      const inputManagerLayer = Layer.succeed(InputManager, mockInputManager as InputManager)
      const testLayer = worldLayer.pipe(Layer.provide(inputManagerLayer))

      const world = yield* _(World)
      const updateComponentSpy = vi.spyOn(world, 'updateComponent')

      yield* _(cameraControlSystem.pipe(Effect.provide(testLayer)))

      assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 0)
    }))
})