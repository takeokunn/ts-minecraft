import { Effect, Layer } from 'effect'
import { GameApplicationController } from '@mc/bc-world/application/service/game-application-controller'
import { InitializeGameApplication } from './initialize'

export const InitializeGameApplicationLive = Layer.effect(
  InitializeGameApplication,
  Effect.gen(function* () {
    const app = yield* GameApplicationController
    return InitializeGameApplication.of({
      execute: app.initialize,
    })
  })
)
