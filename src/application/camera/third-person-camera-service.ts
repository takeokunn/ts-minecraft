import { Effect } from 'effect'
import * as THREE from 'three'
import { PlayerCameraStateService } from '@/application/camera/camera-state'
import type { Position } from '@/shared/kernel'

export class ThirdPersonCameraService extends Effect.Service<ThirdPersonCameraService>()(
  '@minecraft/application/ThirdPersonCameraService',
  {
    effect: Effect.map(PlayerCameraStateService, (cameraState) => ({
        update: (camera: THREE.PerspectiveCamera, playerPos: Position, eyeLevelOffset = 0.7): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const rotation = yield* cameraState.getRotation()
            const distance = 4
            const shoulderHeight = 1.5
            const yaw = rotation.yaw
            const pitch = rotation.pitch
            const offsetX = Math.sin(yaw) * Math.cos(pitch) * distance
            const offsetZ = Math.cos(yaw) * Math.cos(pitch) * distance
            const offsetY = Math.sin(pitch) * distance + shoulderHeight

            yield* Effect.sync(() => {
              const eyeY = playerPos.y + eyeLevelOffset
              camera.position.set(playerPos.x - offsetX, eyeY + offsetY, playerPos.z - offsetZ)
              camera.lookAt(playerPos.x, eyeY, playerPos.z)
            })
          }),
    })),
  }
) {}

export const ThirdPersonCameraServiceLive = ThirdPersonCameraService.Default
