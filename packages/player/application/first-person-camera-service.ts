import { Effect } from 'effect'
import type { CameraRotationPort } from '@ts-minecraft/kernel'
import { PlayerInputService } from './player-input-service'
import { PlayerCameraStateService } from '../domain/camera-state'

// At default sensitivity 0.5: 0.5 * 0.004 = 0.002 rad/px. At max 3.0: 0.012 rad/px.
export const BASE_MOUSE_SENSITIVITY = 0.004

export class FirstPersonCameraService extends Effect.Service<FirstPersonCameraService>()(
  '@minecraft/application/FirstPersonCameraService',
  {
    effect: Effect.all([PlayerInputService, PlayerCameraStateService], { concurrency: 'unbounded' }).pipe(
      Effect.map(([inputService, cameraState]) => ({
        // Only updates when pointer is locked (captured by the game).
        update: (camera: CameraRotationPort, sensitivity = 0.5): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            // Only update if pointer is locked
            const isLocked = yield* inputService.isPointerLocked()
            if (!isLocked) return

            // Get mouse delta
            const delta = yield* inputService.getMouseDelta()

            // Skip if no movement
            if (delta.x === 0 && delta.y === 0) return

            // Convert to radians: BASE_MOUSE_SENSITIVITY * sensitivity setting (0.1–3.0)
            // Negative for intuitive rotation (mouse right = look right)
            const radPerPx = BASE_MOUSE_SENSITIVITY * sensitivity
            const yawDelta = -delta.x * radPerPx
            const pitchDelta = -delta.y * radPerPx

            // Update camera state (pitch is automatically clamped)
            yield* cameraState.addYaw(yawDelta)
            yield* cameraState.addPitch(pitchDelta)

            // Apply to THREE.js camera
            const rotation = yield* cameraState.getRotation()

            // Set camera rotation using Euler angles with YXZ order
            // This ensures proper first-person rotation behavior
            yield* Effect.sync(() => { camera.rotation.set(rotation.pitch, rotation.yaw, 0, 'YXZ') })
          }),

        attachToPlayer: (camera: CameraRotationPort): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const rotation = yield* cameraState.getRotation()
            yield* Effect.sync(() => { camera.rotation.set(rotation.pitch, rotation.yaw, 0, 'YXZ') })
          }),
      })))
  }
) {}
export const FirstPersonCameraServiceLive = FirstPersonCameraService.Default
