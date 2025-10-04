import { Effect, Layer } from 'effect'
import { GameApplicationController } from '@mc/bc-world/application/service/game-application-controller'
import { TickGameApplication } from './tick'

export const TickGameApplicationLive = Layer.effect(
  TickGameApplication,
  Effect.gen(function* () {
    const app = yield* GameApplicationController
    return TickGameApplication.of({
      execute: app.tick,
    })
  })
)
