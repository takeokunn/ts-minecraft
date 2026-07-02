import { Layer } from 'effect'

import { DamageOverlayService, DomOperationsService, SleepOverlayService } from '@ts-minecraft/presentation'

export const DamageOverlayPresentationLayer = DamageOverlayService.Default.pipe(
  Layer.provide(DomOperationsService.Default),
)

export const SleepOverlayPresentationLayer = SleepOverlayService.Default.pipe(
  Layer.provide(DomOperationsService.Default),
)
