import { Layer, Effect } from 'effect'
import { GameApplication } from './game-application'
import {
  GameApplicationController,
  GameApplicationControllerLive,
} from '@mc/bc-world/application/service/game-application-controller'

export const GameApplicationLive = GameApplicationControllerLive

export const makeGameApplication = () =>
  Effect.gen(function* () {
    const controller = yield* GameApplicationController
    return controller
  })

export const GameApplicationFacade = Layer.effect(GameApplication, makeGameApplication)
