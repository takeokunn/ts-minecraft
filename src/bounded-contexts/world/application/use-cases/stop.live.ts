import { Effect, Layer } from 'effect'
import { GameApplicationController } from '@mc/bc-world/application/service/game-application-controller'
import { StopGameApplication } from './stop'

export const StopGameApplicationLive = Layer.effect(
  StopGameApplication,
  Effect.gen(function* () {
    const app = yield* GameApplicationController
    return StopGameApplication.of({
      execute: app.stop,
    })
  })
)
