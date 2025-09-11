import * as S from '@effect/schema/Schema'
import * as ParseResult from '@effect/schema/ParseResult'
import { Effect } from 'effect'

/**
 * Base worker protocol definitions for type-safe communication
 * Supports SharedArrayBuffer and Transferable Objects
 */

// ============================================
// Core Protocol Types
// ============================================

/**
 * Message ID for request/response correlation
 */
export const MessageId = S.String.pipe(S.brand('MessageId'))
export type MessageId = S.Schema.Type<typeof MessageId>

/**
 * Unique request identifier generator
 */
export const createMessageId = (): MessageId => 
  `msg-${Date.now()}-${Math.random().toString(36).substring(2)}` as MessageId

/**
 * Worker request message schema
 */
export const WorkerRequest = <TPayload>(payloadSchema: S.Schema<TPayload>) => 
  S.Struct({
    id: MessageId,
    type: S.Literal('request'),
    payload: payloadSchema,
    timestamp: S.Number,
    transferables: S.optional(S.Array(S.String)), // Transferable object keys
    sharedBuffer: S.optional(S.Any), // SharedArrayBuffer reference
  })

export type WorkerRequest<TPayload> = {
  id: MessageId
  type: 'request'
  payload: TPayload
  timestamp: number
  transferables?: string[]
  sharedBuffer?: SharedArrayBuffer
}

/**
 * Worker response message schema
 */
export const WorkerResponse = <TData>(dataSchema: S.Schema<TData>) =>
  S.Struct({
    id: MessageId,
    type: S.Literal('response'),
    data: dataSchema,
    timestamp: S.Number,
    transferables: S.optional(S.Array(S.String)),
    sharedBuffer: S.optional(S.Any),
  })

export type WorkerResponse<TData> = {
  id: MessageId
  type: 'response'  
  data: TData
  timestamp: number
  transferables?: string[]
  sharedBuffer?: SharedArrayBuffer
}

/**
 * Worker error message schema
 */
export const WorkerError = S.Struct({
  id: MessageId,
  type: S.Literal('error'),
  error: S.Struct({
    name: S.String,
    message: S.String,
    stack: S.optional(S.String),
  }),
  timestamp: S.Number,
})

export type WorkerError = S.Schema.Type<typeof WorkerError>

/**
 * Worker ready signal
 */
export const WorkerReady = S.Struct({
  type: S.Literal('ready'),
  timestamp: S.Number,
  capabilities: S.Struct({
    supportsSharedArrayBuffer: S.Boolean,
    supportsTransferableObjects: S.Boolean,
    supportsOffscreenCanvas: S.Boolean,
  })
})

export type WorkerReady = S.Schema.Type<typeof WorkerReady>

/**
 * Combined worker message types
 */
export const WorkerMessage = S.Union(
  WorkerRequest(S.Any),
  WorkerResponse(S.Any), 
  WorkerError,
  WorkerReady
)

export type WorkerMessage = S.Schema.Type<typeof WorkerMessage>

// ============================================
// SharedArrayBuffer Utilities
// ============================================

/**
 * SharedArrayBuffer descriptor for efficient data sharing
 */
export const SharedBufferDescriptor = S.Struct({
  name: S.String,
  byteLength: S.Number,
  type: S.Union(
    S.Literal('Float32Array'),
    S.Literal('Int32Array'),
    S.Literal('Uint8Array'),
    S.Literal('Uint16Array'),
    S.Literal('Uint32Array')
  ),
})

export type SharedBufferDescriptor = S.Schema.Type<typeof SharedBufferDescriptor>

/**
 * Create a SharedArrayBuffer with type information
 */
export const createSharedBuffer = (descriptor: SharedBufferDescriptor): SharedArrayBuffer => {
  return new SharedArrayBuffer(descriptor.byteLength)
}

/**
 * Create typed array view from SharedArrayBuffer
 */
export const createTypedArrayView = <T extends ArrayBufferView>(
  buffer: SharedArrayBuffer,
  type: SharedBufferDescriptor['type']
): T => {
  switch (type) {
    case 'Float32Array':
      return new Float32Array(buffer) as T
    case 'Int32Array':
      return new Int32Array(buffer) as T
    case 'Uint8Array':
      return new Uint8Array(buffer) as T
    case 'Uint16Array':
      return new Uint16Array(buffer) as T
    case 'Uint32Array':
      return new Uint32Array(buffer) as T
    default:
      throw new Error(`Unsupported array type: ${type}`)
  }
}

// ============================================
// Transferable Objects Utilities
// ============================================

/**
 * Transferable object metadata
 */
export const TransferableDescriptor = S.Struct({
  key: S.String,
  type: S.Union(
    S.Literal('ArrayBuffer'),
    S.Literal('MessagePort'),
    S.Literal('ImageBitmap'),
    S.Literal('OffscreenCanvas')
  ),
})

export type TransferableDescriptor = S.Schema.Type<typeof TransferableDescriptor>

/**
 * Extract transferable objects from a message payload
 */
export const extractTransferables = (payload: any): Transferable[] => {
  const transferables: Transferable[] = []
  
  const extract = (obj: any): void => {
    if (obj && typeof obj === 'object') {
      if (obj instanceof ArrayBuffer ||
          obj instanceof MessagePort ||
          obj instanceof ImageBitmap ||
          (typeof OffscreenCanvas !== 'undefined' && obj instanceof OffscreenCanvas)) {
        transferables.push(obj as Transferable)
      } else if (obj.buffer instanceof ArrayBuffer) {
        // Handle TypedArrays
        transferables.push(obj.buffer)
      } else {
        // Recursively search object properties
        Object.values(obj).forEach(extract)
      }
    }
  }
  
  extract(payload)
  return transferables
}

// ============================================
// Capability Detection
// ============================================

/**
 * Detect worker capabilities
 */
export const detectWorkerCapabilities = (): WorkerReady['capabilities'] => {
  return {
    supportsSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    supportsTransferableObjects: typeof MessagePort !== 'undefined',
    supportsOffscreenCanvas: typeof OffscreenCanvas !== 'undefined',
  }
}

// ============================================
// Protocol Validation Helpers
// ============================================

/**
 * Validate message format
 */
export const validateMessage = <T>(
  schema: S.Schema<T>,
  data: unknown
): Effect.Effect<T, ParseResult.ParseError, never> => {
  return S.decodeUnknown(schema)(data)
}

/**
 * Encode message with proper transferables handling
 */
export const encodeMessage = <T>(
  schema: S.Schema<T>,
  data: T
): Effect.Effect<{ message: unknown; transferables: Transferable[] }, ParseResult.ParseError, never> => {
  return Effect.gen(function* () {
    const encoded = yield* S.encode(schema)(data)
    const transferables = extractTransferables(encoded)
    
    return {
      message: encoded,
      transferables
    }
  })
}