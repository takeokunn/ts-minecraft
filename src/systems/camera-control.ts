import { Effect } from 'effect'
import { clampPitch } from '@/domain/camera-logic'
import { setCameraState } from '@/domain/components'
import { playerQuery } from '@/domain/queries'
import { InputManagerService, System } from '@/runtime/loop'
import { World } from '@/runtime/world'

const MOUSE_SENSITIVITY = 0.002

export const cameraControlSystem: System = Effect.gen(function* () {
  const world = yield* World
  const inputManager = yield* InputManagerService
  const { dx, dy } = yield* inputManager.getMouseDelta

  if (dx === 0 && dy === 0) {
    return
  }

  const players = yield* world.query(playerQuery)
  const deltaPitch = -dy * MOUSE_SENSITIVITY
  const deltaYaw = -dx * MOUSE_SENSITIVITY

  yield* Effect.forEach(
    players,
    (player) => {
      const { entityId, cameraState } = player
      const newPitch = clampPitch(cameraState.pitch + deltaPitch)
      const newYaw = cameraState.yaw + deltaYaw
      const newCameraState = setCameraState(cameraState, {
        pitch: newPitch,
        yaw: newYaw,
      })
      return world.updateComponent(entityId, 'cameraState', newCameraState)
    },
    { discard: true },
  )
})