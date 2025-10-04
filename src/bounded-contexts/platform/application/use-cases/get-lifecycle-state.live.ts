import { Effect, Layer } from 'effect'
import { GameApplicationController } from '@mc/bc-world/application/service/game-application-controller'
import { GetLifecycleState } from './get-lifecycle-state'

export const GetLifecycleStateLive = Layer.effect(
  GetLifecycleState,
  Effect.gen(function* () {
    const app = yield* GameApplicationController
    return GetLifecycleState.of({
      execute: app.getLifecycleState,
    })
  })
)
