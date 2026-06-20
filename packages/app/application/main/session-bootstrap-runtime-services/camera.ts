import type { SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types/services'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'

type SessionRuntimeCameraServices = Pick<
  FrameHandlerServices,
  'playerCameraState' | 'firstPersonCamera' | 'thirdPersonCamera'
>

export const buildSessionRuntimeCameraServices = ({
  services,
}: {
  readonly services: SessionBootstrapServices
}): SessionRuntimeCameraServices => ({
  playerCameraState: services.playerCameraState,
  firstPersonCamera: services.firstPersonCamera,
  thirdPersonCamera: services.thirdPersonCamera,
})
