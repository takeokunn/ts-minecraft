/**
 * System Communication - Next-Generation Inter-System Messaging
 * 
 * Features:
 * - Event-driven system communication
 * - Message queuing and prioritization
 * - System dependency resolution
 * - Broadcast and unicast messaging
 * - Message filtering and routing
 * - Performance monitoring for communication overhead
 */

import { Effect, Queue, Option } from 'effect'
import { SystemConfig, SystemContext } from './scheduler'
import { EntityId } from '@/core/entities/entity'

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
export type MessageHandler<T = any> = (message: SystemMessage<T>) => Effect.Effect<void, Error, never>

/**
 * Message filter function
 */
export type MessageFilter = (message: SystemMessage) => boolean

/**
 * Message route
 */
interface MessageRoute {
  readonly systemId: string
  readonly messageType: SystemMessageType
  readonly filter: Option.Option<MessageFilter>
  readonly priority: number
}

/**
 * Message subscription
 */
interface MessageSubscription {
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
interface CommunicationStats {
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
 * System Communication Hub
 */
export class SystemCommunicationHub {
  private messageQueue: Queue.Queue<SystemMessage> = Queue.unbounded()
  private subscriptions = new Map<string, MessageSubscription[]>()
  private routes = new Map<string, MessageRoute[]>()
  private deadLetterQueue: SystemMessage[] = []
  private stats: CommunicationStats = {
    messagesSent: 0,
    messagesReceived: 0,
    messagesDropped: 0,
    averageLatency: 0,
    queueSize: 0,
    subscriptionCount: 0,
  }
  private latencyHistory: number[] = []

  constructor(private config: CommunicationConfig) {}

  /**
   * Send message to specific systems or broadcast
   */
  sendMessage(
    type: SystemMessageType,
    payload: any,
    options: {
      sender: string
      recipients?: string[]
      priority?: MessagePriority
      metadata?: Record<string, any>
      expirationMs?: number
      frameId?: number
    }
  ): Effect.Effect<void, never, never> {
    return Effect.gen(this, function* ($) {
      const message: SystemMessage = {
        id: this.generateMessageId(),
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
      const currentSize = yield* $(Queue.size(this.messageQueue))
      if (currentSize >= this.config.maxQueueSize) {
        // Drop oldest low-priority messages
        yield* $(this.dropOldMessages())
      }

      // Add to queue
      yield* $(Queue.offer(this.messageQueue, message))
      
      // Update statistics
      this.stats = {
        ...this.stats,
        messagesSent: this.stats.messagesSent + 1,
        queueSize: currentSize + 1,
      }
    })
  }

  /**
   * Subscribe to messages
   */
  subscribe(
    systemId: string,
    messageTypes: SystemMessageType[],
    handler: MessageHandler,
    filter?: MessageFilter
  ): Effect.Effect<string, never, never> {
    return Effect.sync(() => {
      const subscriptionId = this.generateSubscriptionId()
      
      const subscription: MessageSubscription = {
        id: subscriptionId,
        systemId,
        messageTypes,
        handler,
        filter: filter ? Option.some(filter) : Option.none(),
        active: true,
      }

      // Add subscription for each message type
      for (const messageType of messageTypes) {
        if (!this.subscriptions.has(messageType)) {
          this.subscriptions.set(messageType, [])
        }
        this.subscriptions.get(messageType)!.push(subscription)
      }

      this.stats = {
        ...this.stats,
        subscriptionCount: this.stats.subscriptionCount + 1,
      }

      return subscriptionId
    })
  }

  /**
   * Unsubscribe from messages
   */
  unsubscribe(subscriptionId: string): Effect.Effect<void, never, never> {
    return Effect.sync(() => {
      for (const [messageType, subscriptions] of this.subscriptions) {
        const filtered = subscriptions.filter(sub => sub.id !== subscriptionId)
        if (filtered.length < subscriptions.length) {
          this.subscriptions.set(messageType, filtered)
          this.stats = {
            ...this.stats,
            subscriptionCount: Math.max(0, this.stats.subscriptionCount - 1),
          }
        }
      }
    })
  }

  /**
   * Process message queue
   */
  processMessages(): Effect.Effect<void, never, never> {
    return Effect.gen(this, function* ($) {
      // Get all messages from queue
      const messages: SystemMessage[] = []
      let message = yield* $(Queue.poll(this.messageQueue))
      
      while (Option.isSome(message)) {
        messages.push(message.value)
        message = yield* $(Queue.poll(this.messageQueue))
      }

      if (messages.length === 0) return

      // Filter expired messages
      const now = Date.now()
      const validMessages = messages.filter(msg => 
        !msg.expirationTime || msg.expirationTime > now
      )

      const expiredCount = messages.length - validMessages.length
      if (expiredCount > 0) {
        this.stats = {
          ...this.stats,
          messagesDropped: this.stats.messagesDropped + expiredCount,
        }
      }

      // Sort by priority if enabled
      if (this.config.enablePrioritization) {
        validMessages.sort((a, b) => {
          const priorityOrder = { immediate: 0, high: 1, normal: 2, low: 3, background: 4 }
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        })
      }

      // Process messages concurrently with limit
      yield* $(
        Effect.forEach(
          validMessages,
          (msg) => this.deliverMessage(msg),
          { concurrency: this.config.maxConcurrentHandlers, discard: true }
        )
      )

      // Update queue size
      this.stats = {
        ...this.stats,
        queueSize: yield* $(Queue.size(this.messageQueue)),
      }
    })
  }

  /**
   * Deliver message to subscribers
   */
  private deliverMessage(message: SystemMessage): Effect.Effect<void, never, never> {
    return Effect.gen(this, function* ($) {
      const startTime = Date.now()
      const subscriptions = this.subscriptions.get(message.type) || []
      
      // Filter subscriptions based on recipients
      const targetSubscriptions = message.recipients.length > 0
        ? subscriptions.filter(sub => message.recipients.includes(sub.systemId))
        : subscriptions // Broadcast to all

      // Apply message filters
      const filteredSubscriptions = this.config.enableMessageFiltering
        ? targetSubscriptions.filter(sub => 
            Option.match(sub.filter, {
              onNone: () => true,
              onSome: (filter) => filter(message),
            })
          )
        : targetSubscriptions

      if (filteredSubscriptions.length === 0) {
        return // No subscribers
      }

      // Deliver to all subscribers
      const deliveryResults = yield* $(
        Effect.forEach(
          filteredSubscriptions,
          (subscription) => Effect.gen(function* ($) {
            try {
              yield* $(subscription.handler(message))
              return { success: true, error: null }
            } catch (error) {
              return { success: false, error: error instanceof Error ? error : new Error(String(error)) }
            }
          }),
          { concurrency: this.config.maxConcurrentHandlers }
        )
      )

      // Handle delivery failures
      const failures = deliveryResults.filter(result => !result.success)
      if (failures.length > 0 && this.config.enableDeadLetterQueue) {
        this.deadLetterQueue.push(message)
      }

      // Update performance statistics
      if (this.config.enablePerformanceMonitoring) {
        const latency = Date.now() - startTime
        this.latencyHistory.push(latency)
        
        // Keep only last 100 measurements
        if (this.latencyHistory.length > 100) {
          this.latencyHistory.shift()
        }
        
        this.stats = {
          ...this.stats,
          messagesReceived: this.stats.messagesReceived + deliveryResults.filter(r => r.success).length,
          messagesDropped: this.stats.messagesDropped + failures.length,
          averageLatency: this.latencyHistory.reduce((sum, lat) => sum + lat, 0) / this.latencyHistory.length,
        }
      }
    })
  }

  /**
   * Drop old messages when queue is full
   */
  private dropOldMessages(): Effect.Effect<void, never, never> {
    return Effect.gen(this, function* ($) {
      const messages: SystemMessage[] = []
      let message = yield* $(Queue.poll(this.messageQueue))
      
      while (Option.isSome(message)) {
        messages.push(message.value)
        message = yield* $(Queue.poll(this.messageQueue))
      }

      // Keep only high and immediate priority messages, drop others
      const importantMessages = messages.filter(msg => 
        msg.priority === 'immediate' || msg.priority === 'high'
      )

      // Re-add important messages
      yield* $(
        Effect.forEach(
          importantMessages,
          (msg) => Queue.offer(this.messageQueue, msg),
          { concurrency: 'unbounded', discard: true }
        )
      )

      const droppedCount = messages.length - importantMessages.length
      this.stats = {
        ...this.stats,
        messagesDropped: this.stats.messagesDropped + droppedCount,
      }
    })
  }

  /**
   * Get communication statistics
   */
  getStats(): CommunicationStats {
    return { ...this.stats }
  }

  /**
   * Get dead letter queue messages
   */
  getDeadLetterQueue(): readonly SystemMessage[] {
    return [...this.deadLetterQueue]
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(): void {
    this.deadLetterQueue = []
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * Global communication hub instance
 */
export const globalCommunicationHub = new SystemCommunicationHub(defaultCommunicationConfig)

/**
 * System communication utilities
 */
export const SystemCommunicationUtils = {
  /**
   * Create standard entity event message
   */
  createEntityMessage: (
    type: 'created' | 'destroyed' | 'updated',
    entityId: EntityId,
    sender: string,
    componentData?: any
  ): Omit<SystemMessage, 'id' | 'timestamp'> => ({
    type: type === 'created' ? 'entity_created' : 
          type === 'destroyed' ? 'entity_destroyed' : 'component_updated',
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
    sender: string
  ): Omit<SystemMessage, 'id' | 'timestamp'> => ({
    type: action === 'added' ? 'component_added' : 
          action === 'removed' ? 'component_removed' : 'component_updated',
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
  createPhysicsMessage: (
    event: 'collision' | 'movement' | 'force_applied',
    entities: EntityId[],
    data: any,
    sender: string
  ): Omit<SystemMessage, 'id' | 'timestamp'> => ({
    type: event === 'collision' ? 'collision_detected' : 'physics_updated',
    priority: 'high',
    sender,
    recipients: [],
    payload: { entities, eventType: event, data },
    frameId: 0,
    metadata: { physicsEvent: event },
  }),

  /**
   * Create block event message
   */
  createBlockMessage: (
    action: 'placed' | 'destroyed',
    position: { x: number, y: number, z: number },
    blockType: string,
    playerId: EntityId,
    sender: string
  ): Omit<SystemMessage, 'id' | 'timestamp'> => ({
    type: action === 'placed' ? 'block_placed' : 'block_destroyed',
    priority: 'high',
    sender,
    recipients: [],
    payload: { position, blockType, playerId },
    frameId: 0,
    metadata: { blockAction: action },
  }),

  /**
   * Create input event message
   */
  createInputMessage: (
    inputType: string,
    inputData: any,
    playerId: EntityId,
    sender: string
  ): Omit<SystemMessage, 'id' | 'timestamp'> => ({
    type: 'input_received',
    priority: 'immediate',
    sender,
    recipients: [], // Broadcast to all systems that care about input
    payload: { inputType, inputData, playerId },
    frameId: 0,
    metadata: { inputSource: inputType },
  }),

  /**
   * Create message filter for entity-related messages
   */
  createEntityFilter: (entityId: EntityId): MessageFilter => (message) => {
    return message.payload && message.payload.entityId === entityId
  },

  /**
   * Create message filter for component-related messages
   */
  createComponentFilter: (componentName: string): MessageFilter => (message) => {
    return message.metadata && message.metadata.component === componentName
  },

  /**
   * Create message filter for priority filtering
   */
  createPriorityFilter: (minPriority: MessagePriority): MessageFilter => {
    const priorityOrder = { immediate: 0, high: 1, normal: 2, low: 3, background: 4 }
    const minLevel = priorityOrder[minPriority]
    
    return (message) => priorityOrder[message.priority] <= minLevel
  },

  /**
   * Create batched message sender for performance
   */
  createBatchSender: (hub: SystemCommunicationHub, batchSize = 10, intervalMs = 16) => {
    const messageBuffer: Omit<SystemMessage, 'id' | 'timestamp'>[] = []
    let timeoutId: NodeJS.Timeout | null = null

    const flushBuffer = () => {
      if (messageBuffer.length === 0) return

      const messages = [...messageBuffer]
      messageBuffer.length = 0

      // Send all messages
      messages.forEach(msg => {
        hub.sendMessage(msg.type, msg.payload, {
          sender: msg.sender,
          recipients: msg.recipients.length > 0 ? [...msg.recipients] : undefined,
          priority: msg.priority,
          metadata: msg.metadata,
        })
      })
    }

    return {
      queueMessage: (message: Omit<SystemMessage, 'id' | 'timestamp'>) => {
        messageBuffer.push(message)

        if (messageBuffer.length >= batchSize) {
          if (timeoutId) clearTimeout(timeoutId)
          flushBuffer()
        } else if (!timeoutId) {
          timeoutId = setTimeout(() => {
            timeoutId = null
            flushBuffer()
          }, intervalMs)
        }
      },
      flush: flushBuffer,
      getBufferSize: () => messageBuffer.length,
    }
  },
}

/**
 * System message decorators for automatic communication
 */
export const SystemMessageDecorators = {
  /**
   * Automatically send component update messages
   */
  withComponentUpdates: (
    systemId: string,
    hub: SystemCommunicationHub = globalCommunicationHub
  ) => {
    return (originalMethod: Function) => {
      return function (this: any, ...args: any[]) {
        const result = originalMethod.apply(this, args)
        
        // If the method updated components, send notification
        if (args.length >= 3) {
          const entityId = args[0]
          const componentName = args[1]
          const componentData = args[2]
          
          hub.sendMessage('component_updated', { entityId, componentName, componentData }, {
            sender: systemId,
            priority: 'normal',
          })
        }
        
        return result
      }
    }
  },

  /**
   * Automatically send entity lifecycle messages
   */
  withEntityLifecycle: (
    systemId: string,
    hub: SystemCommunicationHub = globalCommunicationHub
  ) => {
    return (originalMethod: Function) => {
      return function (this: any, ...args: any[]) {
        const result = originalMethod.apply(this, args)
        
        // Detect entity creation/destruction
        const methodName = originalMethod.name
        if (methodName.includes('create') || methodName.includes('add')) {
          hub.sendMessage('entity_created', { entityId: result }, {
            sender: systemId,
            priority: 'high',
          })
        } else if (methodName.includes('remove') || methodName.includes('destroy')) {
          hub.sendMessage('entity_destroyed', { entityId: args[0] }, {
            sender: systemId,
            priority: 'high',
          })
        }
        
        return result
      }
    }
  },
}