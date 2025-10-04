import { Effect, Layer } from 'effect'
import { GameApplicationController } from '@mc/bc-world/application/service/game-application-controller'
import { UpdateGameApplicationConfig } from './update-config'

export const UpdateGameApplicationConfigLive = Layer.effect(
  UpdateGameApplicationConfig,
  Effect.gen(function* () {
    const app = yield* GameApplicationController
    return UpdateGameApplicationConfig.of({
      execute: app.updateConfig,
    })
  })
)
