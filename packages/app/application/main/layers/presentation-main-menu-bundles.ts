import { Layer } from 'effect'

import { DomOperationsService } from '@ts-minecraft/presentation'
import { MainMenuService } from '@ts-minecraft/presentation'
import { StorageService } from '@ts-minecraft/world'

import { ConfirmDialogLayer } from './presentation-confirm-dialog-bundles'

export const MainMenuLayer = MainMenuService.Default.pipe(
  Layer.provide(StorageService.Default),
  Layer.provide(DomOperationsService.Default),
  Layer.provide(ConfirmDialogLayer),
)
