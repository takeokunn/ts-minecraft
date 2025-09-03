import { Effect } from 'effect'
import { clampPitch } from '@/domain/camera-logic'
import { CameraState } from '@/domain/components'
import { playerQuery } from '@/domain/queries'
import { InputManager, World } from '@/runtime/services'
import { Float } from '@/domain/common'

const MOUSE_SENSITIVITY = 0.002

export const cameraControlSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
  const inputManager = yield* _(InputManager)
  const mouseDelta = yield* _(inputManager.getMouseState())

  if (mouseDelta.dx === 0 && mouseDelta.dy === 0) {
    return
  }

  const { entities, components } = yield* _(world.querySoA(playerQuery))
  const { cameraState } = components

  const deltaPitch = -mouseDelta.dy * MOUSE_SENSITIVITY
  const deltaYaw = -mouseDelta.dx * MOUSE_SENSITIVITY

  yield* _(
    Effect.forEach(
      entities,
      (entityId, i) => {
        const currentCameraState = cameraState[i]
        const newPitch = clampPitch(Float(currentCameraState.pitch + deltaPitch))
        const newYaw = Float(currentCameraState.yaw + deltaYaw)
        return world.updateComponent(entityId, 'cameraState', new CameraState({ pitch: newPitch, yaw: newYaw }))
      },
      { concurrency: 'inherit' },
    ),
  )
})
