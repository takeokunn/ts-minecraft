import type {
  FirstPersonCameraService,
  PlayerCameraStateService,
  ThirdPersonCameraService,
} from '@ts-minecraft/entity'
import type { InputService } from '@ts-minecraft/presentation'

export type FrameCameraServices = {
  readonly inputService: InputService
  readonly playerCameraState: PlayerCameraStateService
  readonly firstPersonCamera: FirstPersonCameraService
  readonly thirdPersonCamera: ThirdPersonCameraService
}
