import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

export interface UIServiceInterface {
  readonly initialize: () => Effect.Effect<void, never, never>
  readonly render: () => Effect.Effect<void, never, never>
  readonly update: (deltaTime: number) => Effect.Effect<void, never, never>
  readonly dispose: () => Effect.Effect<void, never, never>
  readonly showHUD: (visible: boolean) => Effect.Effect<void, never, never>
  readonly updateHotbar: (items: any[]) => Effect.Effect<void, never, never>
  readonly showCrosshair: (visible: boolean) => Effect.Effect<void, never, never>
}

export class UIService extends Context.GenericTag('UIService')<
  UIService,
  UIServiceInterface
>() {}