import * as S from '@effect/schema/Schema'
import {
  MessageId,
  WorkerId,
  MessagePriority,
  Timestamp,
  Duration,
  WorkerCapabilities,
  createMessageId,
  createWorkerId,
} from './worker-messages.schema'

/**
 * Worker Bridge Schema Definitions
 * Type-safe schemas for bridging between performance layer and unified worker system
 */

// ============================================
// Legacy Performance Worker Types
// ============================================

/**
 * Performance worker types from legacy system
 */
export const PerformanceWorkerType = S.Union(
  S.Literal('compute'),
  S.Literal('physics'),
  S.Literal('terrain'),
  S.Literal('pathfinding'),
  S.Literal('rendering'),
  S.Literal('compression'),
  S.Literal('mesh'),
  S.Literal('lighting')
).pipe(S.identifier('PerformanceWorkerType'))

export type PerformanceWorkerType = S.Schema.Type<typeof PerformanceWorkerType>

/**
 * Task priority levels
 */
export const TaskPriority = S.Union(
  S.Literal('low'),
  S.Literal('normal'),
  S.Literal('high'),
  S.Literal('critical'),
  S.Literal('urgent')
).pipe(S.identifier('TaskPriority'))

export type TaskPriority = S.Schema.Type<typeof TaskPriority>

/**
 * Worker task data validation schema
 */
export const WorkerTaskData = S.Union(
  S.Record({
    key: S.String,
    value: S.Unknown
  }),
  S.Array(S.Unknown),
  S.String,
  S.Number,
  S.Boolean,
  S.Unknown
).pipe(S.identifier('WorkerTaskData'))

export type WorkerTaskData = S.Schema.Type<typeof WorkerTaskData>

/**
 * Transferable object validation
 */
export const TransferableObject = S.Union(
  S.InstanceOf(ArrayBuffer),
  S.InstanceOf(MessagePort),
  S.Unknown.pipe(S.filter(obj => ArrayBuffer.isView(obj))),
  S.InstanceOf(ImageBitmap),
).pipe(S.identifier('TransferableObject'))

export type TransferableObject = S.Schema.Type<typeof TransferableObject>

// ============================================
// Worker Task Schema
// ============================================

/**
 * Complete worker task definition with validation
 */
export const WorkerTask = S.Struct({
  // Task identification
  id: MessageId,
  type: PerformanceWorkerType,
  operation: S.String.pipe(S.nonEmpty()),
  
  // Task payload
  data: WorkerTaskData,
  transferables: S.optional(S.Array(TransferableObject)),
  
  // Task priority and scheduling
  priority: TaskPriority,
  timeout: S.optional(Duration),
  
  // Execution options
  options: S.optional(S.Struct({
    enableProfiling: S.Boolean,
    returnProgress: S.Boolean,
    useCache: S.Boolean,
    retryOnFailure: S.Boolean,
    maxRetries: S.optional(S.Number.pipe(S.int(), S.between(0, 10))),
  })),

  // Metadata
  createdAt: Timestamp,
  scheduledAt: S.optional(Timestamp),
  context: S.optional(S.Record({
    key: S.String,
    value: S.Unknown
  })),
}).pipe(S.identifier('WorkerTask'))

export type WorkerTask = S.Schema.Type<typeof WorkerTask>

// ============================================
// Worker Statistics and Metrics
// ============================================

/**
 * Worker status enumeration
 */
export const WorkerStatus = S.Union(
  S.Literal('idle'),
  S.Literal('busy'),
  S.Literal('error'),
  S.Literal('terminated'),
  S.Literal('initializing')
).pipe(S.identifier('WorkerStatus'))

export type WorkerStatus = S.Schema.Type<typeof WorkerStatus>

/**
 * Worker statistics schema
 */
export const WorkerStats = S.Struct({
  workerId: WorkerId,
  type: PerformanceWorkerType,
  status: WorkerStatus,
  
  // Performance metrics
  tasksCompleted: S.Number.pipe(S.int(), S.nonNegative()),
  totalExecutionTime: Duration,
  averageExecutionTime: S.Number.pipe(S.nonNegative()),
  
  // Current state
  currentTask: S.optional(MessageId),
  lastActivity: Timestamp,
  
  // Resource usage
  memoryUsage: S.optional(S.Number.pipe(S.nonNegative())),
  cpuUsage: S.optional(S.Number.pipe(S.between(0, 100))),
  
  // Reliability metrics
  errorCount: S.Number.pipe(S.int(), S.nonNegative()),
  successRate: S.Number.pipe(S.between(0, 100)),
  
  // Capabilities
  capabilities: WorkerCapabilities,
}).pipe(S.identifier('WorkerStats'))

export type WorkerStats = S.Schema.Type<typeof WorkerStats>

// ============================================
// Worker Configuration
// ============================================

/**
 * Worker configuration schema with validation
 */
export const WorkerConfig = S.Struct({
  type: PerformanceWorkerType,
  scriptUrl: S.String.pipe(S.nonEmpty()),
  
  // Pool configuration
  minWorkers: S.Number.pipe(S.int(), S.positive()),
  maxWorkers: S.Number.pipe(S.int(), S.positive()),
  idleTimeout: Duration,
  
  // Task configuration
  maxTasksPerWorker: S.Number.pipe(S.int(), S.positive()),
  
  // Features
  enableSharedMemory: S.Boolean,
  enableTransferables: S.Boolean,
  enableProfiling: S.Boolean,
  
  // Resource limits
  memoryLimit: S.optional(S.Number.pipe(S.positive())),
  cpuLimit: S.optional(S.Number.pipe(S.between(0, 100))),
}).pipe(S.identifier('WorkerConfig'))

export type WorkerConfig = S.Schema.Type<typeof WorkerConfig>

// ============================================
// Error Schemas
// ============================================

/**
 * Worker error with structured information
 */
export const WorkerError = S.Struct({
  message: S.String,
  workerId: S.optional(WorkerId),
  taskId: S.optional(MessageId),
  type: PerformanceWorkerType,
  timestamp: Timestamp,
  
  // Error details
  code: S.optional(S.String),
  stack: S.optional(S.String),
  cause: S.optional(S.Unknown),
  
  // Context
  context: S.optional(S.Record({
    key: S.String,
    value: S.Unknown
  })),
}).pipe(S.identifier('WorkerError'))

export type WorkerError = S.Schema.Type<typeof WorkerError>

/**
 * Worker timeout error
 */
export const WorkerTimeoutError = S.Struct({
  message: S.String,
  taskId: MessageId,
  timeout: Duration,
  workerId: S.optional(WorkerId),
  type: PerformanceWorkerType,
  timestamp: Timestamp,
}).pipe(S.identifier('WorkerTimeoutError'))

export type WorkerTimeoutError = S.Schema.Type<typeof WorkerTimeoutError>

// ============================================
// Pool Size Information
// ============================================

/**
 * Pool size information schema
 */
export const PoolSizeInfo = S.Struct({
  active: S.Number.pipe(S.int(), S.nonNegative()),
  idle: S.Number.pipe(S.int(), S.nonNegative()),
  total: S.Number.pipe(S.int(), S.nonNegative()),
  
  // Additional metrics
  initializing: S.optional(S.Number.pipe(S.int(), S.nonNegative())),
  unhealthy: S.optional(S.Number.pipe(S.int(), S.nonNegative())),
  
  // Capacity information
  maxCapacity: S.Number.pipe(S.int(), S.positive()),
  utilizationRate: S.Number.pipe(S.between(0, 100)),
}).pipe(S.identifier('PoolSizeInfo'))

export type PoolSizeInfo = S.Schema.Type<typeof PoolSizeInfo>

// ============================================
// Data Validation Utilities
// ============================================

/**
 * Task data validation result
 */
export const TaskDataValidationResult = S.Struct({
  data: WorkerTaskData,
  type: S.String,
  size: S.optional(S.Number.pipe(S.int(), S.nonNegative())),
  isValid: S.Boolean,
  errors: S.optional(S.Array(S.String)),
}).pipe(S.identifier('TaskDataValidationResult'))

export type TaskDataValidationResult = S.Schema.Type<typeof TaskDataValidationResult>

/**
 * Transferable validation result
 */
export const TransferableValidationResult = S.Struct({
  items: S.Array(S.Struct({
    item: S.Unknown,
    type: S.String,
    isTransferable: S.Boolean,
    size: S.optional(S.Number.pipe(S.int(), S.nonNegative())),
  })),
  totalTransferables: S.Number.pipe(S.int(), S.nonNegative()),
  totalSize: S.optional(S.Number.pipe(S.int(), S.nonNegative())),
}).pipe(S.identifier('TransferableValidationResult'))

export type TransferableValidationResult = S.Schema.Type<typeof TransferableValidationResult>

/**
 * Sanitized task data
 */
export const SanitizedTaskData = S.Struct({
  _tag: S.Union(
    S.Literal('EmptyTaskData'),
    S.Literal('ObjectTaskData'),
    S.Literal('ArrayTaskData'),
    S.Literal('BufferTaskData'),
    S.Literal('PrimitiveTaskData')
  ),
  data: S.Unknown,
  metadata: S.optional(S.Record({
    key: S.String,
    value: S.Union(S.String, S.Number, S.Boolean)
  })),
  timestamp: Timestamp,
}).pipe(S.identifier('SanitizedTaskData'))

export type SanitizedTaskData = S.Schema.Type<typeof SanitizedTaskData>

/**
 * Broadcast message validation result
 */
export const BroadcastMessageValidationResult = S.Struct({
  message: S.Unknown,
  type: S.String,
  isSerializable: S.Boolean,
  size: S.optional(S.Number.pipe(S.int(), S.nonNegative())),
  errors: S.optional(S.Array(S.String)),
}).pipe(S.identifier('BroadcastMessageValidationResult'))

export type BroadcastMessageValidationResult = S.Schema.Type<typeof BroadcastMessageValidationResult>

// ============================================
// Validation Functions
// ============================================

/**
 * Validate worker task
 */
export const validateWorkerTask = (task: unknown) =>
  S.decodeUnknown(WorkerTask)(task)

/**
 * Validate worker configuration
 */
export const validateWorkerConfig = (config: unknown) =>
  S.decodeUnknown(WorkerConfig)(config)

/**
 * Validate worker statistics
 */
export const validateWorkerStats = (stats: unknown) =>
  S.decodeUnknown(WorkerStats)(stats)

/**
 * Validate worker error
 */
export const validateWorkerError = (error: unknown) =>
  S.decodeUnknown(WorkerError)(error)

/**
 * Validate pool size information
 */
export const validatePoolSizeInfo = (info: unknown) =>
  S.decodeUnknown(PoolSizeInfo)(info)

// ============================================
// Utility Functions
// ============================================

/**
 * Create default worker task
 */
export const createDefaultWorkerTask = (
  type: PerformanceWorkerType,
  operation: string,
  data: unknown
): WorkerTask => ({
  id: createMessageId(),
  type,
  operation,
  data: data as WorkerTaskData,
  priority: 'normal',
  createdAt: Date.now() as Timestamp,
})

/**
 * Create default worker configuration
 */
export const createDefaultWorkerConfig = (
  type: PerformanceWorkerType,
  scriptUrl: string
): WorkerConfig => ({
  type,
  scriptUrl,
  minWorkers: 1,
  maxWorkers: 4,
  idleTimeout: 300000 as Duration,
  maxTasksPerWorker: 100,
  enableSharedMemory: typeof SharedArrayBuffer !== 'undefined',
  enableTransferables: typeof ArrayBuffer !== 'undefined',
  enableProfiling: false,
})

/**
 * Map performance worker type to unified worker type
 */
export const mapToUnifiedWorkerType = (perfType: PerformanceWorkerType): string => {
  const mapping: Record<PerformanceWorkerType, string> = {
    terrain: 'terrain',
    physics: 'physics',
    rendering: 'mesh',
    mesh: 'mesh',
    lighting: 'lighting',
    compute: 'computation',
    pathfinding: 'computation',
    compression: 'computation',
  }
  
  return mapping[perfType] || 'computation'
}

/**
 * Map task priority to message priority
 */
export const mapTaskPriorityToMessagePriority = (taskPriority: TaskPriority): MessagePriority => {
  const mapping: Record<TaskPriority, MessagePriority> = {
    low: 'low',
    normal: 'normal',
    high: 'high',
    critical: 'critical',
    urgent: 'urgent',
  }
  
  return mapping[taskPriority]
}

// ============================================
// Export Schema Collection
// ============================================

export const WorkerBridgeSchemas = {
  // Core schemas
  PerformanceWorkerType,
  TaskPriority,
  WorkerTaskData,
  TransferableObject,
  WorkerTask,
  WorkerStatus,
  WorkerStats,
  WorkerConfig,
  WorkerError,
  WorkerTimeoutError,
  PoolSizeInfo,
  
  // Validation schemas
  TaskDataValidationResult,
  TransferableValidationResult,
  SanitizedTaskData,
  BroadcastMessageValidationResult,
  
  // Validators
  validateWorkerTask,
  validateWorkerConfig,
  validateWorkerStats,
  validateWorkerError,
  validatePoolSizeInfo,
  
  // Utilities
  createDefaultWorkerTask,
  createDefaultWorkerConfig,
  mapToUnifiedWorkerType,
  mapTaskPriorityToMessagePriority,
} as const