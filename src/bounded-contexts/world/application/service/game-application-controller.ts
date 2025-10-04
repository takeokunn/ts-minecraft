import { Effect, Layer } from 'effect'
import { GameApplication } from '@application/game-application'
import { createGameApplicationController } from './actions'

export const GameApplicationControllerLive = Layer.effect(
  GameApplication,
  Effect.gen(function* () {
    const { service } = yield* createGameApplicationController
    return service
  })
)

export const GameApplicationController = GameApplication
