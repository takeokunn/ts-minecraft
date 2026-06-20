import { Effect } from 'effect'
import { GameStateService, TimeService, WeatherService, GameModeService } from '@ts-minecraft/game'

export const buildGameBootstrapServices = Effect.gen(function* () {
  const gameState = yield* GameStateService
  const timeService = yield* TimeService
  const weatherService = yield* WeatherService
  const gameModeService = yield* GameModeService

  return {
    gameState,
    timeService,
    weatherService,
    gameModeService,
  }
})
