import { Layer } from 'effect'

import { DomOperationsService } from '@ts-minecraft/presentation'
import { PauseMenuService } from '@ts-minecraft/presentation'

import { ConfirmDialogLayer } from './presentation-confirm-dialog-bundles'

export const PauseMenuLayer = PauseMenuService.Default.pipe(
  Layer.provide(DomOperationsService.Default),
  Layer.provide(ConfirmDialogLayer),
)
