import { Context, Effect } from 'effect'

/**
 * Simple Event Bus for publishing combat events
 */
export interface EventBus {
  readonly publish: <T>(event: T) => Effect.Effect<void>
  readonly subscribe: <T>(
    handler: (event: T) => Effect.Effect<void>
  ) => Effect.Effect<{ close: () => Effect.Effect<void> }>
}

export const EventBus = Context.GenericTag<EventBus>('@minecraft/EventBus')

// Default implementation
export namespace EventBus {
  export const Default = import('effect/Layer').then(({ Layer }) =>
    Layer.succeed(
      EventBus,
      EventBus.of({
        publish: () => Effect.succeed(undefined),
        subscribe: () =>
          Effect.succeed({
            close: () => Effect.succeed(undefined),
          }),
      })
    )
  )
}