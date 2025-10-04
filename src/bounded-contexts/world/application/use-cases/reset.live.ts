import { Effect, Layer } from 'effect'
import { GameApplicationController } from '@mc/bc-world/application/service/game-application-controller'
import { ResetGameApplication } from './reset'

export const ResetGameApplicationLive = Layer.effect(
  ResetGameApplication,
  Effect.gen(function* () {
    const app = yield* GameApplicationController
    return ResetGameApplication.of({
      execute: app.reset,
    })
  })
)
