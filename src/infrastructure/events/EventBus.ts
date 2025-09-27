import { Context, Effect, Layer } from 'effect'

/**
 * Simple Event Bus for publishing combat events
 */
export interface EventBusService {
  readonly publish: <T>(event: T) => Effect.Effect<void>
  readonly subscribe: <T>(
    handler: (event: T) => Effect.Effect<void>
  ) => Effect.Effect<{ close: () => Effect.Effect<void> }>
}

export const EventBus = Context.GenericTag<EventBusService>('@minecraft/infrastructure/EventBus')

// Default implementation
export const EventBusDefault = Layer.succeed(EventBus, {
  publish: () => Effect.succeed(undefined),
  subscribe: () =>
    Effect.succeed({
      close: () => Effect.succeed(undefined),
    }),
})
