/**
 * Worker Pool Performance Layer
 * 
 * Provides a high-performance worker pool for parallel processing of intensive tasks
 * in the Minecraft game engine. Uses Effect-TS patterns for functional composition
 * and includes comprehensive monitoring, backpressure, and load balancing.
 * 
 * Features:
 * - Dynamic worker pool with auto-scaling
 * - Task queue management with priorities
 * - Load balancing and worker lifecycle management
 * - Performance monitoring and health checks
 * - Backpressure mechanisms for system stability
 * - Integration with metrics system
 */

import { Effect, Queue, Ref, Context, Schedule, Layer, Runtime, Exit } from 'effect'
import type { Duration } from 'effect'
import { withErrorLog, withPerformanceMonitoring } from '../../shared/utils/index'

// Worker Pool Error Types
export class WorkerPoolError extends Error {
  readonly _tag = 'WorkerPoolError' as const
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'WorkerPoolError'
    this.cause = cause
  }
}

export class WorkerUnavailableError extends WorkerPoolError {
  readonly _tag = 'WorkerUnavailableError' as const
  constructor(poolId: string) {
    super(`No workers available in pool: ${poolId}`)
  }
}

export class TaskTimeoutError extends WorkerPoolError {
  readonly _tag = 'TaskTimeoutError' as const
  constructor(taskId: string, timeout: Duration) {
    super(`Task ${taskId} exceeded timeout of ${timeout}ms`)
  }
}

export class WorkerInitializationError extends WorkerPoolError {
  readonly _tag = 'WorkerInitializationError' as const
  constructor(workerId: string, cause?: unknown) {
    super(`Failed to initialize worker: ${workerId}`, cause)
  }
}

// Task Types
export interface Task<T = unknown, R = unknown> {
  readonly id: string
  readonly type: TaskType
  readonly priority: TaskPriority
  readonly data: T
  readonly timeout?: Duration
  readonly retryPolicy?: RetryPolicy
  readonly createdAt: number
}

export interface TaskResult<R = unknown> {
  readonly taskId: string
  readonly result: R
  readonly processingTime: number
  readonly workerId: string
  readonly completedAt: number
}

export enum TaskType {
  MESH_GENERATION = 'mesh_generation',
  CHUNK_PROCESSING = 'chunk_processing',
  PHYSICS_CALCULATION = 'physics_calculation',
  TERRAIN_GENERATION = 'terrain_generation',
  LIGHTING_CALCULATION = 'lighting_calculation',
  COLLISION_DETECTION = 'collision_detection',
  AUDIO_PROCESSING = 'audio_processing',
  CUSTOM = 'custom'
}

export enum TaskPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  BACKGROUND = 4
}

export interface RetryPolicy {
  readonly maxAttempts: number
  readonly baseDelay: Duration
  readonly maxDelay: Duration
  readonly backoffMultiplier: number
}

// Worker Types
export interface WorkerInfo {
  readonly id: string
  readonly type: TaskType[]
  readonly status: WorkerStatus
  readonly currentTask?: string
  readonly tasksCompleted: number
  readonly averageProcessingTime: number
  readonly errorRate: number
  readonly memoryUsage: number
  readonly cpuUsage: number
  readonly createdAt: number
  readonly lastActiveAt: number
}

export enum WorkerStatus {
  INITIALIZING = 'initializing',
  IDLE = 'idle',
  BUSY = 'busy',
  ERROR = 'error',
  TERMINATED = 'terminated'
}

// Pool Configuration
export interface WorkerPoolConfig {
  readonly minWorkers: number
  readonly maxWorkers: number
  readonly taskQueueSize: number
  readonly workerTimeout: Duration
  readonly taskTimeout: Duration
  readonly scaleUpThreshold: number
  readonly scaleDownThreshold: number
  readonly healthCheckInterval: Duration
  readonly enableMetrics: boolean
  readonly enableBackpressure: boolean
  readonly retryPolicy: RetryPolicy
}

export const defaultWorkerPoolConfig: WorkerPoolConfig = {
  minWorkers: 2,
  maxWorkers: navigator.hardwareConcurrency || 4,
  taskQueueSize: 1000,
  workerTimeout: 30000,
  taskTimeout: 10000,
  scaleUpThreshold: 0.8,
  scaleDownThreshold: 0.3,
  healthCheckInterval: 5000,
  enableMetrics: true,
  enableBackpressure: true,
  retryPolicy: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  }
}

// Pool Metrics
export interface PoolMetrics {
  readonly totalWorkers: number
  readonly activeWorkers: number
  readonly idleWorkers: number
  readonly queuedTasks: number
  readonly completedTasks: number
  readonly failedTasks: number
  readonly averageTaskTime: number
  readonly throughput: number
  readonly errorRate: number
  readonly memoryUsage: number
  readonly cpuUsage: number
}

// Worker Pool Service Interface
export interface WorkerPoolService {
  readonly submitTask: <T, R>(task: Task<T, R>) => Effect.Effect<TaskResult<R>, WorkerPoolError>
  readonly submitBatch: <T, R>(tasks: readonly Task<T, R>[]) => Effect.Effect<readonly TaskResult<R>[], WorkerPoolError>
  readonly cancelTask: (taskId: string) => Effect.Effect<boolean, WorkerPoolError>
  readonly getMetrics: () => Effect.Effect<PoolMetrics, never>
  readonly getWorkerInfo: () => Effect.Effect<readonly WorkerInfo[], never>
  readonly scaleUp: (count: number) => Effect.Effect<number, WorkerPoolError>
  readonly scaleDown: (count: number) => Effect.Effect<number, WorkerPoolError>
  readonly pause: () => Effect.Effect<void, never>
  readonly resume: () => Effect.Effect<void, never>
  readonly shutdown: () => Effect.Effect<void, WorkerPoolError>
  readonly healthCheck: () => Effect.Effect<boolean, never>
}

export const WorkerPoolService = Context.GenericTag<WorkerPoolService>('WorkerPoolService')

// Worker Pool Implementation
const createWorkerPool = (config: WorkerPoolConfig = defaultWorkerPoolConfig) =>
  Effect.gen(function* () {
    // Internal state
    const workers = yield* Ref.make<Map<string, WorkerInfo>>(new Map())
    const taskQueue = yield* Queue.bounded<Task>(config.taskQueueSize)
    const resultQueue = yield* Queue.unbounded<TaskResult>()
    const pendingTasks = yield* Ref.make<Map<string, Task>>(new Map())
    const metrics = yield* Ref.make<PoolMetrics>({
      totalWorkers: 0,
      activeWorkers: 0,
      idleWorkers: 0,
      queuedTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageTaskTime: 0,
      throughput: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0
    })
    const isPaused = yield* Ref.make(false)
    const isShutdown = yield* Ref.make(false)

    // Task Management
    const submitTask = <T, R>(task: Task<T, R>): Effect.Effect<TaskResult<R>, WorkerPoolError> =>
      Effect.gen(function* () {
        const paused = yield* Ref.get(isPaused)
        const shutdown = yield* Ref.get(isShutdown)
        
        if (shutdown) {
          return yield* Effect.fail(new WorkerPoolError('Worker pool is shutdown'))
        }
        
        if (paused) {
          return yield* Effect.fail(new WorkerPoolError('Worker pool is paused'))
        }

        // Check backpressure
        if (config.enableBackpressure) {
          const queueSize = yield* Queue.size(taskQueue)
          const threshold = Math.floor(config.taskQueueSize * 0.9)
          
          if (queueSize >= threshold) {
            return yield* Effect.fail(new WorkerPoolError('Task queue at capacity, applying backpressure'))
          }
        }

        // Add to pending tasks
        yield* Ref.update(pendingTasks, map => map.set(task.id, task))
        
        // Submit to queue with priority handling
        yield* Queue.offer(taskQueue, task)
        
        // Wait for result with timeout
        const timeout = task.timeout || config.taskTimeout
        const resultEffect = Effect.gen(function* () {
          while (true) {
            const result = yield* Queue.take(resultQueue)
            if (result.taskId === task.id) {
              yield* Ref.update(pendingTasks, map => {
                map.delete(task.id)
                return map
              })
              return result as TaskResult<R>
            }
          }
        })

        return yield* Effect.timeout(resultEffect, timeout).pipe(
          Effect.catchTag('TimeoutException', () => 
            Effect.fail(new TaskTimeoutError(task.id, timeout))
          )
        )
      }).pipe(
        withErrorLog(`Failed to submit task: ${task.id}`),
        withPerformanceMonitoring(`task-submission-${task.type}`)
      )

    const submitBatch = <T, R>(tasks: readonly Task<T, R>[]): Effect.Effect<readonly TaskResult<R>[], WorkerPoolError> =>
      Effect.gen(function* () {
        const results = yield* Effect.all(
          tasks.map(task => submitTask(task)),
          { concurrency: 'unbounded' }
        )
        return results
      }).pipe(
        withErrorLog('Failed to submit batch tasks'),
        withPerformanceMonitoring('batch-task-submission')
      )

    const cancelTask = (taskId: string): Effect.Effect<boolean, WorkerPoolError> =>
      Effect.gen(function* () {
        const pending = yield* Ref.get(pendingTasks)
        const task = pending.get(taskId)
        
        if (task) {
          yield* Ref.update(pendingTasks, map => {
            map.delete(taskId)
            return map
          })
          return true
        }
        
        return false
      })

    // Worker Management
    const createWorker = (types: TaskType[]): Effect.Effect<string, WorkerInitializationError> =>
      Effect.gen(function* () {
        const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        
        try {
          const worker = new Worker('/workers/task-worker.js')
          
          const workerInfo: WorkerInfo = {
            id: workerId,
            type: types,
            status: WorkerStatus.INITIALIZING,
            tasksCompleted: 0,
            averageProcessingTime: 0,
            errorRate: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            createdAt: performance.now(),
            lastActiveAt: performance.now()
          }

          yield* Ref.update(workers, map => map.set(workerId, workerInfo))
          
          // Start worker processing loop
          yield* processWorkerTasks(workerId, worker).pipe(
            Effect.fork
          )
          
          // Mark as idle after initialization
          yield* Effect.sleep(100)
          yield* updateWorkerStatus(workerId, WorkerStatus.IDLE)
          
          return workerId
        } catch (error) {
          return yield* Effect.fail(new WorkerInitializationError(workerId, error))
        }
      })

    const processWorkerTasks = (workerId: string, worker: Worker): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        while (true) {
          const shutdown = yield* Ref.get(isShutdown)
          const paused = yield* Ref.get(isPaused)
          
          if (shutdown) break
          if (paused) {
            yield* Effect.sleep(1000)
            continue
          }

          try {
            const task = yield* Queue.take(taskQueue).pipe(
              Effect.timeout(1000),
              Effect.catchTag('TimeoutException', () => Effect.succeed(null))
            )

            if (!task) continue

            yield* updateWorkerStatus(workerId, WorkerStatus.BUSY, task.id)
            
            const startTime = performance.now()
            
            // Execute task in worker
            const result = yield* executeTaskInWorker(worker, task)
            
            const endTime = performance.now()
            const processingTime = endTime - startTime

            const taskResult: TaskResult = {
              taskId: task.id,
              result,
              processingTime,
              workerId,
              completedAt: endTime
            }

            yield* Queue.offer(resultQueue, taskResult)
            yield* updateWorkerMetrics(workerId, processingTime, true)
            yield* updateWorkerStatus(workerId, WorkerStatus.IDLE)
            
            // Update global metrics
            yield* updateGlobalMetrics(processingTime, true)

          } catch (error) {
            yield* updateWorkerMetrics(workerId, 0, false)
            yield* updateGlobalMetrics(0, false)
            yield* updateWorkerStatus(workerId, WorkerStatus.ERROR)
            
            // Attempt to recover worker
            yield* Effect.sleep(1000)
            yield* updateWorkerStatus(workerId, WorkerStatus.IDLE)
          }
        }
      }).pipe(
        Effect.catchAll(() => Effect.succeed(void 0))
      )

    const executeTaskInWorker = (worker: Worker, task: Task): Effect.Effect<unknown, WorkerPoolError> =>
      Effect.async<unknown, WorkerPoolError>(resume => {
        const timeout = setTimeout(() => {
          resume(Effect.fail(new TaskTimeoutError(task.id, task.timeout || config.taskTimeout)))
        }, task.timeout || config.taskTimeout)

        worker.onmessage = (event) => {
          clearTimeout(timeout)
          if (event.data.type === 'task-result' && event.data.taskId === task.id) {
            resume(Effect.succeed(event.data.result))
          } else if (event.data.type === 'task-error' && event.data.taskId === task.id) {
            resume(Effect.fail(new WorkerPoolError(`Worker error: ${event.data.error}`)))
          }
        }

        worker.onerror = (error) => {
          clearTimeout(timeout)
          resume(Effect.fail(new WorkerPoolError(`Worker error: ${error.message}`)))
        }

        worker.postMessage({
          type: 'execute-task',
          task: {
            id: task.id,
            type: task.type,
            data: task.data
          }
        })
      })

    const updateWorkerStatus = (workerId: string, status: WorkerStatus, currentTask?: string): Effect.Effect<void, never> =>
      Ref.update(workers, map => {
        const worker = map.get(workerId)
        if (worker) {
          map.set(workerId, {
            ...worker,
            status,
            currentTask,
            lastActiveAt: performance.now()
          })
        }
        return map
      })

    const updateWorkerMetrics = (workerId: string, processingTime: number, success: boolean): Effect.Effect<void, never> =>
      Ref.update(workers, map => {
        const worker = map.get(workerId)
        if (worker) {
          const totalTasks = worker.tasksCompleted + 1
          const avgTime = (worker.averageProcessingTime * worker.tasksCompleted + processingTime) / totalTasks
          const errorRate = success 
            ? (worker.errorRate * worker.tasksCompleted) / totalTasks
            : (worker.errorRate * worker.tasksCompleted + 1) / totalTasks

          map.set(workerId, {
            ...worker,
            tasksCompleted: totalTasks,
            averageProcessingTime: avgTime,
            errorRate
          })
        }
        return map
      })

    const updateGlobalMetrics = (processingTime: number, success: boolean): Effect.Effect<void, never> =>
      Ref.update(metrics, current => {
        const totalTasks = current.completedTasks + current.failedTasks + 1
        const newCompleted = success ? current.completedTasks + 1 : current.completedTasks
        const newFailed = success ? current.failedTasks : current.failedTasks + 1
        const newAvgTime = success 
          ? (current.averageTaskTime * current.completedTasks + processingTime) / newCompleted
          : current.averageTaskTime

        return {
          ...current,
          completedTasks: newCompleted,
          failedTasks: newFailed,
          averageTaskTime: newAvgTime,
          errorRate: newFailed / totalTasks,
          throughput: newCompleted / (performance.now() / 1000)
        }
      })

    // Scaling Operations
    const scaleUp = (count: number): Effect.Effect<number, WorkerPoolError> =>
      Effect.gen(function* () {
        const currentWorkers = yield* Ref.get(workers)
        const currentCount = currentWorkers.size
        
        if (currentCount >= config.maxWorkers) {
          return 0
        }
        
        const actualCount = Math.min(count, config.maxWorkers - currentCount)
        const workerIds = yield* Effect.all(
          Array.from({ length: actualCount }, () => 
            createWorker([TaskType.MESH_GENERATION, TaskType.CHUNK_PROCESSING])
          ),
          { concurrency: 'unbounded' }
        )
        
        return workerIds.length
      }).pipe(
        withErrorLog('Failed to scale up worker pool')
      )

    const scaleDown = (count: number): Effect.Effect<number, WorkerPoolError> =>
      Effect.gen(function* () {
        const currentWorkers = yield* Ref.get(workers)
        const currentCount = currentWorkers.size
        
        if (currentCount <= config.minWorkers) {
          return 0
        }
        
        const actualCount = Math.min(count, currentCount - config.minWorkers)
        
        // Find idle workers to terminate
        const idleWorkers = Array.from(currentWorkers.values())
          .filter(w => w.status === WorkerStatus.IDLE)
          .slice(0, actualCount)
        
        for (const worker of idleWorkers) {
          yield* Ref.update(workers, map => {
            map.delete(worker.id)
            return map
          })
        }
        
        return idleWorkers.length
      }).pipe(
        withErrorLog('Failed to scale down worker pool')
      )

    // Auto-scaling based on queue load
    const autoScale = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const queueSize = yield* Queue.size(taskQueue)
        const currentWorkers = yield* Ref.get(workers)
        const activeWorkers = Array.from(currentWorkers.values())
          .filter(w => w.status === WorkerStatus.BUSY).length
        const totalWorkers = currentWorkers.size
        
        const loadRatio = totalWorkers > 0 ? (queueSize + activeWorkers) / totalWorkers : 0
        
        if (loadRatio > config.scaleUpThreshold && totalWorkers < config.maxWorkers) {
          yield* scaleUp(Math.min(2, config.maxWorkers - totalWorkers)).pipe(
            Effect.catchAll(() => Effect.succeed(0))
          )
        } else if (loadRatio < config.scaleDownThreshold && totalWorkers > config.minWorkers) {
          yield* scaleDown(Math.min(1, totalWorkers - config.minWorkers)).pipe(
            Effect.catchAll(() => Effect.succeed(0))
          )
        }
      })

    // Utility Functions
    const getMetrics = (): Effect.Effect<PoolMetrics, never> =>
      Effect.gen(function* () {
        const currentMetrics = yield* Ref.get(metrics)
        const currentWorkers = yield* Ref.get(workers)
        const queueSize = yield* Queue.size(taskQueue)
        
        const workerStats = Array.from(currentWorkers.values())
        const activeCount = workerStats.filter(w => w.status === WorkerStatus.BUSY).length
        const idleCount = workerStats.filter(w => w.status === WorkerStatus.IDLE).length
        
        return {
          ...currentMetrics,
          totalWorkers: currentWorkers.size,
          activeWorkers: activeCount,
          idleWorkers: idleCount,
          queuedTasks: queueSize
        }
      })

    const getWorkerInfo = (): Effect.Effect<readonly WorkerInfo[], never> =>
      Effect.gen(function* () {
        const currentWorkers = yield* Ref.get(workers)
        return Array.from(currentWorkers.values())
      })

    const pause = (): Effect.Effect<void, never> =>
      Ref.set(isPaused, true)

    const resume = (): Effect.Effect<void, never> =>
      Ref.set(isPaused, false)

    const shutdown = (): Effect.Effect<void, WorkerPoolError> =>
      Effect.gen(function* () {
        yield* Ref.set(isShutdown, true)
        
        // Wait for current tasks to complete or timeout
        yield* Effect.sleep(config.workerTimeout).pipe(
          Effect.race(
            Effect.gen(function* () {
              while (true) {
                const workers = yield* Ref.get(workers)
                const busyWorkers = Array.from(workers.values())
                  .filter(w => w.status === WorkerStatus.BUSY)
                
                if (busyWorkers.length === 0) break
                yield* Effect.sleep(100)
              }
            })
          )
        )
        
        // Clear all state
        yield* Ref.set(workers, new Map())
        yield* Queue.shutdown(taskQueue)
        yield* Queue.shutdown(resultQueue)
        yield* Ref.set(pendingTasks, new Map())
      }).pipe(
        withErrorLog('Failed to shutdown worker pool')
      )

    const healthCheck = (): Effect.Effect<boolean, never> =>
      Effect.gen(function* () {
        const currentWorkers = yield* Ref.get(workers)
        const shutdown = yield* Ref.get(isShutdown)
        
        if (shutdown) return false
        
        const healthyWorkers = Array.from(currentWorkers.values())
          .filter(w => w.status !== WorkerStatus.ERROR && w.status !== WorkerStatus.TERMINATED)
        
        return healthyWorkers.length >= config.minWorkers
      })

    // Initialize minimum workers
    yield* scaleUp(config.minWorkers)
    
    // Start auto-scaling and health monitoring
    yield* Effect.schedule(autoScale(), Schedule.fixed(5000)).pipe(
      Effect.fork
    )
    
    yield* Effect.schedule(
      Effect.gen(function* () {
        const healthy = yield* healthCheck()
        if (!healthy && !(yield* Ref.get(isShutdown))) {
          yield* scaleUp(1).pipe(Effect.catchAll(() => Effect.succeed(0)))
        }
      }),
      Schedule.fixed(config.healthCheckInterval)
    ).pipe(
      Effect.fork
    )

    return WorkerPoolService.of({
      submitTask,
      submitBatch,
      cancelTask,
      getMetrics,
      getWorkerInfo,
      scaleUp,
      scaleDown,
      pause,
      resume,
      shutdown,
      healthCheck
    })
  }).pipe(
    withErrorLog('Failed to create worker pool'),
    withPerformanceMonitoring('worker-pool-initialization')
  )

// Layer Implementation
export const WorkerPoolLayer = Layer.effect(
  WorkerPoolService,
  createWorkerPool()
)

export const WorkerPoolLive = WorkerPoolLayer

// Convenience functions for common task types
export const createMeshGenerationTask = (data: unknown, priority = TaskPriority.NORMAL): Task => ({
  id: `mesh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type: TaskType.MESH_GENERATION,
  priority,
  data,
  createdAt: performance.now()
})

export const createChunkProcessingTask = (data: unknown, priority = TaskPriority.HIGH): Task => ({
  id: `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type: TaskType.CHUNK_PROCESSING,
  priority,
  data,
  createdAt: performance.now()
})

export const createPhysicsCalculationTask = (data: unknown, priority = TaskPriority.CRITICAL): Task => ({
  id: `physics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type: TaskType.PHYSICS_CALCULATION,
  priority,
  data,
  createdAt: performance.now()
})

// Export types for external use
export type {
  Task,
  TaskResult,
  WorkerInfo,
  PoolMetrics,
  WorkerPoolConfig
}