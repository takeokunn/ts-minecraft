import { Effect, Layer } from 'effect'
import { GameApplicationController } from '@mc/bc-world/application/service/game-application-controller'
import { StartGameApplication } from './start'

export const StartGameApplicationLive = Layer.effect(
  StartGameApplication,
  Effect.gen(function* () {
    const app = yield* GameApplicationController
    return StartGameApplication.of({
      execute: app.start,
    })
  })
)
