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
 * Worker Pool Schema Definitions
 * Type-safe schemas for worker pool management and configuration
 */

// ============================================
// Pool Strategy and Configuration
// ============================================

/**
 * Pool scaling strategy
 */
export const PoolStrategy = S.Union(
  S.Literal('fixed'),
  S.Literal('dynamic'),
  S.Literal('adaptive'),
  S.Literal('demand-based')
).pipe(S.identifier('PoolStrategy'))

export type PoolStrategy = S.Schema.Type<typeof PoolStrategy>

/**
 * Load balancing strategy
 */
export const LoadBalanceStrategy = S.Union(
  S.Literal('round-robin'),
  S.Literal('least-busy'),
  S.Literal('priority-based'),
  S.Literal('random'),
  S.Literal('weighted'),
  S.Literal('locality-aware')
).pipe(S.identifier('LoadBalanceStrategy'))

export type LoadBalanceStrategy = S.Schema.Type<typeof LoadBalanceStrategy>

/**
 * Backpressure handling strategy
 */
export const BackpressureStrategy = S.Union(
  S.Literal('reject'),         // Reject new requests immediately
  S.Literal('drop_oldest'),    // Drop oldest pending request
  S.Literal('block'),          // Block until space available
  S.Literal('scale_up'),       // Attempt to scale up pool
).pipe(S.identifier('BackpressureStrategy'))

export type BackpressureStrategy = S.Schema.Type<typeof BackpressureStrategy>

/**
 * Health status for worker instances
 */
export const HealthStatus = S.Union(
  S.Literal('healthy'),
  S.Literal('degraded'),
  S.Literal('unhealthy'),
  S.Literal('terminated'),
  S.Literal('initializing'),
  S.Literal('restarting')
).pipe(S.identifier('HealthStatus'))

export type HealthStatus = S.Schema.Type<typeof HealthStatus>

/**
 * Worker pool configuration with complete validation
 */
export const WorkerPoolConfig = S.Struct({
  // Basic identification
  name: S.String.pipe(S.nonEmpty()),
  workerScript: S.String.pipe(S.nonEmpty()),
  workerType: S.String.pipe(S.nonEmpty()),

  // Schema configuration
  inputSchema: S.Unknown, // S.Schema<any, any, any> - will be validated at runtime
  outputSchema: S.Unknown, // S.Schema<any, any, any> - will be validated at runtime

  // Pool sizing configuration
  minWorkers: S.Number.pipe(S.int(), S.positive()),
  maxWorkers: S.Number.pipe(S.int(), S.positive()),
  initialWorkers: S.Number.pipe(S.int(), S.positive()),
  strategy: PoolStrategy,

  // Performance and concurrency
  maxConcurrentRequests: S.Number.pipe(S.int(), S.positive()),
  requestTimeout: Duration,
  idleTimeout: Duration,
  initializationTimeout: S.optional(Duration),
  
  // Queue and backpressure configuration
  maxQueueSize: S.optional(S.Number.pipe(S.int(), S.positive())),
  maxHighPriorityQueueSize: S.optional(S.Number.pipe(S.int(), S.positive())),
  backpressureStrategy: S.optional(BackpressureStrategy),
  backpressureTimeout: S.optional(Duration),

  // Load balancing
  loadBalanceStrategy: LoadBalanceStrategy,
  weights: S.optional(S.Record({
    key: S.String,
    value: S.Number.pipe(S.positive())
  })),

  // Health monitoring
  healthCheckInterval: Duration,
  healthCheckTimeout: Duration,
  maxConsecutiveFailures: S.Number.pipe(S.int(), S.between(1, 20)),
  recoveryInterval: S.optional(Duration),

  // Auto-scaling configuration
  scaleUpThreshold: S.Number.pipe(S.between(0, 100)), // CPU/queue utilization %
  scaleDownThreshold: S.Number.pipe(S.between(0, 100)),
  scaleUpCooldown: Duration,
  scaleDownCooldown: Duration,
  scaleUpStep: S.optional(S.Number.pipe(S.int(), S.positive())),
  scaleDownStep: S.optional(S.Number.pipe(S.int(), S.positive())),

  // Advanced features
  enableSharedArrayBuffer: S.Boolean,
  enableTransferableObjects: S.Boolean,
  enableMetrics: S.Boolean,
  enableProfiling: S.Boolean,
  enableRetries: S.Boolean,
  
  // Warmup configuration
  warmupRequests: S.optional(S.Array(S.Unknown)),
  preloadModules: S.optional(S.Array(S.String)),

  // Resource limits
  memoryLimit: S.optional(S.Number.pipe(S.positive())),
  cpuLimit: S.optional(S.Number.pipe(S.positive())),

  // Debugging and monitoring
  debugMode: S.Boolean,
  logLevel: S.optional(S.Union(
    S.Literal('error'),
    S.Literal('warn'),
    S.Literal('info'),
    S.Literal('debug'),
    S.Literal('trace')
  )),
}).pipe(S.identifier('WorkerPoolConfig'))

export type WorkerPoolConfig = S.Schema.Type<typeof WorkerPoolConfig>

// ============================================
// Worker Instance Metadata
// ============================================

/**
 * Comprehensive worker instance information
 */
export const WorkerInstance = S.Struct({
  // Identification
  id: WorkerId,
  type: S.String,
  poolName: S.String,
  
  // Worker references
  worker: S.Unknown, // Worker instance - not serializable
  client: S.Unknown, // Typed client - not serializable
  
  // Status and health
  status: HealthStatus,
  createdAt: Timestamp,
  lastUsed: Timestamp,
  lastHealthCheck: Timestamp,

  // Performance metrics
  totalRequests: S.Number.pipe(S.int(), S.nonNegative()),
  activeRequests: S.Number.pipe(S.int(), S.nonNegative()),
  completedRequests: S.Number.pipe(S.int(), S.nonNegative()),
  failedRequests: S.Number.pipe(S.int(), S.nonNegative()),
  averageResponseTime: S.Number.pipe(S.nonNegative()),
  consecutiveFailures: S.Number.pipe(S.int(), S.nonNegative()),

  // Resource usage
  memoryUsage: S.Number.pipe(S.nonNegative()),
  cpuUsage: S.Number.pipe(S.between(0, 100)),
  peakMemoryUsage: S.optional(S.Number.pipe(S.positive())),

  // Capabilities and configuration
  capabilities: WorkerCapabilities,
  priority: S.Number.pipe(S.int()),
  weight: S.optional(S.Number.pipe(S.positive())),

  // Lifecycle tracking
  restartCount: S.Number.pipe(S.int(), S.nonNegative()),
  lastRestart: S.optional(Timestamp),
  terminationReason: S.optional(S.String),
}).pipe(S.identifier('WorkerInstance'))

export type WorkerInstance = S.Schema.Type<typeof WorkerInstance>

// ============================================
// Request Queue Management
// ============================================

/**
 * Queued request with full metadata
 */
export const QueuedRequest = S.Struct({
  // Request identification
  id: MessageId,
  type: S.String,
  
  // Request payload and options
  payload: S.Unknown,
  priority: MessagePriority,
  timeout: Duration,
  
  // Timing and lifecycle
  createdAt: Timestamp,
  scheduledAt: S.optional(Timestamp),
  retryCount: S.Number.pipe(S.int(), S.nonNegative()),
  maxRetries: S.Number.pipe(S.int(), S.between(0, 10)),
  
  // Callbacks (not serializable)
  resolve: S.Unknown, // (value: any) => void
  reject: S.Unknown, // (error: Error) => void
  
  // Request options
  options: S.optional(S.Struct({
    preferredWorkerId: S.optional(WorkerId),
    enableProfiling: S.Boolean,
    returnProgress: S.Boolean,
    sticky: S.Boolean, // Should stay with same worker
    locality: S.optional(S.String), // Preferred locality/region
  })),
  
  // Progress tracking
  progress: S.optional(S.Struct({
    percentage: S.Number.pipe(S.between(0, 100)),
    stage: S.String,
    estimatedTimeRemaining: S.optional(Duration),
  })),
}).pipe(S.identifier('QueuedRequest'))

export type QueuedRequest = S.Schema.Type<typeof QueuedRequest>

// ============================================
// Pool Metrics and Statistics
// ============================================

/**
 * Comprehensive pool metrics
 */
export const PoolMetrics = S.Struct({
  // Worker counts
  totalWorkers: S.Number.pipe(S.int(), S.nonNegative()),
  activeWorkers: S.Number.pipe(S.int(), S.nonNegative()),
  idleWorkers: S.Number.pipe(S.int(), S.nonNegative()),
  unhealthyWorkers: S.Number.pipe(S.int(), S.nonNegative()),
  initializingWorkers: S.Number.pipe(S.int(), S.nonNegative()),
  terminatedWorkers: S.Number.pipe(S.int(), S.nonNegative()),

  // Request statistics
  totalRequests: S.Number.pipe(S.int(), S.nonNegative()),
  completedRequests: S.Number.pipe(S.int(), S.nonNegative()),
  failedRequests: S.Number.pipe(S.int(), S.nonNegative()),
  timeoutRequests: S.Number.pipe(S.int(), S.nonNegative()),
  retryRequests: S.Number.pipe(S.int(), S.nonNegative()),

  // Performance metrics
  averageResponseTime: S.Number.pipe(S.nonNegative()),
  medianResponseTime: S.optional(S.Number.pipe(S.nonNegative())),
  p95ResponseTime: S.optional(S.Number.pipe(S.nonNegative())),
  p99ResponseTime: S.optional(S.Number.pipe(S.nonNegative())),

  // Queue statistics
  queueLength: S.Number.pipe(S.int(), S.nonNegative()),
  queueUtilization: S.Number.pipe(S.between(0, 100)),
  averageQueueTime: S.Number.pipe(S.nonNegative()),
  maxQueueLength: S.Number.pipe(S.int(), S.nonNegative()),

  // Resource utilization
  totalMemoryUsage: S.Number.pipe(S.nonNegative()),
  averageMemoryUsage: S.Number.pipe(S.nonNegative()),
  peakMemoryUsage: S.Number.pipe(S.nonNegative()),
  cpuUtilization: S.Number.pipe(S.between(0, 100)),

  // Scaling events
  lastScaleEvent: S.optional(Timestamp),
  scaleEvents: S.Array(S.Struct({
    timestamp: Timestamp,
    action: S.Union(S.Literal('scale-up'), S.Literal('scale-down')),
    reason: S.String,
    workerCountBefore: S.Number.pipe(S.int(), S.nonNegative()),
    workerCountAfter: S.Number.pipe(S.int(), S.nonNegative()),
    duration: S.optional(Duration),
  })),

  // Health and reliability
  errorRate: S.Number.pipe(S.between(0, 100)),
  availabilityRate: S.Number.pipe(S.between(0, 100)),
  mttr: S.optional(S.Number.pipe(S.positive())), // Mean Time To Recovery
  mtbf: S.optional(S.Number.pipe(S.positive())), // Mean Time Between Failures

  // Pool efficiency
  utilizationRate: S.Number.pipe(S.between(0, 100)),
  throughput: S.Number.pipe(S.nonNegative()), // Requests per second
  efficiency: S.Number.pipe(S.between(0, 100)), // Resource efficiency score
}).pipe(S.identifier('PoolMetrics'))

export type PoolMetrics = S.Schema.Type<typeof PoolMetrics>

// ============================================
// Pool Operations and Events
// ============================================

/**
 * Pool operation types
 */
export const PoolOperation = S.Union(
  S.Literal('scale'),
  S.Literal('restart_worker'),
  S.Literal('remove_worker'),
  S.Literal('add_worker'),
  S.Literal('pause'),
  S.Literal('resume'),
  S.Literal('shutdown'),
  S.Literal('health_check'),
  S.Literal('cleanup'),
  S.Literal('rebalance')
).pipe(S.identifier('PoolOperation'))

export type PoolOperation = S.Schema.Type<typeof PoolOperation>

/**
 * Pool event for monitoring and logging
 */
export const PoolEvent = S.Struct({
  id: MessageId,
  poolName: S.String,
  timestamp: Timestamp,
  operation: PoolOperation,
  
  // Event details
  details: S.optional(S.Record({
    key: S.String,
    value: S.Union(S.String, S.Number, S.Boolean)
  })),
  
  // Affected resources
  workerId: S.optional(WorkerId),
  workerIds: S.optional(S.Array(WorkerId)),
  
  // Results and status
  success: S.Boolean,
  error: S.optional(S.String),
  duration: S.optional(Duration),
  
  // Context
  triggeredBy: S.optional(S.Union(
    S.Literal('auto-scaler'),
    S.Literal('health-monitor'),
    S.Literal('user'),
    S.Literal('system'),
    S.Literal('policy')
  )),
}).pipe(S.identifier('PoolEvent'))

export type PoolEvent = S.Schema.Type<typeof PoolEvent>

// ============================================
// Service Interface Schemas
// ============================================

/**
 * Request options schema
 */
export const RequestOptions = S.optional(S.Struct({
  priority: S.optional(MessagePriority),
  timeout: S.optional(Duration),
  preferredWorkerId: S.optional(WorkerId),
  enableProfiling: S.optional(S.Boolean),
  returnProgress: S.optional(S.Boolean),
  retryCount: S.optional(S.Number.pipe(S.int(), S.between(0, 10))),
  sticky: S.optional(S.Boolean),
  locality: S.optional(S.String),
}))

export type RequestOptions = S.Schema.Type<typeof RequestOptions>

/**
 * Scale options schema
 */
export const ScaleOptions = S.optional(S.Struct({
  targetSize: S.Number.pipe(S.int(), S.positive()),
  reason: S.optional(S.String),
  forced: S.optional(S.Boolean),
  gracefulShutdown: S.optional(S.Boolean),
  drainTimeout: S.optional(Duration),
}))

export type ScaleOptions = S.Schema.Type<typeof ScaleOptions>

// ============================================
// Default Configurations
// ============================================

/**
 * Create default worker pool configuration
 */
export const createDefaultWorkerPoolConfig = (
  name: string,
  workerScript: string,
  workerType: string
): WorkerPoolConfig => ({
  name,
  workerScript,
  workerType,
  inputSchema: {} as any, // Will be overridden
  outputSchema: {} as any, // Will be overridden
  
  // Pool sizing
  minWorkers: 1,
  maxWorkers: 4,
  initialWorkers: 2,
  strategy: 'dynamic',
  
  // Performance
  maxConcurrentRequests: 4,
  requestTimeout: 30000 as Duration,
  idleTimeout: 300000 as Duration,
  
  // Queue and backpressure
  maxQueueSize: 1000,
  maxHighPriorityQueueSize: 100,
  backpressureStrategy: 'reject' as BackpressureStrategy,
  backpressureTimeout: 30000 as Duration,
  
  // Load balancing
  loadBalanceStrategy: 'least-busy',
  
  // Health monitoring
  healthCheckInterval: 30000 as Duration,
  healthCheckTimeout: 5000 as Duration,
  maxConsecutiveFailures: 3,
  
  // Auto-scaling
  scaleUpThreshold: 80,
  scaleDownThreshold: 20,
  scaleUpCooldown: 60000 as Duration,
  scaleDownCooldown: 300000 as Duration,
  
  // Features
  enableSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
  enableTransferableObjects: typeof ArrayBuffer !== 'undefined',
  enableMetrics: true,
  enableProfiling: false,
  enableRetries: true,
  
  // Debug
  debugMode: false,
})

/**
 * Create empty pool metrics
 */
export const createEmptyPoolMetrics = (): PoolMetrics => ({
  totalWorkers: 0,
  activeWorkers: 0,
  idleWorkers: 0,
  unhealthyWorkers: 0,
  initializingWorkers: 0,
  terminatedWorkers: 0,
  totalRequests: 0,
  completedRequests: 0,
  failedRequests: 0,
  timeoutRequests: 0,
  retryRequests: 0,
  averageResponseTime: 0,
  queueLength: 0,
  queueUtilization: 0,
  averageQueueTime: 0,
  maxQueueLength: 0,
  totalMemoryUsage: 0,
  averageMemoryUsage: 0,
  peakMemoryUsage: 0,
  cpuUtilization: 0,
  scaleEvents: [],
  errorRate: 0,
  availabilityRate: 100,
  utilizationRate: 0,
  throughput: 0,
  efficiency: 100,
})

// ============================================
// Validation Utilities
// ============================================

/**
 * Validate worker pool configuration
 */
export const validateWorkerPoolConfig = (config: unknown) =>
  S.decodeUnknown(WorkerPoolConfig)(config)

/**
 * Validate worker instance
 */
export const validateWorkerInstance = (instance: unknown) =>
  S.decodeUnknown(WorkerInstance)(instance)

/**
 * Validate pool metrics
 */
export const validatePoolMetrics = (metrics: unknown) =>
  S.decodeUnknown(PoolMetrics)(metrics)

/**
 * Validate queued request
 */
export const validateQueuedRequest = (request: unknown) =>
  S.decodeUnknown(QueuedRequest)(request)

/**
 * Validate pool event
 */
export const validatePoolEvent = (event: unknown) =>
  S.decodeUnknown(PoolEvent)(event)

// ============================================
// Export Schema Collection
// ============================================

export const WorkerPoolSchemas = {
  // Core schemas
  PoolStrategy,
  LoadBalanceStrategy,
  HealthStatus,
  WorkerPoolConfig,
  WorkerInstance,
  QueuedRequest,
  PoolMetrics,
  PoolOperation,
  PoolEvent,
  RequestOptions,
  ScaleOptions,
  
  // Validators
  validateWorkerPoolConfig,
  validateWorkerInstance,
  validatePoolMetrics,
  validateQueuedRequest,
  validatePoolEvent,
  
  // Factories
  createDefaultWorkerPoolConfig,
  createEmptyPoolMetrics,
  createMessageId,
  createWorkerId,
} as const