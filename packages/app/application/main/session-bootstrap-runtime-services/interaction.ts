import type { SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types/services'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'

type SessionRuntimeInteractionServices = Pick<
  FrameHandlerServices,
  | 'blockHighlight'
  | 'crosshair'
  | 'damageOverlay'
  | 'inputService'
  | 'blockService'
  | 'hotbarService'
  | 'hotbarRenderer'
  | 'settingsOverlay'
  | 'pauseMenu'
  | 'playerListPanel'
>

export const buildSessionRuntimeInteractionServices = ({
  services,
}: {
  readonly services: SessionBootstrapServices
}): SessionRuntimeInteractionServices => ({
  blockHighlight: services.blockHighlight,
  crosshair: services.crosshair,
  damageOverlay: services.damageOverlay,
  inputService: services.inputService,
  blockService: services.blockService,
  hotbarService: services.hotbarService,
  hotbarRenderer: services.hotbarRenderer,
  settingsOverlay: services.settingsOverlay,
  pauseMenu: services.pauseMenu,
  playerListPanel: services.playerListPanel,
})
