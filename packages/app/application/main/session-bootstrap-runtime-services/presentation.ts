import type { SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types/services'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'

type SessionRuntimePresentationServices = Pick<FrameHandlerServices, 'chatPanel'>

export const buildSessionRuntimePresentationServices = ({
  services,
}: {
  readonly services: SessionBootstrapServices
}): SessionRuntimePresentationServices => ({
  chatPanel: services.chatPanel,
})
