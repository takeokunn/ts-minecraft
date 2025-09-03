import { Effect } from 'effect'
import * as ReadonlyArray from 'effect/ReadonlyArray'
import { clampPitch } from '@/domain/camera-logic'
import { playerQuery } from '@/domain/queries'
import { InputManager, World } from '@/runtime/services'
import { toFloat } from '@/domain/common'
import { CameraState } from '@/domain/components'

const MOUSE_SENSITIVITY = 0.002

export const cameraControlSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
  const inputManager = yield* _(InputManager)
  const mouseDelta = yield* _(inputManager.getMouseState())

  yield* _(
    Effect.when(
      mouseDelta.dx !== 0 || mouseDelta.dy !== 0,
      () => Effect.gen(function* (_) {
        const { entities, components } = yield* _(world.querySoA(playerQuery))
        const { cameraState } = components

        const deltaPitch = -mouseDelta.dy * MOUSE_SENSITIVITY
        const deltaYaw = -mouseDelta.dx * MOUSE_SENSITIVITY

        const players = ReadonlyArray.zip(entities, cameraState)

        yield* _(
          Effect.forEach(
            players,
            ([entityId, currentCameraState]) => {
              const newPitch = clampPitch(toFloat(currentCameraState.pitch + deltaPitch))
              const newYaw = toFloat(currentCameraState.yaw + deltaYaw)
              const newCameraState: CameraState = { pitch: newPitch, yaw: newYaw }
              return world.updateComponent(
                entityId,
                'cameraState',
                newCameraState,
              )
            },
            { concurrency: 'inherit', discard: true },
          ),
        )
      }),
    ),
  )
})
