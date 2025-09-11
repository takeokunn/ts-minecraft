import { Effect, Queue, Ref, Duration } from 'effect'
import * as S from '@effect/schema/Schema'
import {
  WorkerRequest,
  WorkerResponse,
  WorkerError,
  WorkerReady,
  MessageId,
  createMessageId,
  extractTransferables,
  detectWorkerCapabilities,
  validateMessage,
  encodeMessage,
  SharedBufferDescriptor,
  createSharedBuffer,
  createTypedArrayView,
} from './protocol'

/**
 * Advanced typed worker system with SharedArrayBuffer and Transferable Objects support
 */

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
export type WorkerHandler<TInput, TOutput> = (
  input: TInput,
  context: WorkerHandlerContext
) => Effect.Effect<TOutput>

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
// Worker Implementation
// ============================================

/**
 * Create a typed worker with advanced features
 */
export const createTypedWorker = <TInput, TOutput>(
  config: TypedWorkerConfig<TInput, TOutput>
) => {
  // Initialize shared buffers
  const sharedBuffers = new Map<string, SharedArrayBuffer>()
  
  if (config.sharedBuffers) {
    for (const descriptor of config.sharedBuffers) {
      const buffer = createSharedBuffer(descriptor)
      sharedBuffers.set(descriptor.name, buffer)
    }
  }

  const capabilities = detectWorkerCapabilities()

  /**
   * Handle incoming worker messages
   */
  const handleMessage = (event: MessageEvent): Effect.Effect<void> =>
    Effect.gen(function* () {
      const message = event.data

      // Validate message format
      const request = yield* validateMessage(
        WorkerRequest(config.inputSchema),
        message
      ).pipe(
        Effect.catchAll((error) =>
          Effect.fail(new Error(`Invalid message format: ${error}`))
        )
      )

      // Create handler context
      const context: WorkerHandlerContext = {
        messageId: request.id,
        timestamp: Date.now(),
        sharedBuffer: request.sharedBuffer,
        capabilities,
      }

      // Process request with handler
      const result = yield* config.handler(request.payload, context).pipe(
        Effect.timeout(config.timeout ?? Duration.seconds(30)),
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            // Send error response
            const errorMessage: WorkerError = {
              id: request.id,
              type: 'error',
              error: {
                name: error instanceof Error ? error.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
              },
              timestamp: Date.now(),
            }

            self.postMessage(errorMessage)
            return yield* Effect.fail(error)
          })
        )
      )

      // Encode response
      const encoded = yield* encodeMessage(config.outputSchema, result)

      // Create response message
      const response: WorkerResponse<TOutput> = {
        id: request.id,
        type: 'response',
        data: result,
        timestamp: Date.now(),
        transferables: encoded.transferables.length > 0 
          ? encoded.transferables.map((_, i) => `transferable_${i}`)
          : undefined,
        sharedBuffer: sharedBuffers.size > 0 
          ? Array.from(sharedBuffers.values())[0]
          : undefined,
      }

      // Post message with transferables
      if (encoded.transferables.length > 0) {
        self.postMessage(response, { transfer: encoded.transferables })
      } else {
        self.postMessage(response)
      }
    }).pipe(
      Effect.catchAll((error) => 
        Effect.sync(() => {
          console.error(`Worker ${config.name} error:`, error)
        })
      )
    )

  /**
   * Start the worker
   */
  const start = (): Effect.Effect<void> =>
    Effect.gen(function* () {
      // Set up message handler
      self.onmessage = (event) => {
        Effect.runPromise(handleMessage(event))
      }

      // Send ready signal
      const readyMessage: WorkerReady = {
        type: 'ready',
        timestamp: Date.now(),
        capabilities,
      }

      self.postMessage(readyMessage)
    })

  /**
   * Stop the worker
   */
  const stop = (): Effect.Effect<void> =>
    Effect.sync(() => {
      self.onmessage = null
    })

  /**
   * Get shared buffer by name
   */
  const getSharedBuffer = (name: string): SharedArrayBuffer | undefined =>
    sharedBuffers.get(name)

  /**
   * Create typed array view from shared buffer
   */
  const createView = <T extends ArrayBufferView>(
    bufferName: string,
    type: SharedBufferDescriptor['type']
  ): T | undefined => {
    const buffer = sharedBuffers.get(bufferName)
    if (!buffer) return undefined
    
    return createTypedArrayView<T>(buffer, type)
  }

  return {
    start,
    stop,
    getSharedBuffer,
    createView,
    capabilities,
    config,
  }
}

// ============================================
// Worker Client Types
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
// Worker Client Implementation
// ============================================

/**
 * Create a typed worker client
 */
export const createTypedWorkerClient = <TInput, TOutput>(
  worker: Worker,
  config: WorkerClientConfig<TInput, TOutput>
) => {
  return Effect.gen(function* () {
    // Pending requests tracking
    const pendingRequests = yield* Ref.make<Map<MessageId, PendingRequest<TOutput>>>(
      new Map()
    )
    
    // Request queue for rate limiting
    const requestQueue = yield* Queue.bounded<() => Effect.Effect<TOutput>>(
      config.maxConcurrentRequests ?? 10
    )

    // Worker capabilities
    const capabilities = yield* Ref.make<WorkerReady['capabilities'] | null>(null)

    /**
     * Handle incoming worker messages
     */
    const handleMessage = (event: MessageEvent): Effect.Effect<void> =>
      Effect.gen(function* () {
        const message = event.data

        if (message.type === 'ready') {
          const readyMsg = yield* validateMessage(WorkerReady, message)
          yield* Ref.set(capabilities, readyMsg.capabilities)
          return
        }

        if (message.type === 'response') {
          const response = yield* validateMessage(
            WorkerResponse(config.outputSchema),
            message
          )

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
      })

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
      }
    ): Effect.Effect<TOutput> =>
      Effect.gen(function* () {
        const messageId = createMessageId()
        
        // Create request
        const request: WorkerRequest<TInput> = {
          id: messageId,
          type: 'request',
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
          const timeoutMs = config.timeout 
            ? Duration.toMillis(config.timeout)
            : 30000

          pendingRequest.timeout = setTimeout(() => {
            Effect.runPromise(
              Ref.update(pendingRequests, (map) => {
                const newMap = new Map(map)
                newMap.delete(messageId)
                return newMap
              })
            )
            pendingRequest.reject(new Error(`Worker request timeout after ${timeoutMs}ms`))
          }, timeoutMs)

          // Add to pending requests
          Effect.runPromise(
            Ref.update(pendingRequests, (map) => {
              const newMap = new Map(map)
              newMap.set(messageId, pendingRequest)
              return newMap
            })
          )

          // Send message
          if (encoded.transferables.length > 0) {
            worker.postMessage({ ...request, payload: encoded.message }, {
              transfer: encoded.transferables
            })
          } else {
            worker.postMessage(request)
          }
        })

        return yield* responsePromise
      })

    /**
     * Get worker capabilities
     */
    const getCapabilities = (): Effect.Effect<WorkerReady['capabilities'] | null> =>
      Ref.get(capabilities)

    /**
     * Terminate worker and clean up
     */
    const terminate = (): Effect.Effect<void> =>
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

// ============================================
// Utility Functions
// ============================================

/**
 * Create a worker factory function
 */
export const createWorkerFactory = <TInput, TOutput>(
  workerScript: string,
  config: WorkerClientConfig<TInput, TOutput>
) => {
  return (): Effect.Effect<Awaited<ReturnType<typeof createTypedWorkerClient<TInput, TOutput>>>> =>
    Effect.gen(function* () {
      const worker = new Worker(workerScript, { type: 'module' })
      return yield* createTypedWorkerClient(worker, config)
    })
}

/**
 * Worker pool for managing multiple worker instances
 */
export const createWorkerPool = <TInput, TOutput>(
  factory: () => Effect.Effect<Awaited<ReturnType<typeof createTypedWorkerClient<TInput, TOutput>>>>,
  poolSize: number = 4
) => {
  return Effect.gen(function* () {
    // Create worker instances
    const workers: Awaited<ReturnType<typeof createTypedWorkerClient<TInput, TOutput>>>[] = []
    for (let i = 0; i < poolSize; i++) {
      const worker = yield* factory()
      workers.push(worker)
    }

    // Round-robin index
    const currentIndex = yield* Ref.make(0)

    /**
     * Get next available worker
     */
    const getWorker = (): Effect.Effect<Awaited<ReturnType<typeof createTypedWorkerClient<TInput, TOutput>>>> =>
      Effect.gen(function* () {
        const index = yield* Ref.get(currentIndex)
        yield* Ref.update(currentIndex, (i) => (i + 1) % workers.length)
        return workers[index]
      })

    /**
     * Send request to worker pool
     */
    const sendRequest = (
      input: TInput,
      options?: Parameters<Awaited<ReturnType<typeof createTypedWorkerClient<TInput, TOutput>>>['sendRequest']>[1]
    ): Effect.Effect<TOutput> =>
      Effect.gen(function* () {
        const worker = yield* getWorker()
        return yield* worker.sendRequest(input, options)
      })

    /**
     * Terminate all workers
     */
    const terminate = (): Effect.Effect<void> =>
      Effect.all(workers.map(worker => worker.terminate()), { concurrency: 'unbounded' }).pipe(
        Effect.asVoid
      )

    return {
      sendRequest,
      getWorker,
      terminate,
      poolSize: workers.length,
    }
  })
}