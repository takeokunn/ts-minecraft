import { Effect, Layer } from 'effect'
import { EventBus } from './event-bus'

/**
 * Default EventBus implementation
 */
export const EventBusDefault = Layer.succeed(EventBus, {
  publish: () => Effect.succeed(undefined),
  subscribe: () =>
    Effect.succeed({
      close: () => Effect.succeed(undefined),
    }),
})
