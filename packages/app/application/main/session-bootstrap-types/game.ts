import type { GameStateService, TimeService, WeatherService, GameLoopService, GameModeService } from '@ts-minecraft/game'
import type { GameMode } from '@ts-minecraft/game'

export type SessionGameBootstrapServices = {
  readonly gameState: GameStateService
  readonly timeService: TimeService
  readonly weatherService: WeatherService
  readonly gameModeService: GameModeService
}

export type SessionBootstrapGameplayDeps = {
  readonly initialGameMode: GameMode
  readonly gameLoopService: GameLoopService
}
