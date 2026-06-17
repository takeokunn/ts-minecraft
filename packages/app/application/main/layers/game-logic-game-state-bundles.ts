import { Layer } from 'effect'

import { GameModeService, GameStateService } from '@ts-minecraft/game'
import { PlayerCameraStateService, PlayerService } from '@ts-minecraft/entity'

import { ChunkManagerLayer } from './game-logic-chunk-manager-bundles'
import { InventoryLayer } from './game-logic-inventory-support-bundles'
import { MovementLayer } from './game-logic-player-movement-bundles'
import { PlayerInputLayer } from './game-logic-player-input-bundles'
import { PhysicsLayer } from './infrastructure-bundles'

export const GameLayer = GameStateService.Default.pipe(
  Layer.provide(PlayerService.Default),
  Layer.provide(PhysicsLayer),
  Layer.provide(MovementLayer),
  Layer.provide(PlayerInputLayer),
  Layer.provide(PlayerCameraStateService.Default),
  Layer.provide(ChunkManagerLayer),
  Layer.provide(GameModeService.Default),
  Layer.provide(InventoryLayer),
)
