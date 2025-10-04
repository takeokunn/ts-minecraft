import { Effect, Layer } from 'effect'
import { GameApplicationController } from '@mc/bc-world/application/service/game-application-controller'
import { ResumeGameApplication } from './resume'

export const ResumeGameApplicationLive = Layer.effect(
  ResumeGameApplication,
  Effect.gen(function* () {
    const app = yield* GameApplicationController
    return ResumeGameApplication.of({
      execute: app.resume,
    })
  })
)
