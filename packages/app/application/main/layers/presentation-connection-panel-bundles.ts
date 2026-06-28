import { Layer } from 'effect'

import {
  ChatPanelService,
  ConnectionPanelService,
  DomOperationsService,
  PlayerListPanelService,
} from '@ts-minecraft/presentation'

export const ConnectionPanelLayer = Layer.mergeAll(
  ConnectionPanelService.Default,
  ChatPanelService.Default,
  PlayerListPanelService.Default,
).pipe(
  Layer.provide(DomOperationsService.Default),
)
