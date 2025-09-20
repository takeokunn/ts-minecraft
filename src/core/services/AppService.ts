import { Context, Effect, Layer } from 'effect'

// Service定義
export interface AppService {
  readonly initialize: () => Effect.Effect<void>
  readonly getStatus: () => Effect.Effect<{ ready: boolean }>
}

export const AppService = Context.GenericTag<AppService>('@app/services/AppService')

// Service実装
export const AppServiceLive = Layer.succeed(
  AppService,
  AppService.of({
    initialize: () => Effect.succeed(undefined),
    getStatus: () => Effect.succeed({ ready: true }),
  })
)
