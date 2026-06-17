import type { SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types'
import type { FrameHandlerServices } from '@ts-minecraft/app/frame/types'

type SessionRuntimeInteractionServices = Pick<
  FrameHandlerServices,
  'blockHighlight' | 'inputService' | 'blockService' | 'hotbarService' | 'hotbarRenderer' | 'settingsOverlay' | 'pauseMenu'
>

export const buildSessionRuntimeInteractionServices = ({
  services,
}: {
  readonly services: SessionBootstrapServices
}): SessionRuntimeInteractionServices => ({
  blockHighlight: services.blockHighlight,
  inputService: services.inputService,
  blockService: services.blockService,
  hotbarService: services.hotbarService,
  hotbarRenderer: services.hotbarRenderer,
  settingsOverlay: services.settingsOverlay,
  pauseMenu: services.pauseMenu,
})
