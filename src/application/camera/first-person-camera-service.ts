import { Effect } from 'effect'
import type { CameraRotationPort } from '@/shared/math/three'
import { PlayerInputService } from '@/application/input/player-input-service'
import { PlayerCameraStateService } from '@/application/camera/camera-state'

/**
 * Base sensitivity constant — multiplied by the mouseSensitivity setting.
 * At the default setting of 0.5: 0.5 * 0.004 = 0.002 rad/px (was the previous hardcoded value).
 * At setting 1.0: 0.004 rad/px. At max 3.0: 0.012 rad/px.
 */
export const BASE_MOUSE_SENSITIVITY = 0.004

/**
 * First-person camera service class
 *
 * Provides mouse look functionality for first-person camera control.
 * Integrates with InputService for mouse input and PlayerCameraState
 * for rotation state management.
 */
export class FirstPersonCameraService extends Effect.Service<FirstPersonCameraService>()(
  '@minecraft/application/FirstPersonCameraService',
  {
    effect: Effect.all([PlayerInputService, PlayerCameraStateService], { concurrency: 'unbounded' }).pipe(
      Effect.map(([inputService, cameraState]) => ({
        /**
         * Update camera rotation based on mouse movement
         * Only updates when pointer is locked (captured by the game)
         */
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

        /**
         * Attach camera to player state (sync rotation from state to camera)
         * Used when initializing or resuming the game
         */
        attachToPlayer: (camera: CameraRotationPort): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const rotation = yield* cameraState.getRotation()
            yield* Effect.sync(() => { camera.rotation.set(rotation.pitch, rotation.yaw, 0, 'YXZ') })
          }),
      })))
  }
) {}
export const FirstPersonCameraServiceLive = FirstPersonCameraService.Default
