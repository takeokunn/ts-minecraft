import { Layer } from 'effect'

import { GameModeService } from '@ts-minecraft/game'
import { DeathScreenService } from '@ts-minecraft/presentation'
import { HealthService } from '@ts-minecraft/entity/application/health-service'
import { DomOperationsService } from '@ts-minecraft/presentation'

import { GameLayer } from './game-logic-game-state-bundles'
import { InventoryLayer } from './game-logic-inventory-support-bundles'

export const DeathScreenLayer = DeathScreenService.Default.pipe(
  Layer.provide(DomOperationsService.Default),
  Layer.provide(GameLayer),
  Layer.provide(GameModeService.Default),
  Layer.provide(HealthService.Default),
  Layer.provide(InventoryLayer),
)
