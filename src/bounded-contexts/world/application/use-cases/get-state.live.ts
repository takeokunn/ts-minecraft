import { Effect, Layer } from 'effect'
import { GameApplicationController } from '@mc/bc-world/application/service/game-application-controller'
import { GetGameApplicationState } from './get-state'

export const GetGameApplicationStateLive = Layer.effect(
  GetGameApplicationState,
  Effect.gen(function* () {
    const app = yield* GameApplicationController
    return GetGameApplicationState.of({
      execute: app.getState,
    })
  })
)
