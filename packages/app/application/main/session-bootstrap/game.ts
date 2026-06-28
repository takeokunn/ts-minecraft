import { Effect } from 'effect'
import { GameStateService, TimeService, WeatherService, GameModeService } from '@ts-minecraft/game'

export const buildGameBootstrapServices = Effect.gen(function* () {
  const [gameState, timeService, weatherService, gameModeService] = yield* Effect.all([
    GameStateService,
    TimeService,
    WeatherService,
    GameModeService,
  ], { concurrency: 'unbounded' })

  return {
    gameState,
    timeService,
    weatherService,
    gameModeService,
  }
})
