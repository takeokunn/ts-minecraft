import { Layer } from 'effect'

import { DomOperationsService } from '@ts-minecraft/presentation'
import { PauseMenuService } from '@ts-minecraft/presentation'

import { ConfirmDialogLayer } from './presentation-confirm-dialog-bundles'
import { SettingsOverlayLayer } from './presentation-overlay-settings-bundles'

export const PauseMenuLayer = PauseMenuService.Default.pipe(
  Layer.provide(DomOperationsService.Default),
  Layer.provide(SettingsOverlayLayer),
  Layer.provide(ConfirmDialogLayer),
)
