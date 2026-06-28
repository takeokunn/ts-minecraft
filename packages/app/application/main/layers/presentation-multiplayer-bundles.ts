import { Layer } from 'effect'
import { ChatPanelService, DomOperationsService } from '@ts-minecraft/presentation'

export const MultiplayerChatPanelLayer = ChatPanelService.Default.pipe(
  Layer.provide(DomOperationsService.Default),
)
