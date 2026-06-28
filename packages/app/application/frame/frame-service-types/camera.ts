import type { PlayerCameraStateService } from '@ts-minecraft/entity/application/camera-state'
import type { FirstPersonCameraService } from '@ts-minecraft/entity/application/first-person-camera-service'
import type { ThirdPersonCameraService } from '@ts-minecraft/entity/application/third-person-camera-service'
import type { InputService } from '@ts-minecraft/presentation'
import type { FrameInventoryServices } from './inventory'

export type FrameCameraServices = {
  readonly inputService: InputService
  readonly hotbarService: FrameInventoryServices['hotbarService']
  readonly playerCameraState: PlayerCameraStateService
  readonly firstPersonCamera: FirstPersonCameraService
  readonly thirdPersonCamera: ThirdPersonCameraService
}
