import { Layer } from 'effect'

import { DomOperationsService } from '@ts-minecraft/presentation'
import { ConfirmDialogService } from '@ts-minecraft/presentation'

export const ConfirmDialogLayer = ConfirmDialogService.Default.pipe(
  Layer.provide(DomOperationsService.Default),
)
