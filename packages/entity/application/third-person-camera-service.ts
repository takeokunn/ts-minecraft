import { Effect } from 'effect'
import type { CameraTransformPort } from '@ts-minecraft/core'
import { PlayerCameraStateService } from './camera-state'
import type { Position } from '@ts-minecraft/core'

export class ThirdPersonCameraService extends Effect.Service<ThirdPersonCameraService>()(
  '@minecraft/application/ThirdPersonCameraService',
  {
    effect: Effect.map(PlayerCameraStateService, (cameraState) => ({
        update: (camera: CameraTransformPort, playerPos: Position, eyeLevelOffset = 0.7): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const rotation = yield* cameraState.getRotation()
            const distance = 4         // camera distance behind player in blocks
            const shoulderHeight = 1.5 // vertical offset above player eye level
            const yaw = rotation.yaw
            const pitch = rotation.pitch
            const cosPitch = Math.cos(pitch)
            const offsetX = Math.sin(yaw) * cosPitch * distance
            const offsetZ = Math.cos(yaw) * cosPitch * distance
            const offsetY = Math.sin(pitch) * distance + shoulderHeight

            yield* Effect.sync(() => {
              const eyeY = playerPos.y + eyeLevelOffset // eye sits eyeLevelOffset above the AABB center (playerPos.y)
              camera.position.set(playerPos.x - offsetX, eyeY + offsetY, playerPos.z - offsetZ)
              camera.lookAt(playerPos.x, eyeY, playerPos.z)
            })
          }),
    })),
  }
) {}

export const ThirdPersonCameraServiceLive = ThirdPersonCameraService.Default
