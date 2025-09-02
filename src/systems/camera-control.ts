import { Effect } from 'effect'
import { clampPitch } from '@/domain/camera-logic'
import { playerQuery } from '@/domain/queries'
import { InputManagerService } from '@/runtime/services'
import { World } from '@/runtime/world'

const MOUSE_SENSITIVITY = 0.002

export const cameraControlSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
  const inputManager = yield* _(InputManagerService)
  const mouseDelta = yield* _(inputManager.getMouseDelta)

  if (mouseDelta.dx === 0 && mouseDelta.dy === 0) {
    return
  }

  const players = yield* _(world.query(playerQuery))
  const deltaPitch = -mouseDelta.dy * MOUSE_SENSITIVITY
  const deltaYaw = -mouseDelta.dx * MOUSE_SENSITIVITY

  yield* _(
    Effect.forEach(
      players,
      (player) => {
        const { entityId, cameraState } = player
        const newPitch = clampPitch(cameraState.pitch + deltaPitch)
        const newYaw = cameraState.yaw + deltaYaw
        return world.updateComponent(entityId, 'cameraState', { ...cameraState, pitch: newPitch, yaw: newYaw })
      },
      { discard: true },
    ),
  )
})
