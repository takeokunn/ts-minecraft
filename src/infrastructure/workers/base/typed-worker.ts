import { Effect, Queue, Ref, Duration } from 'effect'
import * as S from '@effect/schema/Schema'
import {
  WorkerMessageSchemas,
  MessageId,
  WorkerId,
  Timestamp,
  createMessageId,
  createWorkerId,
  WorkerCapabilities,
  WorkerReady,
  WorkerError,
  createWorkerMessageSchemas,
  extractTransferables,
  createMessageWithTransferables,
  encodeMessage,
  decodeMessage,
  type SharedBufferDescriptor,
  createTypedArrayView,
} from '@infrastructure/workers/schemas/worker-messages.schema'

/**
 * Advanced typed worker system with complete schema validation
 * Full integration with @effect/schema for type safety
 */

// ============================================
// Worker Capabilities Detection
// ============================================

/**
 * Detect worker capabilities with complete validation
 */
export const detectWorkerCapabilities = (): WorkerCapabilities => ({
  supportsSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
  supportsTransferableObjects: typeof ArrayBuffer !== 'undefined',
  supportsWasm: typeof WebAssembly !== 'undefined',
  supportsWebGL: typeof WebGLRenderingContext !== 'undefined',
  supportsOffscreenCanvas: typeof OffscreenCanvas !== 'undefined',
  supportsStreaming: typeof ReadableStream !== 'undefined',
  maxMemory: 100 * 1024 * 1024, // 100MB default
  maxConcurrentRequests: 4,
  supportedOperations: ['basic'], // Will be overridden by specific workers
  threadCount: navigator?.hardwareConcurrency || 4,
  version: '1.0.0',
})

// ============================================
// Enhanced Message Validation and Encoding
// ============================================

/**
 * Validate message against schema with full error handling
 */
export const validateMessage = <T extends S.Schema<any, any, any>>(
  schema: T, 
  message: unknown
) => S.decodeUnknown(schema)(message)

/**
 * Enhanced message encoding with validation
 */
export const encodeWorkerMessage = <T extends S.Schema<any, any, any>>(
  schema: T, 
  data: S.Schema.Type<T>
): Effect.Effect<{
  encodedMessage: S.Schema.Type<T>
  transferables: Transferable[]
  isValid: boolean
}, never, never> =>
  Effect.gen(function* () {
    try {
      // Validate the message structure first
      const validation = yield* Effect.try(() => S.decodeUnknown(schema)(data))
      
      // Extract transferables from validated data
      const transferables = extractTransferables(data)
      
      return {
        encodedMessage: data,
        transferables,
        isValid: true
      }
    } catch (error) {
      console.error('Message encoding failed:', error)
      return {
        encodedMessage: data,
        transferables: [],
        isValid: false
      }
    }
  })

// ============================================
// Enhanced SharedArrayBuffer Support
// ============================================

/**
 * Create shared buffer with validation
 */
export const createSharedBuffer = (descriptor: SharedBufferDescriptor): SharedArrayBuffer => {
  const elementSize = getElementSize(descriptor.type)
  const buffer = new SharedArrayBuffer(descriptor.size * elementSize)
  return buffer
}

/**
 * Get element size for typed arrays with complete type support
 */
const getElementSize = (type: SharedBufferDescriptor['type']): number => {
  switch (type) {
    case 'Int8':
    case 'Uint8':
      return 1
    case 'Int16':
    case 'Uint16':
      return 2
    case 'Int32':
    case 'Uint32':
    case 'Float32':
      return 4
    case 'Float64':
      return 8
    default:
      throw new Error(`Unsupported array type: ${type}`)
  }
}

/**
 * Validate shared buffer descriptor
 */
export const validateSharedBufferDescriptor = (descriptor: unknown) =>
  S.decodeUnknown(WorkerMessageSchemas.SharedBufferDescriptor)(descriptor)

// ============================================
// Enhanced Worker Handler Types
// ============================================

/**
 * Enhanced context provided to worker handlers
 */
export interface WorkerHandlerContext {
  messageId: MessageId
  workerId?: WorkerId
  timestamp: Timestamp
  sharedBuffers?: Map<string, SharedArrayBuffer>
  capabilities: WorkerCapabilities
  priority?: WorkerMessageSchemas.MessagePriority
  options?: {
    enableProfiling?: boolean
    returnProgress?: boolean
    streaming?: boolean
  }
}

/**
 * Worker handler function type with full schema support
 */
export type WorkerHandler<TInput, TOutput> = (
  input: TInput, 
  context: WorkerHandlerContext
) => Effect.Effect<TOutput, WorkerError, never>

/**
 * Enhanced worker configuration with schema validation
 */
export interface TypedWorkerConfig<
  TInput extends S.Schema<any, any, any>, 
  TOutput extends S.Schema<any, any, any>
> {
  workerType: string
  name: string
  inputSchema: TInput
  outputSchema: TOutput
  handler: WorkerHandler<S.Schema.Type<TInput>, S.Schema.Type<TOutput>>
  sharedBuffers?: SharedBufferDescriptor[]
  timeout?: Duration.Duration
  supportedOperations?: string[]
  maxConcurrentRequests?: number
}

// ============================================
// Enhanced Worker Client Configuration
// ============================================

/**
 * Enhanced worker client configuration with full schema support
 */
export interface WorkerClientConfig<
  TInput extends S.Schema<any, any, any>,
  TOutput extends S.Schema<any, any, any>
> {
  workerType: string
  inputSchema: TInput
  outputSchema: TOutput
  timeout?: Duration.Duration
  maxConcurrentRequests?: number
  enableValidation?: boolean
  enableProfiling?: boolean
  retryPolicy?: {
    maxRetries: number
    backoffMs: number
    exponentialBackoff: boolean
  }
}

// ============================================
// Enhanced Request Tracking
// ============================================

/**
 * Enhanced pending request tracking with full type safety
 */
interface PendingRequest<TOutput> {
  messageId: MessageId
  resolve: (value: TOutput) => void
  reject: (error: WorkerError) => void
  timestamp: Timestamp
  timeout?: NodeJS.Timeout
  priority?: WorkerMessageSchemas.MessagePriority
  retryCount?: number
  metadata?: {
    requestType: string
    startTime: number
    lastAttempt: number
  }
}

// ============================================
// Enhanced Worker Client Implementation
// ============================================

/**
 * Create a typed worker factory with full schema validation
 */
export const createWorkerFactory = <
  TInput extends S.Schema<any, any, any>,
  TOutput extends S.Schema<any, any, any>
>(config: TypedWorkerConfig<TInput, TOutput>) => {
  const messageSchemas = createWorkerMessageSchemas(config.workerType, config.inputSchema, config.outputSchema)
  
  return {
    create: () => new Worker(new URL(config.name, import.meta.url), { type: 'module' }),
    config,
    schemas: messageSchemas,
  }
}

/**
 * Create a typed worker instance with complete schema validation
 */
export const createTypedWorker = <
  TInput extends S.Schema<any, any, any>,
  TOutput extends S.Schema<any, any, any>
>(config: TypedWorkerConfig<TInput, TOutput>) => {
  return Effect.gen(function* () {
    const capabilities = detectWorkerCapabilities()
    const workerId = createWorkerId(config.workerType) as WorkerId
    const messageSchemas = createWorkerMessageSchemas(config.workerType, config.inputSchema, config.outputSchema)

    // Override capabilities with worker-specific operations
    capabilities.supportedOperations = config.supportedOperations || ['basic']
    capabilities.maxConcurrentRequests = config.maxConcurrentRequests || 4

    // Send ready signal with full schema validation
    const readyMessage: WorkerReady = {
      type: 'ready',
      workerId,
      timestamp: Date.now() as Timestamp,
      capabilities,
    }

    self.postMessage(readyMessage)

    // Enhanced message handling with complete validation
    const handleMessage = (event: MessageEvent) => {
      Effect.runPromise(
        Effect.gen(function* () {
          try {
            // Validate incoming message structure
            const validatedMessage = yield* Effect.try(() => 
              messageSchemas.validateRequest(event.data)
            )

            if (validatedMessage.type === 'request') {
              const context: WorkerHandlerContext = {
                messageId: validatedMessage.id,
                workerId,
                timestamp: validatedMessage.timestamp,
                capabilities,
                priority: validatedMessage.priority,
                options: validatedMessage.options,
              }

              // Set up shared buffers if provided
              if (validatedMessage.sharedBuffers) {
                context.sharedBuffers = new Map()
                for (const [name, buffer] of Object.entries(validatedMessage.sharedBuffers)) {
                  if (buffer instanceof SharedArrayBuffer) {
                    context.sharedBuffers.set(name, buffer)
                  }
                }
              }

              // Execute handler with timeout
              const result = yield* config.handler(validatedMessage.payload, context).pipe(
                Effect.timeout(config.timeout || Duration.seconds(30)),
                Effect.catchAll((handlerError) => {
                  // Create properly structured error
                  const errorMessage = messageSchemas.createError(
                    validatedMessage.id,
                    handlerError instanceof Error ? handlerError : new Error(String(handlerError)),
                    { workerId, timestamp: Date.now() as Timestamp }
                  )
                  self.postMessage(errorMessage)
                  return Effect.fail(handlerError)
                })
              )

              // Create and validate response
              const responseMessage = messageSchemas.createResponse(
                validatedMessage.id,
                result,
                true,
                { workerId, timestamp: Date.now() as Timestamp }
              )

              // Extract transferables and send response
              const { transferables } = createMessageWithTransferables(responseMessage)
              
              if (transferables.length > 0) {
                self.postMessage(responseMessage, { transfer: transferables })
              } else {
                self.postMessage(responseMessage)
              }
            }

          } catch (error) {
            // Handle validation errors
            console.error('Worker message validation failed:', error)
            
            const errorResponse: WorkerError = {
              id: createMessageId(),
              type: 'error',
              messageType: config.workerType,
              timestamp: Date.now() as Timestamp,
              workerId,
              error: {
                name: 'ValidationError',
                message: `Message validation failed: ${error instanceof Error ? error.message : String(error)}`,
                stack: error instanceof Error ? error.stack : undefined,
              },
            }
            
            self.postMessage(errorResponse)
          }
        })
      )
    }

    self.onmessage = handleMessage

    return { 
      capabilities, 
      workerId,
      messageSchemas 
    }
  })
}

/**
 * Create a typed worker client with complete schema validation
 */
export const createTypedWorkerClient = <
  TInput extends S.Schema<any, any, any>,
  TOutput extends S.Schema<any, any, any>
>(worker: Worker, config: WorkerClientConfig<TInput, TOutput>) => {
  return Effect.gen(function* () {
    const messageSchemas = createWorkerMessageSchemas(config.workerType, config.inputSchema, config.outputSchema)
    
    // Enhanced pending requests tracking
    const pendingRequests = yield* Ref.make<Map<MessageId, PendingRequest<S.Schema.Type<TOutput>>>>(new Map())

    // Request queue for rate limiting
    const requestQueue = yield* Queue.bounded<S.Schema.Type<TInput>>(config.maxConcurrentRequests ?? 10)

    // Worker capabilities and metadata
    const capabilities = yield* Ref.make<WorkerCapabilities | null>(null)
    const workerId = yield* Ref.make<WorkerId | null>(null)

    /**
     * Enhanced message handling with complete validation
     */
    const handleMessage = (event: MessageEvent): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        try {
          const message = event.data

          // Handle ready message
          if (message.type === 'ready') {
            const readyMsg = yield* Effect.try(() => validateMessage(WorkerMessageSchemas.WorkerReady, message))
            yield* Ref.set(capabilities, readyMsg.capabilities)
            yield* Ref.set(workerId, readyMsg.workerId)
            return
          }

          // Handle response messages
          if (message.type === 'response') {
            const response = yield* Effect.try(() => messageSchemas.validateResponse(message))
            const pending = yield* Ref.get(pendingRequests)
            const request = pending.get(response.id)

            if (request) {
              // Clear timeout
              if (request.timeout) {
                clearTimeout(request.timeout)
              }

              // Remove from pending
              yield* Ref.update(pendingRequests, (map) => {
                const newMap = new Map(map)
                newMap.delete(response.id)
                return newMap
              })

              // Resolve with validated data
              if (response.success && response.data) {
                request.resolve(response.data)
              } else {
                const errorMsg: WorkerError = {
                  id: response.id,
                  type: 'error',
                  messageType: config.workerType,
                  timestamp: response.timestamp,
                  error: {
                    name: 'ResponseError',
                    message: 'Worker response indicated failure',
                  }
                }
                request.reject(errorMsg)
              }
            }
          }

          // Handle error messages
          if (message.type === 'error') {
            const errorMsg = yield* Effect.try(() => validateMessage(WorkerMessageSchemas.WorkerError, message))
            const pending = yield* Ref.get(pendingRequests)
            const request = pending.get(errorMsg.id)

            if (request) {
              // Clear timeout
              if (request.timeout) {
                clearTimeout(request.timeout)
              }

              // Remove from pending
              yield* Ref.update(pendingRequests, (map) => {
                const newMap = new Map(map)
                newMap.delete(errorMsg.id)
                return newMap
              })

              // Reject with structured error
              request.reject(errorMsg)
            }
          }

          // Handle progress messages
          if (message.type === 'progress') {
            const progressMsg = yield* Effect.try(() => validateMessage(WorkerMessageSchemas.WorkerProgress, message))
            // Progress handling can be added here for streaming responses
            console.log('Worker progress:', progressMsg.progress)
          }

        } catch (validationError) {
          console.error('Worker client message validation failed:', validationError)
        }
      }).pipe(
        Effect.catchAll((error) =>
          Effect.sync(() => {
            console.error('Worker client message handling error:', error)
          }),
        ),
      )

    // Set up message listener
    worker.addEventListener('message', (event) => {
      Effect.runPromise(handleMessage(event))
    })

    /**
     * Enhanced request sending with full validation and retry logic
     */
    const sendRequest = (
      input: S.Schema.Type<TInput>,
      options?: {
        sharedBuffers?: Map<string, SharedArrayBuffer>
        priority?: WorkerMessageSchemas.MessagePriority
        timeout?: Duration.Duration
        enableProfiling?: boolean
        returnProgress?: boolean
      },
    ): Effect.Effect<S.Schema.Type<TOutput>, WorkerError, never> =>
      Effect.gen(function* () {
        const messageId = createMessageId()
        const currentWorkerId = yield* Ref.get(workerId)
        
        // Create validated request message
        const requestMessage = messageSchemas.createRequest(input, {
          id: messageId,
          workerId: currentWorkerId || undefined,
          priority: options?.priority || 'normal',
          timeout: options?.timeout ? Duration.toMillis(options.timeout) : undefined,
          options: {
            enableProfiling: options?.enableProfiling || false,
            returnProgress: options?.returnProgress || false,
            streaming: false,
            useCache: config.enableValidation !== false,
          }
        })

        // Add shared buffers if provided
        if (options?.sharedBuffers) {
          requestMessage.sharedBuffers = Object.fromEntries(options.sharedBuffers)
        }

        // Validate request before sending
        if (config.enableValidation !== false) {
          yield* Effect.try(() => messageSchemas.validateRequest(requestMessage))
        }

        // Create promise for response with enhanced error handling
        const responsePromise = yield* Effect.async<S.Schema.Type<TOutput>, WorkerError>((resume) => {
          const pendingRequest: PendingRequest<S.Schema.Type<TOutput>> = {
            messageId,
            resolve: (value) => resume(Effect.succeed(value)),
            reject: (error) => resume(Effect.fail(error)),
            timestamp: Date.now() as Timestamp,
            priority: options?.priority || 'normal',
            retryCount: 0,
            metadata: {
              requestType: config.workerType,
              startTime: Date.now(),
              lastAttempt: Date.now(),
            }
          }

          // Set timeout with retry logic
          const timeoutMs = options?.timeout ? Duration.toMillis(options.timeout) : 
                           (config.timeout ? Duration.toMillis(config.timeout) : 30000)

          pendingRequest.timeout = setTimeout(() => {
            Effect.runPromise(
              Ref.update(pendingRequests, (map) => {
                const newMap = new Map(map)
                newMap.delete(messageId)
                return newMap
              }),
            )
            
            const timeoutError: WorkerError = {
              id: messageId,
              type: 'error',
              messageType: config.workerType,
              timestamp: Date.now() as Timestamp,
              error: {
                name: 'TimeoutError',
                message: `Worker request timeout after ${timeoutMs}ms`,
                code: 'TIMEOUT',
              },
            }
            pendingRequest.reject(timeoutError)
          }, timeoutMs)

          // Add to pending requests
          Effect.runPromise(
            Ref.update(pendingRequests, (map) => {
              const newMap = new Map(map)
              newMap.set(messageId, pendingRequest)
              return newMap
            }),
          )

          // Extract transferables and send message
          const { transferables } = createMessageWithTransferables(requestMessage)
          
          if (transferables.length > 0) {
            worker.postMessage(requestMessage, { transfer: transferables })
          } else {
            worker.postMessage(requestMessage)
          }
        })

        return yield* responsePromise
      })

    /**
     * Get worker capabilities with validation
     */
    const getCapabilities = (): Effect.Effect<WorkerCapabilities | null, never, never> => Ref.get(capabilities)

    /**
     * Get worker ID
     */
    const getWorkerId = (): Effect.Effect<WorkerId | null, never, never> => Ref.get(workerId)

    /**
     * Enhanced worker termination with cleanup
     */
    const terminate = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        const currentWorkerId = yield* Ref.get(workerId)
        
        // Send termination message
        if (currentWorkerId) {
          const terminateMessage: WorkerMessageSchemas.WorkerTerminate = {
            type: 'terminate',
            workerId: currentWorkerId,
            timestamp: Date.now() as Timestamp,
            graceful: true,
          }
          worker.postMessage(terminateMessage)
        }

        // Clear all pending requests with proper error handling
        const pending = yield* Ref.get(pendingRequests)
        for (const [_, request] of pending) {
          if (request.timeout) {
            clearTimeout(request.timeout)
          }
          
          const terminationError: WorkerError = {
            id: request.messageId,
            type: 'error',
            messageType: config.workerType,
            timestamp: Date.now() as Timestamp,
            error: {
              name: 'WorkerTerminatedError',
              message: 'Worker was terminated',
              code: 'TERMINATED',
            },
          }
          request.reject(terminationError)
        }
        
        yield* Ref.set(pendingRequests, new Map())
        yield* Ref.set(capabilities, null)
        yield* Ref.set(workerId, null)

        // Terminate worker
        worker.terminate()
      })

    return {
      sendRequest,
      getCapabilities,
      getWorkerId,
      terminate,
      messageSchemas,
    }
  })
}
