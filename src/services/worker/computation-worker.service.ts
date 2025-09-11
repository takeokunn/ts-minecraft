import { Context, Effect, Scope, Queue } from 'effect'
import { IncomingMessage, OutgoingMessage } from '@/workers/messages'

/**
 * ComputationWorker Service - Manages web worker for background computations
 */
export class ComputationWorker extends Context.Tag('ComputationWorker')<
  ComputationWorker,
  {
    readonly start: (scope: Scope.Scope) => Effect.Effect<void, never, never>
    readonly sendMessage: (message: OutgoingMessage) => Effect.Effect<void, never, never>
    readonly incomingMessages: Queue.Dequeue<IncomingMessage>
  }
>() {}