import { Layer } from 'effect'

import { HungerService, MovementService } from '@ts-minecraft/entity'

import { PlayerInputLayer } from './game-logic-player-input-bundles'

export const MovementLayer = MovementService.Default.pipe(
  Layer.provide(PlayerInputLayer),
  Layer.provide(HungerService.Default),
)
