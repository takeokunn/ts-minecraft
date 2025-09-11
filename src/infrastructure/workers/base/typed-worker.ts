import { Effect, Queue, Ref, Duration } from 'effect'
import * as S from 'effect/Schema'

/**
 * Advanced typed worker system with SharedArrayBuffer and Transferable Objects support
 * Simplified version for the unified worker system
 */

// ============================================
// Core Message Types
// ============================================

export type MessageId = string

/**
 * Create unique message ID
 */
export const createMessageId = (): MessageId => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

/**
 * Base message structure
 */
export const BaseMessage = S.Struct({
  id: S.String,
  timestamp: S.Number.pipe(S.positive),
}).pipe(S.identifier('BaseMessage'))

/**
 * Worker request message
 */
export const WorkerRequest = <TPayload extends S.Schema<any>>(payloadSchema: TPayload) =>
  S.Struct({
    ...BaseMessage.fields,
    type: S.Literal('request'),
    payload: payloadSchema,
    sharedBuffer: S.optional(S.Unknown),
    transferables: S.optional(S.Array(S.String)),
  }).pipe(S.identifier('WorkerRequest'))

/**
 * Worker response message
 */
export const WorkerResponse = <TData extends S.Schema<any>>(dataSchema: TData) =>
  S.Struct({
    ...BaseMessage.fields,
    type: S.Literal('response'),
    data: dataSchema,
    transferables: S.optional(S.Array(S.String)),
    sharedBuffer: S.optional(S.Unknown),
  }).pipe(S.identifier('WorkerResponse'))

/**
 * Worker error message
 */
export const WorkerError = S.Struct({
  ...BaseMessage.fields,
  type: S.Literal('error'),
  error: S.Struct({
    name: S.String,
    message: S.String,
    stack: S.optional(S.String),
  }),
}).pipe(S.identifier('WorkerError'))

/**
 * Worker ready signal
 */
export const WorkerReady = S.Struct({
  type: S.Literal('ready'),
  timestamp: S.Number.pipe(S.positive),
  capabilities: S.Struct({
    supportsSharedArrayBuffer: S.Boolean,
    supportsTransferableObjects: S.Boolean,
    supportsWasm: S.Boolean,
    maxMemory: S.Number.pipe(S.positive),
    threadCount: S.Number.pipe(S.int(), S.positive),
  }),
}).pipe(S.identifier('WorkerReady'))

export type WorkerReady = S.Schema.Type<typeof WorkerReady>

// ============================================
// Worker Capabilities Detection
// ============================================

/**
 * Detect worker capabilities
 */
export const detectWorkerCapabilities = (): WorkerReady['capabilities'] => ({
  supportsSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
  supportsTransferableObjects: typeof ArrayBuffer !== 'undefined',
  supportsWasm: typeof WebAssembly !== 'undefined',
  maxMemory: 100 * 1024 * 1024, // 100MB default
  threadCount: navigator?.hardwareConcurrency || 4,
})

// ============================================
// Message Validation and Encoding
// ============================================

/**
 * Validate message against schema
 */
export const validateMessage = <T>(schema: S.Schema<T>, message: unknown) => S.decodeUnknown(schema)(message)

/**
 * Encode message with transferables extraction
 */
export const encodeMessage = <T>(schema: S.Schema<T>, data: T) =>
  Effect.gen(function* () {
    const transferables = extractTransferables(data)
    return {
      message: data,
      transferables,
    }
  })

/**
 * Extract transferable objects from data
 */
export const extractTransferables = (data: any): ArrayBufferView[] => {
  const transferables: ArrayBufferView[] = []

  const extract = (obj: any) => {
    if (obj instanceof ArrayBuffer || obj instanceof ArrayBufferView) {
      transferables.push(obj)
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(extract)
    } else if (Array.isArray(obj)) {
      obj.forEach(extract)
    }
  }

  extract(data)
  return transferables
}

// ============================================
// SharedArrayBuffer Support
// ============================================

/**
 * Shared buffer descriptor
 */
export interface SharedBufferDescriptor {
  name: string
  size: number
  type: 'Float32' | 'Int32' | 'Uint32' | 'Uint8'
}

/**
 * Create shared buffer
 */
export const createSharedBuffer = (descriptor: SharedBufferDescriptor): SharedArrayBuffer => {
  const elementSize = getElementSize(descriptor.type)
  const buffer = new SharedArrayBuffer(descriptor.size * elementSize)
  return buffer
}

/**
 * Create typed array view from shared buffer
 */
export const createTypedArrayView = <T extends ArrayBufferView>(buffer: SharedArrayBuffer, type: SharedBufferDescriptor['type']): T => {
  switch (type) {
    case 'Float32':
      return new Float32Array(buffer) as T
    case 'Int32':
      return new Int32Array(buffer) as T
    case 'Uint32':
      return new Uint32Array(buffer) as T
    case 'Uint8':
      return new Uint8Array(buffer) as T
    default:
      throw new Error(`Unsupported array type: ${type}`)
  }
}

/**
 * Get element size for typed arrays
 */
const getElementSize = (type: SharedBufferDescriptor['type']): number => {
  switch (type) {
    case 'Float32':
      return 4
    case 'Int32':
      return 4
    case 'Uint32':
      return 4
    case 'Uint8':
      return 1
    default:
      return 4
  }
}

// ============================================
// Worker Handler Types
// ============================================

/**
 * Context provided to worker handlers
 */
export interface WorkerHandlerContext {
  messageId: MessageId
  timestamp: number
  sharedBuffer?: SharedArrayBuffer
  capabilities: WorkerReady['capabilities']
}

/**
 * Worker handler function type
 */
export type WorkerHandler<TInput, TOutput> = (input: TInput, context: WorkerHandlerContext) => Effect.Effect<TOutput, never, never>

/**
 * Worker configuration
 */
export interface TypedWorkerConfig<TInput, TOutput> {
  name: string
  inputSchema: S.Schema<TInput>
  outputSchema: S.Schema<TOutput>
  handler: WorkerHandler<TInput, TOutput>
  sharedBuffers?: SharedBufferDescriptor[]
  timeout?: Duration.Duration
}

// ============================================
// Worker Client Configuration
// ============================================

/**
 * Worker client configuration
 */
export interface WorkerClientConfig<TInput, TOutput> {
  inputSchema: S.Schema<TInput>
  outputSchema: S.Schema<TOutput>
  timeout?: Duration.Duration
  maxConcurrentRequests?: number
}

// ============================================
// Pending Request Tracking
// ============================================

/**
 * Pending request tracking
 */
interface PendingRequest<TOutput> {
  resolve: (value: TOutput) => void
  reject: (error: Error) => void
  timestamp: number
  timeout?: NodeJS.Timeout
}

// ============================================
// Worker Client Implementation
// ============================================

/**
 * Create a typed worker factory
 */
export const createWorkerFactory = <TInput, TOutput>(config: TypedWorkerConfig<TInput, TOutput>) => {
  return {
    create: () => new Worker(new URL(config.name, import.meta.url), { type: 'module' }),
    config,
  }
}

/**
 * Create a typed worker instance with handler
 */
export const createTypedWorker = <TInput, TOutput>(config: TypedWorkerConfig<TInput, TOutput>) => {
  return Effect.gen(function* () {
    const capabilities = detectWorkerCapabilities()

    // Send ready signal
    self.postMessage({
      type: 'ready',
      timestamp: Date.now(),
      capabilities,
    })

    // Handle incoming messages
    const handleMessage = (event: MessageEvent) => {
      const { id, type, payload, timestamp } = event.data

      if (type === 'capabilities') {
        self.postMessage({
          type: 'ready',
          timestamp: Date.now(),
          capabilities,
        })
        return
      }

      if (type === 'request') {
        const context: WorkerHandlerContext = {
          messageId: id,
          timestamp,
          capabilities,
        }

        Effect.runPromise(
          config.handler(payload, context).pipe(
            Effect.timeout(config.timeout || Duration.seconds(30)),
            Effect.tap((result) => {
              self.postMessage({
                id,
                type: 'response',
                data: result,
                timestamp: Date.now(),
              })
            }),
            Effect.catchAll((error) => {
              self.postMessage({
                id,
                type: 'error',
                error: {
                  name: error instanceof Error ? error.name : 'Error',
                  message: error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined,
                },
                timestamp: Date.now(),
              })
              return Effect.void
            }),
          ),
        )
      }
    }

    self.onmessage = handleMessage

    return { capabilities }
  })
}

/**
 * Create a typed worker client
 */
export const createTypedWorkerClient = <TInput, TOutput>(worker: Worker, config: WorkerClientConfig<TInput, TOutput>) => {
  return Effect.gen(function* () {
    // Pending requests tracking
    const pendingRequests = yield* Ref.make<Map<MessageId, PendingRequest<TOutput>>>(new Map())

    // Request queue for rate limiting
    const requestQueue = yield* Queue.bounded<TInput>(config.maxConcurrentRequests ?? 10)

    // Worker capabilities
    const capabilities = yield* Ref.make<WorkerReady['capabilities'] | null>(null)

    /**
     * Handle incoming worker messages
     */
    const handleMessage = (event: MessageEvent): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        const message = event.data

        if (message.type === 'ready') {
          const readyMsg = yield* validateMessage(WorkerReady, message)
          yield* Ref.set(capabilities, readyMsg.capabilities)
          return
        }

        if (message.type === 'response') {
          const response = yield* validateMessage(WorkerResponse(config.outputSchema), message)

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

            // Resolve the promise
            request.resolve(response.data)
          }
        }

        if (message.type === 'error') {
          const errorMsg = yield* validateMessage(WorkerError, message)

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

            // Reject the promise
            const error = new Error(errorMsg.error.message)
            error.name = errorMsg.error.name
            if (errorMsg.error.stack) {
              error.stack = errorMsg.error.stack
            }
            request.reject(error)
          }
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
     * Send request to worker
     */
    const sendRequest = (
      input: TInput,
      options?: {
        sharedBuffer?: SharedArrayBuffer
        priority?: number
      },
    ): Effect.Effect<TOutput, never, never> =>
      Effect.gen(function* () {
        const messageId = createMessageId()

        // Create request
        const request = {
          id: messageId,
          type: 'request' as const,
          payload: input,
          timestamp: Date.now(),
          sharedBuffer: options?.sharedBuffer,
        }

        // Encode message with transferables
        const encoded = yield* encodeMessage(config.inputSchema, input)

        // Create promise for response
        const responsePromise = yield* Effect.async<TOutput>((resume) => {
          const pendingRequest: PendingRequest<TOutput> = {
            resolve: (value) => resume(Effect.succeed(value)),
            reject: (error) => resume(Effect.fail(error)),
            timestamp: Date.now(),
          }

          // Set timeout if specified
          const timeoutMs = config.timeout ? Duration.toMillis(config.timeout) : 30000

          pendingRequest.timeout = setTimeout(() => {
            Effect.runPromise(
              Ref.update(pendingRequests, (map) => {
                const newMap = new Map(map)
                newMap.delete(messageId)
                return newMap
              }),
            )
            pendingRequest.reject(new Error(`Worker request timeout after ${timeoutMs}ms`))
          }, timeoutMs)

          // Add to pending requests
          Effect.runPromise(
            Ref.update(pendingRequests, (map) => {
              const newMap = new Map(map)
              newMap.set(messageId, pendingRequest)
              return newMap
            }),
          )

          // Send message
          if (encoded.transferables.length > 0) {
            worker.postMessage(
              { ...request, payload: encoded.message },
              {
                transfer: encoded.transferables,
              },
            )
          } else {
            worker.postMessage(request)
          }
        })

        return yield* responsePromise
      })

    /**
     * Get worker capabilities
     */
    const getCapabilities = (): Effect.Effect<WorkerReady['capabilities'] | null, never, never> => Ref.get(capabilities)

    /**
     * Terminate worker and clean up
     */
    const terminate = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        // Clear all pending requests
        const pending = yield* Ref.get(pendingRequests)
        for (const [_, request] of pending) {
          if (request.timeout) {
            clearTimeout(request.timeout)
          }
          request.reject(new Error('Worker terminated'))
        }
        yield* Ref.set(pendingRequests, new Map())

        // Terminate worker
        worker.terminate()
      })

    return {
      sendRequest,
      getCapabilities,
      terminate,
    }
  })
}
