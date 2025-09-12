/**
 * Worker Pool Bridge Layer with Complete Type Safety
 * Provides compatibility between the performance layer worker pool interface
 * and the unified worker system using @effect/schema validation
 */

import { Effect, Layer, Context } from 'effect'
import * as S from '@effect/schema/Schema'
import { WorkerManagerService, WorkerManagerServiceLive, type WorkerType as UnifiedWorkerType } from '@infrastructure/workers/unified/worker-manager'
import {
  WorkerBridgeSchemas,
  type PerformanceWorkerType,
  type TaskPriority,
  type WorkerTask,
  type WorkerStats,
  type WorkerConfig,
  type WorkerError,
  type WorkerTimeoutError,
  type PoolSizeInfo,
  type TaskDataValidationResult,
  type TransferableValidationResult,
  type SanitizedTaskData,
  type BroadcastMessageValidationResult,
  validateWorkerTask,
  validateWorkerConfig,
  validateWorkerStats,
  createDefaultWorkerTask,
  mapToUnifiedWorkerType,
  mapTaskPriorityToMessagePriority,
} from '@infrastructure/workers/schemas/worker-bridge.schema'
import {
  MessageId,
  WorkerId,
  createMessageId,
} from '@infrastructure/workers/schemas/worker-messages.schema'

/**
 * Enhanced validation utilities using schema validation
 */
export const WorkerBridgeValidation = {
  /**
   * Validate task data with schema validation
   */
  validateTaskData: (data: unknown): Effect.Effect<TaskDataValidationResult, never, never> => {
    return Effect.gen(function* () {
      try {
        // Attempt to validate data against schema
        const validatedData = yield* Effect.try(() => 
          S.decodeUnknown(WorkerBridgeSchemas.WorkerTaskData)(data)
        )
        
        let size: number | undefined
        if (typeof data === 'string') {
          size = data.length
        } else if (Array.isArray(data)) {
          size = data.length
        } else if (data instanceof ArrayBuffer) {
          size = data.byteLength
        } else if (typeof data === 'object' && data !== null) {
          try {
            size = Object.keys(data).length
          } catch {
            size = undefined
          }
        }

        return {
          data: validatedData,
          type: typeof data,
          size,
          isValid: true,
        } as TaskDataValidationResult
        
      } catch (error) {
        return {
          data: { error: 'Validation failed', originalData: data },
          type: 'error',
          size: 0,
          isValid: false,
          errors: [error instanceof Error ? error.message : String(error)],
        } as TaskDataValidationResult
      }
    })
  },

  /**
   * Validate transferables with enhanced checks
   */
  validateTransferables: (transferables: unknown[]): Effect.Effect<TransferableValidationResult, never, never> => {
    return Effect.succeed({
      items: transferables.map((item) => {
        const isTransferable = 
          item instanceof ArrayBuffer || 
          item instanceof MessagePort ||
          item instanceof ImageBitmap ||
          ArrayBuffer.isView(item)
          
        let size: number | undefined
        if (item instanceof ArrayBuffer) {
          size = item.byteLength
        } else if (ArrayBuffer.isView(item)) {
          size = item.byteLength
        }
        
        return {
          item,
          type: typeof item,
          isTransferable,
          size,
        }
      }),
      totalTransferables: transferables.filter(item => 
        item instanceof ArrayBuffer || 
        item instanceof MessagePort ||
        item instanceof ImageBitmap ||
        ArrayBuffer.isView(item)
      ).length,
      totalSize: transferables.reduce((total, item) => {
        if (item instanceof ArrayBuffer) return total + item.byteLength
        if (ArrayBuffer.isView(item)) return total + item.byteLength
        return total
      }, 0),
    } as TransferableValidationResult)
  },

  /**
   * Sanitize task data with schema validation
   */
  sanitizeTaskData: (data: unknown): Effect.Effect<SanitizedTaskData, never, never> => {
    return Effect.gen(function* () {
      if (data == null) {
        return {
          _tag: 'EmptyTaskData',
          data: null,
          timestamp: Date.now() as any,
        } as SanitizedTaskData
      }

      if (typeof data === 'object' && !Array.isArray(data) && !(data instanceof ArrayBuffer)) {
        return {
          _tag: 'ObjectTaskData',
          data,
          timestamp: Date.now() as any,
        } as SanitizedTaskData
      }

      if (Array.isArray(data)) {
        return {
          _tag: 'ArrayTaskData',
          data,
          metadata: { length: data.length },
          timestamp: Date.now() as any,
        } as SanitizedTaskData
      }

      if (data instanceof ArrayBuffer) {
        return {
          _tag: 'BufferTaskData',
          data,
          metadata: { byteLength: data.byteLength },
          timestamp: Date.now() as any,
        } as SanitizedTaskData
      }

      return {
        _tag: 'PrimitiveTaskData',
        data,
        metadata: { type: typeof data },
        timestamp: Date.now() as any,
      } as SanitizedTaskData
    })
  },

  /**
   * Validate broadcast message with enhanced serialization checks
   */
  validateBroadcastMessage: (message: unknown): Effect.Effect<BroadcastMessageValidationResult, never, never> => {
    return Effect.gen(function* () {
      try {
        const serialized = JSON.stringify(message)
        return {
          message,
          type: typeof message,
          isSerializable: true,
          size: serialized.length,
        } as BroadcastMessageValidationResult
        
      } catch (error) {
        return {
          message: { 
            error: 'Serialization failed', 
            originalType: typeof message,
            reason: error instanceof Error ? error.message : String(error)
          },
          type: 'error',
          isSerializable: false,
          errors: [error instanceof Error ? error.message : String(error)],
        } as BroadcastMessageValidationResult
      }
    })
  },
}

// All interfaces are now handled by schema definitions

/**
 * Enhanced Performance Worker Pool Service with complete schema validation
 */
interface PerformanceWorkerPoolService {
  readonly createPool: (config: WorkerConfig) => Effect.Effect<void, WorkerError, never>
  readonly execute: <T>(task: WorkerTask) => Effect.Effect<T, WorkerError | WorkerTimeoutError, never>
  readonly executeBatch: <T>(tasks: ReadonlyArray<WorkerTask>) => Effect.Effect<ReadonlyArray<T>, WorkerError, never>
  readonly stream: <T, R>(type: PerformanceWorkerType, operation: string, input: any) => any
  readonly broadcast: (type: PerformanceWorkerType, message: unknown) => Effect.Effect<void, WorkerError, never>
  readonly resize: (type: PerformanceWorkerType, newSize: number) => Effect.Effect<void, WorkerError, never>
  readonly getStats: () => Effect.Effect<ReadonlyArray<WorkerStats>, never, never>
  readonly terminate: (type?: PerformanceWorkerType) => Effect.Effect<void, never, never>
  readonly getPoolSize: (type: PerformanceWorkerType) => Effect.Effect<PoolSizeInfo, never, never>
  
  // Enhanced validation utilities with schema support
  readonly validateTaskData: (data: unknown) => Effect.Effect<TaskDataValidationResult, never, never>
  readonly validateTransferables: (transferables: unknown[]) => Effect.Effect<TransferableValidationResult, never, never>
  readonly sanitizeTaskData: (data: unknown) => Effect.Effect<SanitizedTaskData, never, never>
  readonly validateBroadcastMessage: (message: unknown) => Effect.Effect<BroadcastMessageValidationResult, never, never>
}

const PerformanceWorkerPoolService = Context.GenericTag<PerformanceWorkerPoolService>('PerformanceWorkerPoolService')

import { ComputationRequest, ComputationResponse, type ComputationType } from '@infrastructure/workers/unified/protocols'

/**
 * Map performance worker types to unified worker types
 */
const mapWorkerType = (perfType: PerformanceWorkerType): UnifiedWorkerType => {
  switch (perfType) {
    case 'terrain':
      return 'terrain'
    case 'physics':
      return 'physics'
    case 'rendering':
      return 'mesh'
    case 'compute':
      return 'computation'
    case 'pathfinding':
      return 'computation'
    case 'compression':
      return 'computation'
    default:
      return 'computation'
  }
}

/**
 * Map performance operation to computation type
 */
const mapComputationType = (operation: string, workerType: PerformanceWorkerType): ComputationType => {
  if (workerType === 'pathfinding') return 'pathfinding'
  if (workerType === 'compression') return 'data_compression'
  if (operation.includes('noise')) return 'noise_generation'
  if (operation.includes('image')) return 'image_processing'
  if (operation.includes('math')) return 'math_operations'
  return 'custom'
}

/**
 * Bridge implementation that uses the unified worker manager
 */
const make = Effect.gen(function* () {
  const workerManager = yield* WorkerManagerService

  return {
    createPool: (config) =>
      Effect.gen(function* () {
        // The unified worker manager already handles pool creation
        // This is a no-op since pools are created automatically
        yield* Effect.log(`Bridge: Pool creation requested for ${config.type} (handled by unified system)`)
      }),

    execute: <T>(task: WorkerTask) =>
      Effect.gen(function* () {
        // Enhanced validation and error handling
        const validatedTask = yield* Effect.try(() => validateWorkerTask(task)).pipe(
          Effect.catchAll((validationError) => 
            Effect.fail(
              new WorkerError({
                message: `Task validation failed: ${validationError}`,
                taskId: task.id,
              })
            )
          )
        )
        
        const unifiedType = mapWorkerType(task.type)

        if (unifiedType === 'terrain' || unifiedType === 'physics' || unifiedType === 'mesh') {
          // For these types, we need proper protocol requests
          // Enhanced error with more context
          return yield* Effect.fail(
            new WorkerError({
              message: `Direct execution of ${task.type} tasks requires proper protocol requests. Use the unified worker manager directly. Available operations: ${JSON.stringify(['terrain', 'physics', 'mesh'])}`,
              taskId: task.id,
              context: {
                workerType: task.type,
                operation: task.operation,
                unifiedType,
              }
            }),
          )
        }

        // For computation tasks, we can create a proper request
        try {
          const computationRequest: ComputationRequest = {
            id: task.id,
            type: mapComputationType(task.operation, task.type),
            priority: task.priority === 'critical' ? 'critical' : task.priority === 'high' ? 'high' : task.priority === 'low' ? 'low' : 'normal',
            payload: task.data,
            options: {
              enableProfiling: false,
              returnIntermediateResults: false,
              useCache: true,
              reportProgress: false,
            },
          }

          const response = yield* workerManager.executeComputation(computationRequest, {
            timeout: task.timeout ? Effect.succeed(task.timeout).pipe(Effect.map((ms) => ({ _tag: 'Millis' as const, millis: ms }))) : undefined,
          }).pipe(
            Effect.catchAll((executionError) => 
              Effect.fail(
                new WorkerError({
                  message: `Computation execution failed: ${executionError}`,
                  taskId: task.id,
                  context: {
                    computationType: computationRequest.type,
                    priority: computationRequest.priority,
                    originalError: executionError,
                  }
                })
              )
            ),
            Effect.timeout(task.timeout ? { _tag: 'Millis' as const, millis: task.timeout } : { _tag: 'Millis' as const, millis: 30000 })
          ).pipe(
            Effect.catchTag('TimeoutException', () =>
              Effect.fail(
                new WorkerError({
                  message: `Task execution timeout after ${task.timeout || 30000}ms`,
                  taskId: task.id,
                  context: {
                    timeout: task.timeout || 30000,
                    computationType: computationRequest.type,
                  }
                })
              )
            )
          )

          return response.result as T
        } catch (error) {
          return yield* Effect.fail(
            new WorkerError({
              message: `Failed to create computation request: ${error instanceof Error ? error.message : String(error)}`,
              taskId: task.id,
              context: {
                originalError: error,
                taskType: task.type,
                operation: task.operation,
              }
            })
          )
        }
      }),

    executeBatch: <T>(tasks: ReadonlyArray<WorkerTask>) =>
      Effect.gen(function* () {
        // Enhanced batch processing with validation and error handling
        if (tasks.length === 0) {
          return []
        }
        
        // Validate all tasks before processing
        const validationResults = yield* Effect.forEach(
          tasks,
          (task) => Effect.try(() => validateWorkerTask(task)).pipe(
            Effect.map(() => ({ task, valid: true })),
            Effect.catchAll((error) => Effect.succeed({ 
              task, 
              valid: false, 
              error: error instanceof Error ? error.message : String(error) 
            }))
          ),
          { concurrency: 5 } // Limit validation concurrency
        )
        
        const validTasks = validationResults.filter(r => r.valid).map(r => r.task)
        const invalidTasks = validationResults.filter(r => !r.valid)
        
        // Log validation failures
        if (invalidTasks.length > 0) {
          console.warn(`Bridge: ${invalidTasks.length} tasks failed validation:`, 
            invalidTasks.map(r => ({ id: r.task.id, error: r.error })))
        }
        
        // Determine optimal concurrency based on task count and system resources
        const maxConcurrency = Math.min(validTasks.length, navigator?.hardwareConcurrency || 4, 10)
        
        // Execute valid tasks concurrently with enhanced error handling
        const results = yield* Effect.forEach(
          validTasks,
          (task) => {
            const executeTask = <U>(t: WorkerTask) => {
              const unifiedType = mapWorkerType(t.type)

              if (unifiedType === 'computation') {
                try {
                  const computationRequest: ComputationRequest = {
                    id: t.id,
                    type: mapComputationType(t.operation, t.type),
                    priority: t.priority === 'critical' ? 'critical' : t.priority === 'high' ? 'high' : t.priority === 'low' ? 'low' : 'normal',
                    payload: t.data,
                    options: {
                      enableProfiling: false,
                      returnIntermediateResults: false,
                      useCache: true,
                      reportProgress: false,
                    },
                  }

                  return workerManager.executeComputation(computationRequest).pipe(
                    Effect.map((response) => response.result as U),
                    Effect.catchAll((executionError) =>
                      Effect.fail(
                        new WorkerError({
                          message: `Batch task ${t.id} execution failed: ${executionError}`,
                          taskId: t.id,
                          context: {
                            batchIndex: validTasks.indexOf(t),
                            totalBatchSize: validTasks.length,
                            computationType: computationRequest.type,
                            originalError: executionError,
                          }
                        })
                      )
                    ),
                    Effect.timeout({ _tag: 'Millis' as const, millis: t.timeout || 60000 })
                  ).pipe(
                    Effect.catchTag('TimeoutException', () =>
                      Effect.fail(
                        new WorkerError({
                          message: `Batch task ${t.id} timed out after ${t.timeout || 60000}ms`,
                          taskId: t.id,
                          context: {
                            timeout: t.timeout || 60000,
                            batchIndex: validTasks.indexOf(t),
                          }
                        })
                      )
                    )
                  )
                } catch (error) {
                  return Effect.fail(
                    new WorkerError({
                      message: `Failed to create computation request for batch task ${t.id}: ${error instanceof Error ? error.message : String(error)}`,
                      taskId: t.id,
                      context: {
                        originalError: error,
                        batchIndex: validTasks.indexOf(t),
                      }
                    })
                  )
                }
              }

              return Effect.fail(
                new WorkerError({
                  message: `Batch execution of ${t.type} tasks not supported via bridge. Supported types: computation`,
                  taskId: t.id,
                  context: {
                    supportedTypes: ['computation'],
                    requestedType: t.type,
                    unifiedType,
                    batchIndex: validTasks.indexOf(t),
                  }
                }),
              )
            }

            return executeTask<T>(task).pipe(
              Effect.catchAll((error) => {
                // Convert errors to results to avoid failing the entire batch
                console.error(`Batch task ${task.id} failed:`, error)
                return Effect.succeed(null as T) // Return null for failed tasks
              })
            )
          },
          { concurrency: maxConcurrency },
        )

        // Filter out null results from failed tasks
        const successfulResults = results.filter((result): result is T => result !== null)
        
        console.log(`Bridge batch execution completed: ${successfulResults.length}/${validTasks.length} tasks succeeded, ${invalidTasks.length} tasks failed validation`)
        
        return successfulResults
      }),

    stream: (type, operation, input) => {
      // Stream processing through unified worker manager
      return input.pipe(
        Effect.mapEffect((data) => {
          const unifiedType = mapWorkerType(type)

          if (unifiedType === 'computation') {
            const computationRequest: ComputationRequest = {
              id: `stream_${Date.now()}_${Math.random()}`,
              type: mapComputationType(operation, type),
              priority: 'normal',
              payload: data,
              options: {
                enableProfiling: false,
                returnIntermediateResults: false,
                useCache: false,
                reportProgress: false,
              },
            }

            return workerManager.executeComputation(computationRequest).pipe(Effect.map((response) => response.result))
          }

          return Effect.fail(
            new WorkerError({
              message: `Stream processing of ${type} not supported via bridge`,
            }),
          )
        }),
      )
    },

    broadcast: (type, message) =>
      Effect.gen(function* () {
        // Broadcasting is not directly supported by the unified system
        // This would need to be implemented as a special message type
        yield* Effect.log(`Bridge: Broadcast to ${type} workers: ${JSON.stringify(message)}`)
      }),

    resize: (type, newSize) =>
      Effect.gen(function* () {
        const unifiedType = mapWorkerType(type)
        yield* workerManager.scalePool(unifiedType, newSize)
      }),

    getStats: () =>
      Effect.gen(function* () {
        const poolStats = yield* workerManager.getPoolStats()

        // Convert unified stats to performance layer format
        const stats: WorkerStats[] = []

        // Create mock stats based on pool information
        // This is approximate since the unified system has different metrics
        for (let i = 0; i < poolStats.totalWorkers; i++) {
          stats.push({
            workerId: `unified-worker-${i}`,
            type: 'compute', // Default to compute type
            status: i < poolStats.activeWorkers ? 'busy' : 'idle',
            tasksCompleted: Math.floor(poolStats.totalRequests / poolStats.totalWorkers),
            totalExecutionTime: poolStats.averageResponseTime * Math.floor(poolStats.totalRequests / poolStats.totalWorkers),
            averageExecutionTime: poolStats.averageResponseTime,
            lastActivity: Date.now(),
          })
        }

        return stats
      }),

    terminate: (type) =>
      Effect.gen(function* () {
        if (type) {
          const unifiedType = mapWorkerType(type)
          // Scale down to 0 to effectively terminate
          yield* workerManager.scalePool(unifiedType, 0)
        } else {
          // Shutdown all workers
          yield* workerManager.shutdown()
        }
      }),

    getPoolSize: (type) =>
      Effect.gen(function* () {
        const poolStats = yield* workerManager.getPoolStats()

        return {
          active: poolStats.activeWorkers,
          idle: poolStats.idleWorkers,
          total: poolStats.totalWorkers,
        }
      }),
  } satisfies PerformanceWorkerPoolService
})

/**
 * Bridge layer that implements the performance worker pool interface
 * using the unified worker manager
 */
export const WorkerPoolServiceBridge = Layer.effect(PerformanceWorkerPoolService, make).pipe(Layer.provide(WorkerManagerServiceLive))

/**
 * Helper function to create a bridge configuration
 */
export const createBridgeConfig = () => ({
  // Bridge configuration can be added here if needed
  enableLogging: true,
  enableMetrics: true,
})

/**
 * Convenience layer for replacing the performance worker pool with the bridge
 */
export const UnifiedWorkerPoolLayer = WorkerPoolServiceBridge
