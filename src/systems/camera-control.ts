import { Effect } from 'effect'
import { clampPitch } from '@/domain/camera-logic'
import { playerQuery } from '@/domain/queries'
import { InputManagerService } from '@/runtime/services'
import * as World from '@/runtime/world-pure'

const MOUSE_SENSITIVITY = 0.002

export const cameraControlSystem = Effect.gen(function* ($) {
  const inputManager = yield* $(InputManagerService)
  const mouseDelta = yield* $(inputManager.getMouseDelta)

  if (mouseDelta.dx === 0 && mouseDelta.dy === 0) {
    return
  }

  const players = yield* $(World.query(playerQuery))

  const deltaPitch = -mouseDelta.dy * MOUSE_SENSITIVITY
  const deltaYaw = -mouseDelta.dx * MOUSE_SENSITIVITY

  yield* $(
    Effect.forEach(
      players,
      ({ entityId, cameraState }) => {
        const newPitch = clampPitch(cameraState.pitch + deltaPitch)
        const newYaw = cameraState.yaw + deltaYaw
        return World.updateComponent(entityId, 'cameraState', { pitch: newPitch, yaw: newYaw })
      },
      { discard: true, concurrency: 'unbounded' },
    ),
  )
})