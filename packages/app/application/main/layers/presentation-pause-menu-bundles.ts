import { Layer } from 'effect'

import { DomOperationsService } from '@ts-minecraft/presentation'
import { PauseMenuService } from '@ts-minecraft/presentation'

import { AchievementService } from '@ts-minecraft/entity/application/achievement-service'
import { StatisticsService } from '@ts-minecraft/entity/application/statistics-service'

import { ConfirmDialogLayer } from './presentation-confirm-dialog-bundles'

export const PauseMenuLayer = PauseMenuService.Default.pipe(
  Layer.provide(DomOperationsService.Default),
  Layer.provide(ConfirmDialogLayer),
  Layer.provide(AchievementService.Default),
  Layer.provide(StatisticsService.Default),
)
