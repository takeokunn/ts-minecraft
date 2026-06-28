import { Layer } from 'effect'

import { DamageOverlayService, DomOperationsService } from '@ts-minecraft/presentation'

export const DamageOverlayPresentationLayer = DamageOverlayService.Default.pipe(
  Layer.provide(DomOperationsService.Default),
)
