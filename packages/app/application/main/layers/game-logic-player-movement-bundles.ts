import { Layer } from 'effect'

import { HealthService } from '@ts-minecraft/entity/application/health-service'
import { HungerService } from '@ts-minecraft/entity/application/hunger-service'
import { MovementService } from '@ts-minecraft/entity/application/movement-service'

import { PlayerInputLayer } from './game-logic-player-input-bundles'

export const MovementLayer = MovementService.Default.pipe(
  Layer.provide(PlayerInputLayer),
  Layer.provide(HungerService.Default),
  // Speed/Slowness status effects scale movement; .Default layers are
  // memoized, so this is the same HealthService instance the rest of the
  // session uses.
  Layer.provide(HealthService.Default),
)
