import { describe, it, vi, assert } from '@effect/vitest'
import { Effect, Layer, Ref } from 'effect'
import * as fc from 'effect/FastCheck'
import { cameraControlSystem } from '../camera-control'
import { InputManager, World } from '@/runtime/services'
import { toEntityId } from '@/domain/entity'
import { CameraState } from '@/domain/components'
import { clampPitch } from '@/domain/camera-logic'
import { SoAResult } from '@/domain/types'
import { playerQuery } from '@/domain/queries'
import { toFloat } from '@/domain/common'
import { arbitraryCameraState } from '@test/arbitraries'

const MOUSE_SENSITIVITY = 0.002

const arbitraryMouseDelta = fc.record({
  dx: fc.integer(),
  dy: fc.integer(),
})

describe('cameraControlSystem', () => {
  it.effect('should adhere to camera control properties', () =>
    Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(
          arbitraryMouseDelta,
          fc.array(arbitraryCameraState),
          async (mouseDelta, cameraStates) => {
            const entities = cameraStates.map((_, i) => toEntityId(i))
            const soa: SoAResult<typeof playerQuery.components> = {
              entities,
              components: {
                cameraState: cameraStates,
                position: [],
                velocity: [],
                player: [],
                inputState: [],
                hotbar: [],
                gravity: [],
                collider: [],
                target: [],
              },
            }

            const querySoaSpy = vi.fn(() => Effect.succeed(soa as any))
            const updateComponentSpy = vi.fn(() => Effect.succeed(undefined))

            const mockWorld: World = {
              querySoA: querySoaSpy,
              updateComponent: updateComponentSpy,
            } as unknown as World

            const mockInputManager: InputManager = {
              isLocked: Ref.unsafeMake(false),
              getState: () => Effect.succeed({} as any),
              getMouseState: () => Effect.succeed(mouseDelta),
            }

            const testLayer = Layer.succeed(World, mockWorld).pipe(
              Layer.provide(Layer.succeed(InputManager, mockInputManager)),
            )

            await Effect.runPromise(
              cameraControlSystem.pipe(Effect.provide(testLayer)),
            )

            if (mouseDelta.dx === 0 && mouseDelta.dy === 0) {
              assert.strictEqual(querySoaSpy.mock.calls.length, 0)
              assert.strictEqual(updateComponentSpy.mock.calls.length, 0)
            } else {
              if (entities.length > 0) {
                assert.strictEqual(querySoaSpy.mock.calls.length, 1)
              }
              assert.strictEqual(updateComponentSpy.mock.calls.length, entities.length)

              const deltaPitch = -mouseDelta.dy * MOUSE_SENSITIVITY
              const deltaYaw = -mouseDelta.dx * MOUSE_SENSITIVITY

              entities.forEach((entityId, i) => {
                const currentCameraState = cameraStates[i]
                const expectedPitch = clampPitch(toFloat(currentCameraState.pitch + deltaPitch))
                const expectedYaw = toFloat(currentCameraState.yaw + deltaYaw)
                assert.deepStrictEqual(
                  updateComponentSpy.mock.calls[i],
                  [entityId, 'cameraState', { pitch: expectedPitch, yaw: expectedYaw }],
                )
              })
            }
          },
        ),
      ),
    ))
})