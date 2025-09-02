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

  const { entities, cameraState } = yield* _(world.querySoA(playerQuery))
  const deltaPitch = -mouseDelta.dy * MOUSE_SENSITIVITY
  const deltaYaw = -mouseDelta.dx * MOUSE_SENSITIVITY

  for (let i = 0; i < entities.length; i++) {
    const currentPitch = cameraState.pitch[i]
    const currentYaw = cameraState.yaw[i]
    if (currentPitch === undefined || currentYaw === undefined) {
      continue
    }
    const newPitch = clampPitch(currentPitch + deltaPitch)
    const newYaw = currentYaw + deltaYaw
    cameraState.pitch[i] = newPitch
    cameraState.yaw[i] = newYaw
  }
})
