import { Layer } from 'effect'

import { ControlsHintService, DomOperationsService } from '@ts-minecraft/presentation'

export const ControlsHintPresentationLayer = ControlsHintService.Default.pipe(
  Layer.provide(DomOperationsService.Default),
)
