import { Context, Effect, Layer } from 'effect'

// Service定義
export interface AppService {
  readonly initialize: () => Effect.Effect<{ success: boolean }>
  readonly getReadyStatus: () => Effect.Effect<{ ready: boolean }>
}

export const AppService = Context.GenericTag<AppService>('@app/services/AppService')

// Service実装
export const AppServiceLive = Layer.succeed(
    AppService,
    AppService.of({
    initialize: () => Effect.succeed({ success: true }),
    getReadyStatus: () => Effect.succeed({ ready: true }),
  })
)
