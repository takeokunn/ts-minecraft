import { Effect, Layer } from 'effect'
import { GameApplicationController } from '@mc/bc-world/application/service/game-application-controller'
import { HealthCheckGameApplication } from './health-check'

export const HealthCheckGameApplicationLive = Layer.effect(
  HealthCheckGameApplication,
  Effect.gen(function* () {
    const app = yield* GameApplicationController
    return HealthCheckGameApplication.of({
      execute: app.healthCheck,
    })
  })
)
