import { Layer } from 'effect'

import { CrosshairService, DomOperationsService } from '@ts-minecraft/presentation'

export const CrosshairPresentationLayer = CrosshairService.Default.pipe(
  Layer.provide(DomOperationsService.Default),
)
