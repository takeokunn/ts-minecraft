import { Layer } from 'effect'

import { AchievementToastService, DamageOverlayService, DimensionFadeService, DomOperationsService, SleepOverlayService } from '@ts-minecraft/presentation'

export const DamageOverlayPresentationLayer = DamageOverlayService.Default.pipe(
  Layer.provide(DomOperationsService.Default),
)

export const SleepOverlayPresentationLayer = SleepOverlayService.Default.pipe(
  Layer.provide(DomOperationsService.Default),
)

export const AchievementToastPresentationLayer = AchievementToastService.Default.pipe(
  Layer.provide(DomOperationsService.Default),
)

export const DimensionFadePresentationLayer = DimensionFadeService.Default.pipe(
  Layer.provide(DomOperationsService.Default),
)
