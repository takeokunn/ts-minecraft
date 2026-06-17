import { Effect } from 'effect'
import { GameStateService, TimeService, WeatherService, GameLoopService, GameModeService } from '@ts-minecraft/game'
import type { GameMode } from '@ts-minecraft/game'

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

export const buildGameLoopService = Effect.gen(function* () {
  return yield* GameLoopService
})

export type { GameMode }
