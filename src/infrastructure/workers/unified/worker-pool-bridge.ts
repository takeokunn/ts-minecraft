/**
 * Worker Pool Bridge Layer
 * Provides compatibility between the performance layer worker pool interface
 * and the unified worker system
 */

import { Effect, Layer, Context, Data } from 'effect'
import { WorkerManagerService, WorkerManagerServiceLive, type WorkerType as UnifiedWorkerType } from '@infrastructure/workers/unified/worker-manager'
// Legacy types recreated here to avoid dependency on deprecated worker-pool.layer.ts

export type PerformanceWorkerType = 'compute' | 'physics' | 'terrain' | 'pathfinding' | 'rendering' | 'compression'

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical'

export interface WorkerTask {
  id: string
  type: PerformanceWorkerType
  operation: string
  data: unknown
  transferables?: unknown[]
  priority: TaskPriority
  timeout?: number
}

export interface WorkerStats {
  workerId: string
  type: PerformanceWorkerType
  status: 'idle' | 'busy' | 'error'
  tasksCompleted: number
  totalExecutionTime: number
  averageExecutionTime: number
  currentTask?: string
  lastActivity: number
}

export class WorkerError extends Data.TaggedError('WorkerError')<{
  readonly message: string
  readonly workerId?: string
  readonly taskId?: string
}> {}

export class WorkerTimeoutError extends Data.TaggedError('WorkerTimeoutError')<{
  readonly message: string
  readonly taskId: string
  readonly timeout: number
}> {}

export interface WorkerConfig {
  type: PerformanceWorkerType
  scriptUrl: string
  minWorkers: number
  maxWorkers: number
  idleTimeout: number
  maxTasksPerWorker: number
  enableSharedMemory: boolean
}

interface PerformanceWorkerPoolService {
  readonly createPool: (config: WorkerConfig) => Effect.Effect<void, WorkerError>
  readonly execute: <T>(task: WorkerTask) => Effect.Effect<T, WorkerError | WorkerTimeoutError>
  readonly executeBatch: <T>(tasks: ReadonlyArray<WorkerTask>) => Effect.Effect<ReadonlyArray<T>, WorkerError>
  readonly stream: <T, R>(type: PerformanceWorkerType, operation: string, input: any) => any
  readonly broadcast: (type: PerformanceWorkerType, message: unknown) => Effect.Effect<void>
  readonly resize: (type: PerformanceWorkerType, newSize: number) => Effect.Effect<void>
  readonly getStats: () => Effect.Effect<ReadonlyArray<WorkerStats>>
  readonly terminate: (type?: PerformanceWorkerType) => Effect.Effect<void>
  readonly getPoolSize: (type: PerformanceWorkerType) => Effect.Effect<{
    active: number
    idle: number
    total: number
  }>
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
        const unifiedType = mapWorkerType(task.type)
        
        if (unifiedType === 'terrain' || unifiedType === 'physics' || unifiedType === 'mesh') {
          // For these types, we need proper protocol requests
          // For now, return an error since we can't convert arbitrary data
          return yield* Effect.fail(
            new WorkerError({
              message: `Direct execution of ${task.type} tasks requires proper protocol requests. Use the unified worker manager directly.`,
              taskId: task.id,
            })
          )
        }

        // For computation tasks, we can create a proper request
        const computationRequest: ComputationRequest = {
          id: task.id,
          type: mapComputationType(task.operation, task.type),
          priority: task.priority === 'critical' ? 'critical' : 
                   task.priority === 'high' ? 'high' :
                   task.priority === 'low' ? 'low' : 'normal',
          payload: task.data,
          options: {
            enableProfiling: false,
            returnIntermediateResults: false,
            useCache: true,
            reportProgress: false,
          },
        }

        const response = yield* workerManager.executeComputation(computationRequest, {
          timeout: task.timeout ? Effect.succeed(task.timeout).pipe(Effect.map(ms => ({ _tag: 'Millis' as const, millis: ms }))) : undefined,
        })

        return response.result as T
      }),

    executeBatch: <T>(tasks: ReadonlyArray<WorkerTask>) =>
      Effect.gen(function* () {
        // Execute tasks concurrently
        const results = yield* Effect.forEach(
          tasks,
          (task) => {
            const self = {
              execute: <U>(t: WorkerTask) => {
                const unifiedType = mapWorkerType(t.type)
                
                if (unifiedType === 'computation') {
                  const computationRequest: ComputationRequest = {
                    id: t.id,
                    type: mapComputationType(t.operation, t.type),
                    priority: t.priority === 'critical' ? 'critical' : 
                             t.priority === 'high' ? 'high' :
                             t.priority === 'low' ? 'low' : 'normal',
                    payload: t.data,
                    options: {
                      enableProfiling: false,
                      returnIntermediateResults: false,
                      useCache: true,
                      reportProgress: false,
                    },
                  }

                  return workerManager.executeComputation(computationRequest).pipe(
                    Effect.map(response => response.result as U)
                  )
                }

                return Effect.fail(
                  new WorkerError({
                    message: `Batch execution of ${t.type} tasks not supported via bridge`,
                    taskId: t.id,
                  })
                )
              }
            }
            
            return self.execute<T>(task)
          },
          { concurrency: 'unbounded' }
        )

        return results
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

            return workerManager.executeComputation(computationRequest).pipe(
              Effect.map(response => response.result)
            )
          }

          return Effect.fail(
            new WorkerError({
              message: `Stream processing of ${type} not supported via bridge`,
            })
          )
        })
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
export const WorkerPoolServiceBridge = Layer.effect(PerformanceWorkerPoolService, make).pipe(
  Layer.provide(WorkerManagerServiceLive)
)

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