import * as S from '@effect/schema/Schema'

/**
 * Unified Worker Message Schemas
 * Complete type safety for all worker communication using @effect/schema
 */

// ============================================
// Base Message Infrastructure
// ============================================

/**
 * Message ID type with validation
 */
export const MessageId = S.String.pipe(
  S.pattern(/^msg_\d+_[a-z0-9]{9}$/),
  S.brand('MessageId'),
  S.identifier('MessageId')
)
export type MessageId = S.Schema.Type<typeof MessageId>

/**
 * Worker ID type with validation
 */
export const WorkerId = S.String.pipe(
  S.pattern(/^[a-z]+-(worker-)?(\d+-)?\d+(-[a-z0-9]{9})?$/),
  S.brand('WorkerId'),
  S.identifier('WorkerId')
)
export type WorkerId = S.Schema.Type<typeof WorkerId>

/**
 * Create unique message ID
 */
export const createMessageId = (): MessageId => 
  `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as MessageId

/**
 * Create worker ID
 */
export const createWorkerId = (type: string, index?: number): WorkerId => {
  const baseId = index !== undefined ? `${type}-${index}` : type
  return `${baseId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` as WorkerId
}

// ============================================
// Message Priority and Timing
// ============================================

/**
 * Message priority levels
 */
export const MessagePriority = S.Union(
  S.Literal('low'),
  S.Literal('normal'), 
  S.Literal('high'),
  S.Literal('critical'),
  S.Literal('urgent')
).pipe(S.identifier('MessagePriority'))
export type MessagePriority = S.Schema.Type<typeof MessagePriority>

/**
 * Timestamp with validation
 */
export const Timestamp = S.Number.pipe(
  S.int(),
  S.positive(),
  S.brand('Timestamp'),
  S.identifier('Timestamp')
)
export type Timestamp = S.Schema.Type<typeof Timestamp>

/**
 * Duration in milliseconds
 */
export const Duration = S.Number.pipe(
  S.positive(),
  S.brand('Duration'),
  S.identifier('Duration')
)
export type Duration = S.Schema.Type<typeof Duration>

// ============================================
// Base Message Structure
// ============================================

/**
 * Base message fields that all worker messages inherit
 */
export const BaseMessage = S.Struct({
  id: MessageId,
  timestamp: Timestamp,
  workerId: S.optional(WorkerId),
  priority: S.optional(MessagePriority),
  timeout: S.optional(Duration),
}).pipe(S.identifier('BaseMessage'))

export type BaseMessage = S.Schema.Type<typeof BaseMessage>

// ============================================
// Request/Response Message Types
// ============================================

/**
 * Generic worker request message
 */
export const WorkerRequest = <TPayload extends S.Schema<any, any, any>>(
  messageType: string,
  payloadSchema: TPayload
) => S.Struct({
  ...BaseMessage.fields,
  type: S.Literal('request'),
  messageType: S.Literal(messageType),
  payload: payloadSchema,
  transferables: S.optional(S.Array(S.String)),
  sharedBuffers: S.optional(S.Record({
    key: S.String,
    value: S.Unknown // SharedArrayBuffer references
  })),
  options: S.optional(S.Struct({
    enableProfiling: S.Boolean,
    returnProgress: S.Boolean,
    streaming: S.Boolean,
    useCache: S.Boolean,
    retryCount: S.optional(S.Number.pipe(S.int(), S.between(0, 10))),
  }))
}).pipe(S.identifier(`WorkerRequest<${messageType}>`))

/**
 * Generic worker response message
 */
export const WorkerResponse = <TData extends S.Schema<any, any, any>>(
  messageType: string,
  dataSchema: TData
) => S.Struct({
  ...BaseMessage.fields,
  type: S.Literal('response'),
  messageType: S.Literal(messageType),
  success: S.Boolean,
  data: dataSchema,
  transferables: S.optional(S.Array(S.String)),
  sharedBuffers: S.optional(S.Record({
    key: S.String,
    value: S.Unknown
  })),
  metadata: S.optional(S.Struct({
    processingTime: Duration,
    memoryUsage: S.optional(S.Number.pipe(S.positive())),
    warnings: S.optional(S.Array(S.String)),
  }))
}).pipe(S.identifier(`WorkerResponse<${messageType}>`))

/**
 * Worker error message
 */
export const WorkerError = S.Struct({
  ...BaseMessage.fields,
  type: S.Literal('error'),
  messageType: S.String,
  error: S.Struct({
    name: S.String,
    message: S.String,
    stack: S.optional(S.String),
    code: S.optional(S.String),
    details: S.optional(S.Unknown),
  }),
  context: S.optional(S.Struct({
    requestId: S.optional(MessageId),
    workerState: S.optional(S.String),
    lastOperation: S.optional(S.String),
  })),
}).pipe(S.identifier('WorkerError'))

export type WorkerError = S.Schema.Type<typeof WorkerError>

// ============================================
// Worker Control Messages
// ============================================

/**
 * Worker capabilities and readiness signal
 */
export const WorkerCapabilities = S.Struct({
  supportsSharedArrayBuffer: S.Boolean,
  supportsTransferableObjects: S.Boolean,
  supportsWasm: S.Boolean,
  supportsWebGL: S.Boolean,
  supportsOffscreenCanvas: S.Boolean,
  supportsStreaming: S.Boolean,
  maxMemory: S.Number.pipe(S.positive()),
  maxConcurrentRequests: S.Number.pipe(S.int(), S.positive()),
  supportedOperations: S.Array(S.String),
  threadCount: S.optional(S.Number.pipe(S.int(), S.positive())),
  version: S.optional(S.String),
}).pipe(S.identifier('WorkerCapabilities'))

export type WorkerCapabilities = S.Schema.Type<typeof WorkerCapabilities>

/**
 * Worker ready signal
 */
export const WorkerReady = S.Struct({
  type: S.Literal('ready'),
  workerId: WorkerId,
  timestamp: Timestamp,
  capabilities: WorkerCapabilities,
}).pipe(S.identifier('WorkerReady'))

export type WorkerReady = S.Schema.Type<typeof WorkerReady>

/**
 * Worker heartbeat message
 */
export const WorkerHeartbeat = S.Struct({
  type: S.Literal('heartbeat'),
  workerId: WorkerId,
  timestamp: Timestamp,
  status: S.Union(
    S.Literal('idle'),
    S.Literal('busy'),
    S.Literal('overloaded'),
    S.Literal('error')
  ),
  metrics: S.optional(S.Struct({
    activeRequests: S.Number.pipe(S.int(), S.nonNegative()),
    totalRequests: S.Number.pipe(S.int(), S.nonNegative()),
    averageResponseTime: S.Number.pipe(S.nonNegative()),
    memoryUsage: S.Number.pipe(S.nonNegative()),
    cpuUsage: S.optional(S.Number.pipe(S.between(0, 100))),
  }))
}).pipe(S.identifier('WorkerHeartbeat'))

export type WorkerHeartbeat = S.Schema.Type<typeof WorkerHeartbeat>

/**
 * Worker termination signal
 */
export const WorkerTerminate = S.Struct({
  type: S.Literal('terminate'),
  workerId: WorkerId,
  timestamp: Timestamp,
  reason: S.optional(S.String),
  graceful: S.Boolean,
}).pipe(S.identifier('WorkerTerminate'))

export type WorkerTerminate = S.Schema.Type<typeof WorkerTerminate>

// ============================================
// Progress and Streaming Messages
// ============================================

/**
 * Progress update message
 */
export const WorkerProgress = S.Struct({
  type: S.Literal('progress'),
  requestId: MessageId,
  workerId: WorkerId,
  timestamp: Timestamp,
  progress: S.Struct({
    percentage: S.Number.pipe(S.between(0, 100)),
    stage: S.String,
    estimatedTimeRemaining: S.optional(Duration),
    currentStep: S.optional(S.Number.pipe(S.int(), S.positive())),
    totalSteps: S.optional(S.Number.pipe(S.int(), S.positive())),
  }),
  intermediateData: S.optional(S.Unknown),
}).pipe(S.identifier('WorkerProgress'))

export type WorkerProgress = S.Schema.Type<typeof WorkerProgress>

/**
 * Streaming data chunk
 */
export const WorkerStreamChunk = S.Struct({
  type: S.Literal('stream_chunk'),
  requestId: MessageId,
  workerId: WorkerId,
  timestamp: Timestamp,
  chunk: S.Struct({
    index: S.Number.pipe(S.int(), S.nonNegative()),
    data: S.Unknown,
    isLast: S.Boolean,
    size: S.Number.pipe(S.int(), S.nonNegative()),
  }),
  transferables: S.optional(S.Array(S.String)),
}).pipe(S.identifier('WorkerStreamChunk'))

export type WorkerStreamChunk = S.Schema.Type<typeof WorkerStreamChunk>

// ============================================
// Union Types for All Message Types
// ============================================

/**
 * All possible worker messages - used for validation
 */
export const WorkerMessage = S.Union(
  WorkerReady,
  WorkerHeartbeat,
  WorkerTerminate,
  WorkerError,
  WorkerProgress,
  WorkerStreamChunk,
  // Request/Response messages need to be added dynamically per worker type
).pipe(S.identifier('WorkerMessage'))

export type WorkerMessage = S.Schema.Type<typeof WorkerMessage>

// ============================================
// Message Validation Utilities
// ============================================

/**
 * Validate any worker message against the union schema
 */
export const validateWorkerMessage = (message: unknown) => 
  S.decodeUnknown(WorkerMessage)(message)

/**
 * Create a typed request validator for specific message types
 */
export const createRequestValidator = <T extends S.Schema<any, any, any>>(
  messageType: string,
  payloadSchema: T
) => {
  const RequestSchema = WorkerRequest(messageType, payloadSchema)
  return (message: unknown) => S.decodeUnknown(RequestSchema)(message)
}

/**
 * Create a typed response validator for specific message types
 */
export const createResponseValidator = <T extends S.Schema<any, any, any>>(
  messageType: string,
  dataSchema: T
) => {
  const ResponseSchema = WorkerResponse(messageType, dataSchema)
  return (message: unknown) => S.decodeUnknown(ResponseSchema)(message)
}

// ============================================
// Transferable Object Utilities
// ============================================

/**
 * Extract transferable objects from data recursively
 */
export const extractTransferables = (data: unknown): Transferable[] => {
  const transferables: Transferable[] = []
  
  const extract = (obj: any): void => {
    if (!obj || typeof obj !== 'object') return
    
    // Check if object is directly transferable
    if (obj instanceof ArrayBuffer || 
        obj instanceof MessagePort ||
        obj instanceof ImageBitmap ||
        obj instanceof OffscreenCanvas) {
      transferables.push(obj)
      return
    }
    
    // Check for TypedArray views
    if (ArrayBuffer.isView(obj)) {
      transferables.push(obj.buffer)
      return
    }
    
    // Recursively check object properties
    if (Array.isArray(obj)) {
      obj.forEach(extract)
    } else {
      Object.values(obj).forEach(extract)
    }
  }
  
  extract(data)
  return transferables
}

/**
 * Schema for validating transferable objects
 */
export const TransferableObject = S.Union(
  S.InstanceOf(ArrayBuffer),
  S.InstanceOf(MessagePort),
  S.Unknown.pipe(S.filter(obj => ArrayBuffer.isView(obj))),
  S.InstanceOf(ImageBitmap),
).pipe(S.identifier('TransferableObject'))

/**
 * Create a message with transferables extracted
 */
export const createMessageWithTransferables = <T>(data: T): {
  message: T
  transferables: Transferable[]
} => {
  const transferables = extractTransferables(data)
  return { message: data, transferables }
}

// ============================================
// SharedArrayBuffer Support
// ============================================

/**
 * Shared buffer descriptor with validation
 */
export const SharedBufferDescriptor = S.Struct({
  name: S.String.pipe(S.nonEmpty()),
  size: S.Number.pipe(S.int(), S.positive()),
  type: S.Union(
    S.Literal('Int8'),
    S.Literal('Uint8'),
    S.Literal('Int16'),
    S.Literal('Uint16'),
    S.Literal('Int32'),
    S.Literal('Uint32'),
    S.Literal('Float32'),
    S.Literal('Float64'),
  ),
  usage: S.optional(S.Union(
    S.Literal('read-only'),
    S.Literal('write-only'),
    S.Literal('read-write')
  )),
}).pipe(S.identifier('SharedBufferDescriptor'))

export type SharedBufferDescriptor = S.Schema.Type<typeof SharedBufferDescriptor>

/**
 * Utility to create typed array view from shared buffer
 */
export const createTypedArrayView = (
  buffer: SharedArrayBuffer, 
  descriptor: SharedBufferDescriptor
): ArrayBufferView => {
  switch (descriptor.type) {
    case 'Int8': return new Int8Array(buffer)
    case 'Uint8': return new Uint8Array(buffer)
    case 'Int16': return new Int16Array(buffer)
    case 'Uint16': return new Uint16Array(buffer)
    case 'Int32': return new Int32Array(buffer)
    case 'Uint32': return new Uint32Array(buffer)
    case 'Float32': return new Float32Array(buffer)
    case 'Float64': return new Float64Array(buffer)
    default: throw new Error(`Unsupported array type: ${descriptor.type}`)
  }
}

// ============================================
// Message Encoding/Decoding
// ============================================

/**
 * Enhanced message encoder with full type safety
 */
export const encodeMessage = <T extends S.Schema<any, any, any>>(
  schema: T,
  data: S.Schema.Type<T>
): {
  encodedMessage: S.Schema.Type<T>
  transferables: Transferable[]
  validation: ReturnType<typeof S.decodeUnknown<T>>
} => {
  // Validate the message structure
  const validation = S.decodeUnknown(schema)(data)
  
  // Extract transferables
  const transferables = extractTransferables(data)
  
  return {
    encodedMessage: data,
    transferables,
    validation
  }
}

/**
 * Enhanced message decoder with full type safety
 */
export const decodeMessage = <T extends S.Schema<any, any, any>>(
  schema: T,
  rawMessage: unknown
): ReturnType<typeof S.decodeUnknown<T>> => {
  return S.decodeUnknown(schema)(rawMessage)
}

// ============================================
// Worker-Specific Message Factories
// ============================================

/**
 * Create a complete message schema factory for a worker type
 */
export const createWorkerMessageSchemas = <
  TRequest extends S.Schema<any, any, any>,
  TResponse extends S.Schema<any, any, any>
>(workerType: string, requestSchema: TRequest, responseSchema: TResponse) => {
  
  const Request = WorkerRequest(workerType, requestSchema)
  const Response = WorkerResponse(workerType, responseSchema)
  
  // Create union of all messages for this worker type
  const MessageUnion = S.Union(
    Request,
    Response,
    WorkerError,
    WorkerProgress,
    WorkerStreamChunk,
  ).pipe(S.identifier(`${workerType}WorkerMessage`))
  
  return {
    Request,
    Response,
    Error: WorkerError,
    Progress: WorkerProgress,
    StreamChunk: WorkerStreamChunk,
    MessageUnion,
    
    // Validators
    validateRequest: createRequestValidator(workerType, requestSchema),
    validateResponse: createResponseValidator(workerType, responseSchema),
    validateMessage: (message: unknown) => S.decodeUnknown(MessageUnion)(message),
    
    // Message creators
    createRequest: (
      payload: S.Schema.Type<TRequest>, 
      options?: Partial<S.Schema.Type<typeof BaseMessage>>
    ) => ({
      id: createMessageId(),
      type: 'request' as const,
      messageType: workerType,
      timestamp: Date.now() as Timestamp,
      payload,
      ...options
    }),
    
    createResponse: (
      requestId: MessageId,
      data: S.Schema.Type<TResponse>,
      success: boolean = true,
      options?: Partial<S.Schema.Type<typeof BaseMessage>>
    ) => ({
      id: requestId,
      type: 'response' as const,
      messageType: workerType,
      timestamp: Date.now() as Timestamp,
      success,
      data,
      ...options
    }),
    
    createError: (
      requestId: MessageId,
      error: Error,
      options?: Partial<S.Schema.Type<typeof BaseMessage>>
    ) => ({
      id: requestId,
      type: 'error' as const,
      messageType: workerType,
      timestamp: Date.now() as Timestamp,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...options
    })
  }
}

// ============================================
// Export all schemas for easy access
// ============================================

export const WorkerMessageSchemas = {
  // Base types
  MessageId,
  WorkerId,
  MessagePriority,
  Timestamp,
  Duration,
  BaseMessage,
  
  // Message types
  WorkerRequest,
  WorkerResponse,
  WorkerError,
  WorkerReady,
  WorkerHeartbeat,
  WorkerTerminate,
  WorkerProgress,
  WorkerStreamChunk,
  WorkerMessage,
  
  // Utilities
  WorkerCapabilities,
  SharedBufferDescriptor,
  TransferableObject,
  
  // Functions
  createMessageId,
  createWorkerId,
  validateWorkerMessage,
  createRequestValidator,
  createResponseValidator,
  extractTransferables,
  createMessageWithTransferables,
  encodeMessage,
  decodeMessage,
  createWorkerMessageSchemas,
  createTypedArrayView,
} as const