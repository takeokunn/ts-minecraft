import { Layer } from 'effect'

import { HungerService } from '@ts-minecraft/entity/application/hunger-service'
import { MovementService } from '@ts-minecraft/entity/application/movement-service'

import { PlayerInputLayer } from './game-logic-player-input-bundles'

export const MovementLayer = MovementService.Default.pipe(
  Layer.provide(PlayerInputLayer),
  Layer.provide(HungerService.Default),
)
