import { Effect, Schema as S, pipe } from 'effect'

/**
 * Worker handler type - defines the shape of worker message handlers
 */
export type WorkerHandler<TIn, TOut> = (
  input: TIn
) => Effect.Effect<TOut, never, never>

/**
 * Worker configuration
 */
export interface WorkerConfig<TIn, TOut> {
  inputSchema: S.Schema<TIn>
  outputSchema: S.Schema<TOut>
  handler: WorkerHandler<TIn, TOut>
}

/**
 * Error message type
 */
export interface WorkerErrorMessage {
  readonly type: 'error'
  readonly error: unknown
  readonly timestamp: number
}

/**
 * Success message type
 */
export interface WorkerSuccessMessage<T> {
  readonly type: 'success'
  readonly data: T
  readonly timestamp: number
}

/**
 * Factory function to create type-safe workers
 * Ensures all message passing is validated against schemas
 */
export const createWorker = <TIn, TOut>(config: WorkerConfig<TIn, TOut>) => {
  const handleMessage = (e: MessageEvent) =>
    pipe(
      // Decode incoming message
      S.decodeUnknown(config.inputSchema)(e.data),
      
      // Process with handler
      Effect.flatMap(config.handler),
      
      // Encode output
      Effect.flatMap(S.encode(config.outputSchema)),
      
      // Send success response
      Effect.tap((encoded) =>
        Effect.sync(() => {
          const response: WorkerSuccessMessage<TOut> = {
            type: 'success',
            data: encoded as TOut,
            timestamp: Date.now()
          }
          self.postMessage(response)
        })
      ),
      
      // Handle errors
      Effect.catchAll((error) =>
        Effect.sync(() => {
          const errorResponse: WorkerErrorMessage = {
            type: 'error',
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now()
          }
          self.postMessage(errorResponse)
        })
      ),
      
      // Run the effect
      Effect.runPromise
    )

  return {
    /**
     * Start listening for messages
     */
    start: () => {
      self.onmessage = handleMessage
      
      // Send ready signal
      self.postMessage({ type: 'ready', timestamp: Date.now() })
    },
    
    /**
     * Stop listening for messages
     */
    stop: () => {
      self.onmessage = null
    }
  }
}

/**
 * Helper to create a worker client that communicates with the worker
 */
export const createWorkerClient = <TIn, TOut>(
  worker: Worker,
  config: {
    inputSchema: S.Schema<TIn>
    outputSchema: S.Schema<TOut>
    timeout?: number
  }
) => {
  const sendMessage = (input: TIn): Effect.Effect<TOut, Error, never> =>
    Effect.gen(function* () {
      // Encode input
      const encoded = yield* Effect.mapError(
        S.encode(config.inputSchema)(input),
        error => new Error(`Encode error: ${error}`)
      )
      
      // Send message and wait for response
      const response = yield* Effect.async<WorkerSuccessMessage<TOut> | WorkerErrorMessage, Error>((resume) => {
        const handler = (e: MessageEvent) => {
          const message = e.data
          if (message.type === 'success' || message.type === 'error') {
            worker.removeEventListener('message', handler)
            resume(Effect.succeed(message))
          }
        }
        
        worker.addEventListener('message', handler)
        worker.postMessage(encoded)
        
        // Timeout handling
        if (config.timeout) {
          setTimeout(() => {
            worker.removeEventListener('message', handler)
            resume(Effect.fail(new Error(`Worker timeout after ${config.timeout}ms`)))
          }, config.timeout)
        }
      })
      
      // Handle response
      if (response.type === 'error') {
        return yield* Effect.fail(new Error(`Worker error: ${response.error}`))
      }
      
      // Decode output
      return yield* Effect.mapError(
        S.decode(config.outputSchema)(response.data),
        error => new Error(`Decode error: ${error}`)
      )
    })
  
  return {
    sendMessage,
    terminate: () => Effect.sync(() => worker.terminate())
  }
}