/**
 * System Communication Port - Domain Layer Interface
 *
 * This port defines the interface for system communication services
 * following the DDD hexagonal architecture pattern.
 * The application layer depends on this port, and infrastructure
 * adapters implement it.
 */

import { Effect, Context } from 'effect'

/**
 * System message type
 */
export type SystemMessageType =
  | 'entity_created'
  | 'entity_destroyed'
  | 'component_added'
  | 'component_removed'
  | 'component_updated'
  | 'collision_detected'
  | 'block_placed'
  | 'block_destroyed'
  | 'chunk_loaded'
  | 'chunk_unloaded'
  | 'player_moved'
  | 'input_received'
  | 'physics_updated'
  | 'render_complete'
  | 'custom'

/**
 * System message priority
 */
export type MessagePriority = 'immediate' | 'high' | 'normal' | 'low' | 'background'

/**
 * System message
 */
export interface SystemMessage {
  readonly id: string
  readonly type: SystemMessageType
  readonly priority: MessagePriority
  readonly sender: string
  readonly recipients: readonly string[]
  readonly payload: unknown
  readonly timestamp: number
  readonly frameId: number
  readonly expirationTime?: number
  readonly metadata?: Record<string, unknown>
}

/**
 * Message handler function
 */
export type MessageHandler<T = unknown> = (message: SystemMessage<T>) => Effect.Effect<void, Error>

/**
 * Message filter function
 */
export type MessageFilter = (message: SystemMessage) => boolean

/**
 * Communication statistics
 */
export interface CommunicationStats {
  readonly messagesSent: number
  readonly messagesReceived: number
  readonly messagesDropped: number
  readonly averageLatency: number
  readonly queueSize: number
  readonly subscriptionCount: number
}

/**
 * System Communication Port interface
 *
 * This is the domain-level abstraction for system communication.
 * Infrastructure adapters implement this interface.
 */
export interface SystemCommunicationPort {
  readonly sendMessage: (
    type: SystemMessageType,
    payload: unknown,
    options: {
      sender: string
      recipients?: string[]
      priority?: MessagePriority
      metadata?: Record<string, unknown>
      expirationMs?: number
      frameId?: number
    },
  ) => Effect.Effect<void>
  readonly subscribe: (systemId: string, messageTypes: SystemMessageType[], handler: MessageHandler, filter?: MessageFilter) => Effect.Effect<string>
  readonly unsubscribe: (subscriptionId: string) => Effect.Effect<void>
  readonly processMessages: () => Effect.Effect<void>
  readonly getStats: () => Effect.Effect<CommunicationStats>
}

/**
 * System Communication Port tag
 */
export const SystemCommunicationPort = Context.GenericTag<SystemCommunicationPort>('SystemCommunicationPort')
