/**
 * System Communication Service - Effect-TS Implementation
 *
 * Converted from class-based implementation to functional Effect-TS service
 * Features:
 * - Event-driven system communication
 * - Message queuing and prioritization
 * - System dependency resolution
 * - Broadcast and unicast messaging
 * - Message filtering and routing
 * - Performance monitoring for communication overhead
 */

import { Effect, Context, Layer, Queue, Option, Ref, PubSub, Schema } from 'effect'
import { EntityId } from '@domain/entities'

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
  readonly sender: string // System ID
  readonly recipients: readonly string[] // System IDs, empty for broadcast
  readonly payload: any
  readonly timestamp: number
  readonly frameId: number
  readonly expirationTime?: number
  readonly metadata?: Record<string, any>
}

/**
 * Message handler function
 */
export type MessageHandler<T = any> = (message: SystemMessage<T>) => Effect.Effect<void, Error>

/**
 * Message filter function
 */
export type MessageFilter = (message: SystemMessage) => boolean

/**
 * Message subscription
 */
export interface MessageSubscription {
  readonly id: string
  readonly systemId: string
  readonly messageTypes: readonly SystemMessageType[]
  readonly handler: MessageHandler
  readonly filter: Option.Option<MessageFilter>
  readonly active: boolean
}

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
 * System communication hub configuration
 */
export interface CommunicationConfig {
  readonly maxQueueSize: number
  readonly maxMessageAge: number // milliseconds
  readonly enablePrioritization: boolean
  readonly enableMessageFiltering: boolean
  readonly enableBroadcast: boolean
  readonly maxConcurrentHandlers: number
  readonly enableDeadLetterQueue: boolean
  readonly enablePerformanceMonitoring: boolean
}

/**
 * Communication errors
 */
export class CommunicationError extends Schema.TaggedError<CommunicationError>()('CommunicationError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

/**
 * System Communication Service interface
 */
export interface SystemCommunicationService {
  readonly sendMessage: (
    type: SystemMessageType,
    payload: any,
    options: {
      sender: string
      recipients?: string[]
      priority?: MessagePriority
      metadata?: Record<string, any>
      expirationMs?: number
      frameId?: number
    },
  ) => Effect.Effect<void>
  readonly subscribe: (systemId: string, messageTypes: SystemMessageType[], handler: MessageHandler, filter?: MessageFilter) => Effect.Effect<string>
  readonly unsubscribe: (subscriptionId: string) => Effect.Effect<void>
  readonly processMessages: () => Effect.Effect<void>
  readonly getStats: () => Effect.Effect<CommunicationStats>
  readonly getDeadLetterQueue: () => Effect.Effect<readonly SystemMessage[]>
  readonly clearDeadLetterQueue: () => Effect.Effect<void>
}

/**
 * System Communication Service tag
 */
export const SystemCommunicationService = Context.GenericTag<SystemCommunicationService>('SystemCommunicationService')

/**
 * Default communication configuration
 */
export const defaultCommunicationConfig: CommunicationConfig = {
  maxQueueSize: 1000,
  maxMessageAge: 5000, // 5 seconds
  enablePrioritization: true,
  enableMessageFiltering: true,
  enableBroadcast: true,
  maxConcurrentHandlers: 8,
  enableDeadLetterQueue: true,
  enablePerformanceMonitoring: true,
}

/**
 * System Communication Service Live implementation
 */
export const SystemCommunicationServiceLive = (config: CommunicationConfig = defaultCommunicationConfig) =>
  Layer.effect(
    SystemCommunicationService,
    Effect.gen(function* () {
      const messageQueue = yield* Queue.unbounded<SystemMessage>()
      const subscriptionsRef = yield* Ref.make<Map<string, MessageSubscription[]>>(new Map())
      const deadLetterQueueRef = yield* Ref.make<SystemMessage[]>([])
      const statsRef = yield* Ref.make<CommunicationStats>({
        messagesSent: 0,
        messagesReceived: 0,
        messagesDropped: 0,
        averageLatency: 0,
        queueSize: 0,
        subscriptionCount: 0,
      })
      const latencyHistoryRef = yield* Ref.make<number[]>([])

      /**
       * Generate unique message ID
       */
      const generateMessageId = (): string => {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }

      /**
       * Generate unique subscription ID
       */
      const generateSubscriptionId = (): string => {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }

      /**
       * Drop old messages when queue is full
       */
      const dropOldMessages = Effect.gen(function* () {
        const messages: SystemMessage[] = []
        let message = yield* Queue.poll(messageQueue)

        while (Option.isSome(message)) {
          messages.push(message.value)
          message = yield* Queue.poll(messageQueue)
        }

        // Keep only high and immediate priority messages, drop others
        const importantMessages = messages.filter((msg) => msg.priority === 'immediate' || msg.priority === 'high')

        // Re-add important messages
        yield* Effect.forEach(importantMessages, (msg) => Queue.offer(messageQueue, msg), { concurrency: 'unbounded', discard: true })

        const droppedCount = messages.length - importantMessages.length
        yield* Ref.update(statsRef, (stats) => ({
          ...stats,
          messagesDropped: stats.messagesDropped + droppedCount,
        }))
      })

      /**
       * Deliver message to subscribers
       */
      const deliverMessage = (message: SystemMessage) =>
        Effect.gen(function* () {
          const startTime = Date.now()
          const subscriptions = yield* Ref.get(subscriptionsRef)
          const messageSubscriptions = subscriptions.get(message.type) || []

          // Filter subscriptions based on recipients
          const targetSubscriptions = message.recipients.length > 0 ? messageSubscriptions.filter((sub) => message.recipients.includes(sub.systemId)) : messageSubscriptions // Broadcast to all

          // Apply message filters
          const filteredSubscriptions = config.enableMessageFiltering
            ? targetSubscriptions.filter((sub) =>
                Option.match(sub.filter, {
                  onNone: () => true,
                  onSome: (filter) => filter(message),
                }),
              )
            : targetSubscriptions

          if (filteredSubscriptions.length === 0) {
            return // No subscribers
          }

          // Deliver to all subscribers
          const deliveryResults = yield* Effect.forEach(
            filteredSubscriptions,
            (subscription) =>
              Effect.gen(function* () {
                try {
                  yield* subscription.handler(message)
                  return { success: true, error: null }
                } catch (error) {
                  return { success: false, error: error instanceof Error ? error : new Error(String(error)) }
                }
              }),
            { concurrency: config.maxConcurrentHandlers },
          )

          // Handle delivery failures
          const failures = deliveryResults.filter((result) => !result.success)
          if (failures.length > 0 && config.enableDeadLetterQueue) {
            yield* Ref.update(deadLetterQueueRef, (queue) => [...queue, message])
          }

          // Update performance statistics
          if (config.enablePerformanceMonitoring) {
            const latency = Date.now() - startTime

            yield* Ref.update(latencyHistoryRef, (history) => {
              const updated = [...history, latency]
              // Keep only last 100 measurements
              return updated.length > 100 ? updated.slice(-100) : updated
            })

            const latencyHistory = yield* Ref.get(latencyHistoryRef)
            const averageLatency = latencyHistory.length > 0 ? latencyHistory.reduce((sum, lat) => sum + lat, 0) / latencyHistory.length : 0

            yield* Ref.update(statsRef, (stats) => ({
              ...stats,
              messagesReceived: stats.messagesReceived + deliveryResults.filter((r) => r.success).length,
              messagesDropped: stats.messagesDropped + failures.length,
              averageLatency,
            }))
          }
        })

      return SystemCommunicationService.of({
        sendMessage: (type, payload, options) =>
          Effect.gen(function* () {
            const message: SystemMessage = {
              id: generateMessageId(),
              type,
              priority: options.priority || 'normal',
              sender: options.sender,
              recipients: options.recipients || [], // Empty for broadcast
              payload,
              timestamp: Date.now(),
              frameId: options.frameId || 0,
              expirationTime: options.expirationMs ? Date.now() + options.expirationMs : undefined,
              metadata: options.metadata,
            }

            // Check queue size limit
            const currentSize = yield* Queue.size(messageQueue)
            if (currentSize >= config.maxQueueSize) {
              // Drop oldest low-priority messages
              yield* dropOldMessages
            }

            // Add to queue
            yield* Queue.offer(messageQueue, message)

            // Update statistics
            yield* Ref.update(statsRef, (stats) => ({
              ...stats,
              messagesSent: stats.messagesSent + 1,
              queueSize: currentSize + 1,
            }))
          }),

        subscribe: (systemId, messageTypes, handler, filter) =>
          Effect.gen(function* () {
            const subscriptionId = generateSubscriptionId()

            const subscription: MessageSubscription = {
              id: subscriptionId,
              systemId,
              messageTypes,
              handler,
              filter: filter ? Option.some(filter) : Option.none(),
              active: true,
            }

            // Add subscription for each message type
            yield* Ref.update(subscriptionsRef, (subscriptions) => {
              const updated = new Map(subscriptions)

              for (const messageType of messageTypes) {
                if (!updated.has(messageType)) {
                  updated.set(messageType, [])
                }
                updated.get(messageType)!.push(subscription)
              }

              return updated
            })

            yield* Ref.update(statsRef, (stats) => ({
              ...stats,
              subscriptionCount: stats.subscriptionCount + 1,
            }))

            return subscriptionId
          }),

        unsubscribe: (subscriptionId) =>
          Effect.gen(function* () {
            yield* Ref.update(subscriptionsRef, (subscriptions) => {
              const updated = new Map(subscriptions)
              let removed = false

              for (const [messageType, subs] of updated) {
                const filtered = subs.filter((sub) => sub.id !== subscriptionId)
                if (filtered.length < subs.length) {
                  updated.set(messageType, filtered)
                  removed = true
                }
              }

              return updated
            })

            // Update subscription count only if we actually removed something
            const subscriptions = yield* Ref.get(subscriptionsRef)
            let hasSubscription = false
            for (const subs of subscriptions.values()) {
              if (subs.some((sub) => sub.id === subscriptionId)) {
                hasSubscription = true
                break
              }
            }

            if (!hasSubscription) {
              yield* Ref.update(statsRef, (stats) => ({
                ...stats,
                subscriptionCount: Math.max(0, stats.subscriptionCount - 1),
              }))
            }
          }),

        processMessages: () =>
          Effect.gen(function* () {
            // Get all messages from queue
            const messages: SystemMessage[] = []
            let message = yield* Queue.poll(messageQueue)

            while (Option.isSome(message)) {
              messages.push(message.value)
              message = yield* Queue.poll(messageQueue)
            }

            if (messages.length === 0) return

            // Filter expired messages
            const now = Date.now()
            const validMessages = messages.filter((msg) => !msg.expirationTime || msg.expirationTime > now)

            const expiredCount = messages.length - validMessages.length
            if (expiredCount > 0) {
              yield* Ref.update(statsRef, (stats) => ({
                ...stats,
                messagesDropped: stats.messagesDropped + expiredCount,
              }))
            }

            // Sort by priority if enabled
            if (config.enablePrioritization) {
              validMessages.sort((a, b) => {
                const priorityOrder = { immediate: 0, high: 1, normal: 2, low: 3, background: 4 }
                return priorityOrder[a.priority] - priorityOrder[b.priority]
              })
            }

            // Process messages concurrently with limit
            yield* Effect.forEach(validMessages, (msg) => deliverMessage(msg), { concurrency: config.maxConcurrentHandlers, discard: true })

            // Update queue size
            const currentQueueSize = yield* Queue.size(messageQueue)
            yield* Ref.update(statsRef, (stats) => ({
              ...stats,
              queueSize: currentQueueSize,
            }))
          }),

        getStats: () => Ref.get(statsRef),

        getDeadLetterQueue: () => Ref.get(deadLetterQueueRef),

        clearDeadLetterQueue: () => Ref.set(deadLetterQueueRef, []),
      })
    }),
  )

/**
 * System communication utilities
 */
export const SystemCommunicationUtils = {
  /**
   * Create standard entity event message
   */
  createEntityMessage: (type: 'created' | 'destroyed' | 'updated', entityId: EntityId, sender: string, componentData?: any): Omit<SystemMessage, 'id' | 'timestamp'> => ({
    type: type === 'created' ? 'entity_created' : type === 'destroyed' ? 'entity_destroyed' : 'component_updated',
    priority: 'normal',
    sender,
    recipients: [],
    payload: { entityId, componentData },
    frameId: 0,
    metadata: { entityType: 'entity' },
  }),

  /**
   * Create component event message
   */
  createComponentMessage: (
    action: 'added' | 'removed' | 'updated',
    entityId: EntityId,
    componentName: string,
    componentData: any,
    sender: string,
  ): Omit<SystemMessage, 'id' | 'timestamp'> => ({
    type: action === 'added' ? 'component_added' : action === 'removed' ? 'component_removed' : 'component_updated',
    priority: 'normal',
    sender,
    recipients: [],
    payload: { entityId, componentName, componentData },
    frameId: 0,
    metadata: { component: componentName },
  }),

  /**
   * Create physics event message
   */
  createPhysicsMessage: (event: 'collision' | 'movement' | 'force_applied', entities: EntityId[], data: any, sender: string): Omit<SystemMessage, 'id' | 'timestamp'> => ({
    type: event === 'collision' ? 'collision_detected' : 'physics_updated',
    priority: 'high',
    sender,
    recipients: [],
    payload: { entities, eventType: event, data },
    frameId: 0,
    metadata: { physicsEvent: event },
  }),

  /**
   * Create message filter for entity-related messages
   */
  createEntityFilter:
    (entityId: EntityId): MessageFilter =>
    (message) => {
      return message.payload && message.payload.entityId === entityId
    },

  /**
   * Create message filter for priority filtering
   */
  createPriorityFilter: (minPriority: MessagePriority): MessageFilter => {
    const priorityOrder = { immediate: 0, high: 1, normal: 2, low: 3, background: 4 }
    const minLevel = priorityOrder[minPriority]

    return (message) => priorityOrder[message.priority] <= minLevel
  },
}

/**
 * Create system communication service with custom configuration
 */
export const createSystemCommunicationService = (config: Partial<CommunicationConfig> = {}) => SystemCommunicationServiceLive({ ...defaultCommunicationConfig, ...config })
