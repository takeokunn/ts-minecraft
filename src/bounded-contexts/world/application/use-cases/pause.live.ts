import { Effect, Layer } from 'effect'
import { GameApplicationController } from '@mc/bc-world/application/service/game-application-controller'
import { PauseGameApplication } from './pause'

export const PauseGameApplicationLive = Layer.effect(
  PauseGameApplication,
  Effect.gen(function* () {
    const app = yield* GameApplicationController
    return PauseGameApplication.of({
      execute: app.pause,
    })
  })
)
