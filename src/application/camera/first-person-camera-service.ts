import { Effect } from 'effect'
import * as THREE from 'three'
import { InputService } from '../../presentation/input/input-service'
import { PlayerCameraState } from '../../domain/player-camera'

/**
 * Mouse sensitivity for camera rotation
 * Higher values = faster camera movement
 */
export const DEFAULT_MOUSE_SENSITIVITY = 0.002

/**
 * First-person camera service class
 *
 * Provides mouse look functionality for first-person camera control.
 * Integrates with InputService for mouse input and PlayerCameraState
 * for rotation state management.
 */
export class FirstPersonCameraService extends Effect.Service<FirstPersonCameraService>()(
  '@minecraft/layer/FirstPersonCameraService',
  {
    effect: Effect.gen(function* () {
      const inputService = yield* InputService
      const cameraState = yield* PlayerCameraState

      return {
        /**
         * Update camera rotation based on mouse movement
         * Only updates when pointer is locked (captured by the game)
         */
        update: (camera: THREE.PerspectiveCamera): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            // Only update if pointer is locked
            const isLocked = yield* inputService.isPointerLocked()
            if (!isLocked) return

            // Get mouse delta
            const delta = yield* inputService.getMouseDelta()

            // Skip if no movement
            if (delta.x === 0 && delta.y === 0) return

            // Convert to radians with sensitivity
            // Negative for intuitive rotation (mouse right = look right)
            const yawDelta = -delta.x * DEFAULT_MOUSE_SENSITIVITY
            const pitchDelta = -delta.y * DEFAULT_MOUSE_SENSITIVITY

            // Update camera state (pitch is automatically clamped)
            yield* cameraState.addYaw(yawDelta)
            yield* cameraState.addPitch(pitchDelta)

            // Apply to THREE.js camera
            const rotation = yield* cameraState.getRotation()

            // Set camera rotation using Euler angles with YXZ order
            // This ensures proper first-person rotation behavior
            camera.rotation.set(rotation.pitch, rotation.yaw, 0, 'YXZ')
          }),

        /**
         * Attach camera to player state (sync rotation from state to camera)
         * Used when initializing or resuming the game
         */
        attachToPlayer: (camera: THREE.PerspectiveCamera): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const rotation = yield* cameraState.getRotation()
            camera.rotation.set(rotation.pitch, rotation.yaw, 0, 'YXZ')
          }),
      }
    }),
  }
) {}
export { FirstPersonCameraService as FirstPersonCameraServiceLive }
