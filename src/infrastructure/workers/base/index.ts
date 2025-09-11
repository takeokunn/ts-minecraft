/**
 * Base worker system exports
 * Provides typed worker infrastructure with advanced features
 */

export * from './protocol'
export * from './typed-worker'

// Re-export key types for convenience
export type {
  MessageId,
  WorkerRequest,
  WorkerResponse,
  WorkerError,
  WorkerReady,
  WorkerMessage,
  SharedBufferDescriptor,
  TransferableDescriptor,
} from './protocol'

export type {
  WorkerHandler,
  WorkerHandlerContext,
  TypedWorkerConfig,
  WorkerClientConfig,
} from './typed-worker'