import { Layer } from 'effect'

import { DomOperationsService } from '@ts-minecraft/presentation'
import { LoadingScreenService } from '@ts-minecraft/presentation'

export const LoadingScreenLayer = LoadingScreenService.Default.pipe(
  Layer.provide(DomOperationsService.Default),
)
