import { Option } from 'effect'
import type { GameModeService, GameStateService } from '@ts-minecraft/game'
import type { MultiplayerService } from '@ts-minecraft/app/application/multiplayer/multiplayer-service'

export type FrameGameplayServices = {
  readonly gameState: GameStateService
  readonly gameMode: GameModeService
  readonly multiplayer: Option.Option<MultiplayerService>
}
