/**
 * Worker Pool System (Effect-TS Implementation)
 * Efficient Web Worker management with task queuing and load balancing
 * 
 * DEPRECATED: This implementation is being replaced by the unified worker system.
 * Use WorkerPoolServiceBridge for compatibility or migrate to the unified worker system.
 */

import { Effect, Context, Layer, Queue, Ref, Fiber, Duration, Schedule, Deferred, HashMap, Option, pipe, Metric, Chunk, Stream } from 'effect'
import * as S from 'effect/Schema'

// ============================================================================
// Schema Definitions
// ============================================================================

export const WorkerType = S.Literal('compute', 'physics', 'terrain', 'pathfinding', 'rendering', 'compression')
export type WorkerType = S.Schema.Type<typeof WorkerType>

export const TaskPriority = S.Literal('low', 'normal', 'high', 'critical')
export type TaskPriority = S.Schema.Type<typeof TaskPriority>

export const WorkerTask = S.Struct({
  id: S.String,
  type: WorkerType,
  operation: S.String,
  data: S.Unknown,
  transferables: S.optional(S.Array(S.Unknown)),
  priority: TaskPriority,
  timeout: S.optional(S.Number),
})
export type WorkerTask = S.Schema.Type<typeof WorkerTask>

export const WorkerConfig = S.Struct({
  type: WorkerType,
  scriptUrl: S.String,
  minWorkers: S.Number,
  maxWorkers: S.Number,
  idleTimeout: S.Number, // milliseconds
  maxTasksPerWorker: S.Number,
  enableSharedMemory: S.Boolean,
})
export type WorkerConfig = S.Schema.Type<typeof WorkerConfig>

export const WorkerStats = S.Struct({
  workerId: S.String,
  type: WorkerType,
  status: S.Literal('idle', 'busy', 'error'),
  tasksCompleted: S.Number,
  totalExecutionTime: S.Number,
  averageExecutionTime: S.Number,
  currentTask: S.optional(S.String),
  lastActivity: S.Number,
})
export type WorkerStats = S.Schema.Type<typeof WorkerStats>

// ============================================================================
// Error Definitions
// ============================================================================

export class WorkerError extends S.TaggedError<WorkerError>()('WorkerError', {
  message: S.String,
  workerId: S.optional(S.String),
  taskId: S.optional(S.String),
}) {}

export class WorkerTimeoutError extends S.TaggedError<WorkerTimeoutError>()('WorkerTimeoutError', {
  message: S.String,
  taskId: S.String,
  timeout: S.Number,
}) {}

// ============================================================================
// Worker Pool Service
// ============================================================================

export interface WorkerPoolService {
  readonly createPool: (config: WorkerConfig) => Effect.Effect<void, WorkerError>

  readonly execute: <T>(task: WorkerTask) => Effect.Effect<T, WorkerError | WorkerTimeoutError>

  readonly executeBatch: <T>(tasks: ReadonlyArray<WorkerTask>) => Effect.Effect<ReadonlyArray<T>, WorkerError>

  readonly stream: <T, R>(type: WorkerType, operation: string, input: Stream.Stream<T>) => Stream.Stream<R, WorkerError>

  readonly broadcast: (type: WorkerType, message: unknown) => Effect.Effect<void>

  readonly resize: (type: WorkerType, newSize: number) => Effect.Effect<void>

  readonly getStats: () => Effect.Effect<ReadonlyArray<WorkerStats>>

  readonly terminate: (type?: WorkerType) => Effect.Effect<void>

  readonly getPoolSize: (type: WorkerType) => Effect.Effect<{
    active: number
    idle: number
    total: number
  }>
}

export const WorkerPoolService = Context.GenericTag<WorkerPoolService>('WorkerPoolService')

// ============================================================================
// Worker Instance
// ============================================================================

interface WorkerInstance {
  id: string
  type: WorkerType
  worker: Worker
  status: 'idle' | 'busy' | 'error'
  currentTask?: string
  stats: {
    tasksCompleted: number
    totalExecutionTime: number
    lastActivity: number
  }
}

// ============================================================================
// Worker Pool Implementation
// ============================================================================

export const WorkerPoolServiceLive = Layer.effect(
  WorkerPoolService,
  Effect.gen(function* () {
    const pools = yield* Ref.make(
      HashMap.empty<
        WorkerType,
        {
          config: WorkerConfig
          workers: WorkerInstance[]
          taskQueue: Queue.Queue<{
            task: WorkerTask
            deferred: Deferred.Deferred<unknown, WorkerError | WorkerTimeoutError>
          }>
          idleWorkers: Queue.Queue<WorkerInstance>
        }
      >(),
    )

    let workerIdCounter = 0

    const createWorker = (config: WorkerConfig): WorkerInstance => {
      const id = `worker_${config.type}_${++workerIdCounter}`
      const worker = new Worker(config.scriptUrl)

      return {
        id,
        type: config.type,
        worker,
        status: 'idle',
        stats: {
          tasksCompleted: 0,
          totalExecutionTime: 0,
          lastActivity: Date.now(),
        },
      }
    }

    const createPool = (config: WorkerConfig) =>
      Effect.gen(function* () {
        const existingPool = yield* Ref.get(pools).pipe(Effect.map((map) => HashMap.get(map, config.type)))

        if (Option.isSome(existingPool)) {
          return yield* Effect.fail(
            new WorkerError({
              message: `Worker pool for type ${config.type} already exists`,
            }),
          )
        }

        // Create task queue
        const taskQueue = yield* Queue.unbounded<{
          task: WorkerTask
          deferred: Deferred.Deferred<unknown, WorkerError | WorkerTimeoutError>
        }>()

        // Create idle worker queue
        const idleWorkers = yield* Queue.unbounded<WorkerInstance>()

        // Create initial workers
        const workers: WorkerInstance[] = []
        for (let i = 0; i < config.minWorkers; i++) {
          const worker = createWorker(config)
          workers.push(worker)
          yield* Queue.offer(idleWorkers, worker)

          // Set up message handler
          worker.worker.onmessage = (event) => {
            const { taskId, result, error } = event.data

            // Handle task completion
            // This would need to be connected to the deferred resolution
          }

          worker.worker.onerror = (error) => {
            worker.status = 'error'
            console.error(`Worker ${worker.id} error:`, error)
          }
        }

        // Store pool
        yield* Ref.update(pools, (map) =>
          HashMap.set(map, config.type, {
            config,
            workers,
            taskQueue,
            idleWorkers,
          }),
        )

        // Start task processor
        yield* Effect.fork(
          Effect.forever(
            Effect.gen(function* () {
              const poolData = yield* Ref.get(pools).pipe(Effect.map((map) => HashMap.get(map, config.type)))

              if (Option.isNone(poolData)) return

              const pool = poolData.value
              const { task, deferred } = yield* Queue.take(pool.taskQueue)

              // Get idle worker or create new one if needed
              let worker: WorkerInstance | undefined

              const idleWorker = yield* Queue.poll(pool.idleWorkers)
              if (Option.isSome(idleWorker)) {
                worker = idleWorker.value
              } else if (pool.workers.length < config.maxWorkers) {
                worker = createWorker(config)
                pool.workers.push(worker)
              } else {
                // Wait for idle worker
                worker = yield* Queue.take(pool.idleWorkers)
              }

              // Execute task
              worker.status = 'busy'
              worker.currentTask = task.id
              const startTime = performance.now()

              // Create message handler for this specific task
              const messageHandler = (event: MessageEvent) => {
                if (event.data.taskId === task.id) {
                  const executionTime = performance.now() - startTime

                  worker!.stats.tasksCompleted++
                  worker!.stats.totalExecutionTime += executionTime
                  worker!.stats.lastActivity = Date.now()
                  worker!.status = 'idle'
                  worker!.currentTask = undefined

                  // Return worker to idle pool
                  Effect.runSync(Queue.offer(pool.idleWorkers, worker!))

                  // Remove handler
                  worker!.worker.removeEventListener('message', messageHandler)

                  // Resolve deferred
                  if (event.data.error) {
                    Effect.runSync(
                      Deferred.fail(
                        deferred,
                        new WorkerError({
                          message: event.data.error,
                          workerId: worker!.id,
                          taskId: task.id,
                        }),
                      ),
                    )
                  } else {
                    Effect.runSync(Deferred.succeed(deferred, event.data.result))
                  }

                  // Update metrics
                  Effect.runSync(Metric.update(workerMetrics.taskExecutionTime.tagged('type', config.type), executionTime))
                }
              }

              worker.worker.addEventListener('message', messageHandler)

              // Send task to worker
              worker.worker.postMessage(
                {
                  taskId: task.id,
                  operation: task.operation,
                  data: task.data,
                },
                task.transferables || [],
              )

              // Handle timeout
              if (task.timeout) {
                yield* Effect.fork(
                  Effect.delay(
                    Effect.gen(function* () {
                      worker!.worker.removeEventListener('message', messageHandler)
                      yield* Deferred.fail(
                        deferred,
                        new WorkerTimeoutError({
                          message: 'Task timed out',
                          taskId: task.id,
                          timeout: task.timeout!,
                        }),
                      )
                    }),
                    Duration.millis(task.timeout),
                  ),
                )
              }
            }),
          ),
        )

        yield* Metric.increment(workerMetrics.poolsCreated)
      })

    const execute = <T>(task: WorkerTask) =>
      Effect.gen(function* () {
        const poolData = yield* Ref.get(pools).pipe(Effect.map((map) => HashMap.get(map, task.type)))

        if (Option.isNone(poolData)) {
          return yield* Effect.fail(
            new WorkerError({
              message: `Worker pool for type ${task.type} not found`,
            }),
          )
        }

        const deferred = yield* Deferred.make<T, WorkerError | WorkerTimeoutError>()
        yield* Queue.offer(poolData.value.taskQueue, { task, deferred })

        return yield* Deferred.await(deferred)
      })

    const executeBatch = <T>(tasks: ReadonlyArray<WorkerTask>) =>
      Effect.gen(function* () {
        const results = yield* Effect.forEach(tasks, (task) => execute<T>(task), { concurrency: 'unbounded' })

        return results
      })

    const stream = <T, R>(type: WorkerType, operation: string, input: Stream.Stream<T>) =>
      input.pipe(
        Stream.mapEffect((data: T) =>
          execute<R>({
            id: `stream_${Date.now()}_${Math.random()}`,
            type,
            operation,
            data,
            priority: 'normal',
          }),
        ),
      )

    const broadcast = (type: WorkerType, message: unknown) =>
      Effect.gen(function* () {
        const poolData = yield* Ref.get(pools).pipe(Effect.map((map) => HashMap.get(map, type)))

        if (Option.isNone(poolData)) {
          return yield* Effect.fail(
            new WorkerError({
              message: `Worker pool for type ${type} not found`,
            }),
          )
        }

        poolData.value.workers.forEach((worker) => {
          worker.worker.postMessage({ broadcast: true, data: message })
        })
      })

    const resize = (type: WorkerType, newSize: number) =>
      Effect.gen(function* () {
        const poolData = yield* Ref.get(pools).pipe(Effect.map((map) => HashMap.get(map, type)))

        if (Option.isNone(poolData)) {
          return yield* Effect.fail(
            new WorkerError({
              message: `Worker pool for type ${type} not found`,
            }),
          )
        }

        const pool = poolData.value
        const currentSize = pool.workers.length

        if (newSize > currentSize) {
          // Add workers
          for (let i = currentSize; i < newSize; i++) {
            const worker = createWorker(pool.config)
            pool.workers.push(worker)
            yield* Queue.offer(pool.idleWorkers, worker)
          }
        } else if (newSize < currentSize) {
          // Remove workers
          const toRemove = currentSize - newSize
          for (let i = 0; i < toRemove; i++) {
            const worker = pool.workers.pop()
            if (worker) {
              worker.worker.terminate()
            }
          }
        }

        pool.config.minWorkers = newSize
        pool.config.maxWorkers = Math.max(newSize, pool.config.maxWorkers)
      })

    const getStats = () =>
      Effect.gen(function* () {
        const poolMap = yield* Ref.get(pools)
        const stats: WorkerStats[] = []

        for (const [_, pool] of HashMap.entries(poolMap)) {
          for (const worker of pool.workers) {
            stats.push({
              workerId: worker.id,
              type: worker.type,
              status: worker.status,
              tasksCompleted: worker.stats.tasksCompleted,
              totalExecutionTime: worker.stats.totalExecutionTime,
              averageExecutionTime: worker.stats.tasksCompleted > 0 ? worker.stats.totalExecutionTime / worker.stats.tasksCompleted : 0,
              currentTask: worker.currentTask,
              lastActivity: worker.stats.lastActivity,
            })
          }
        }

        return stats
      })

    const terminate = (type?: WorkerType) =>
      Effect.gen(function* () {
        const poolMap = yield* Ref.get(pools)

        if (type) {
          const pool = HashMap.get(poolMap, type)
          if (Option.isSome(pool)) {
            pool.value.workers.forEach((w) => w.worker.terminate())
            yield* Ref.update(pools, (map) => HashMap.remove(map, type))
          }
        } else {
          // Terminate all pools
          for (const [_, pool] of HashMap.entries(poolMap)) {
            pool.workers.forEach((w) => w.worker.terminate())
          }
          yield* Ref.set(pools, HashMap.empty())
        }
      })

    const getPoolSize = (type: WorkerType) =>
      Effect.gen(function* () {
        const poolData = yield* Ref.get(pools).pipe(Effect.map((map) => HashMap.get(map, type)))

        if (Option.isNone(poolData)) {
          return { active: 0, idle: 0, total: 0 }
        }

        const pool = poolData.value
        const idle = pool.workers.filter((w) => w.status === 'idle').length
        const busy = pool.workers.filter((w) => w.status === 'busy').length

        return {
          active: busy,
          idle,
          total: pool.workers.length,
        }
      })

    return {
      createPool,
      execute,
      executeBatch,
      stream,
      broadcast,
      resize,
      getStats,
      terminate,
      getPoolSize,
    }
  }),
)

// ============================================================================
// Worker Metrics
// ============================================================================

const workerMetrics = {
  poolsCreated: Metric.counter('worker_pools_created', {
    description: 'Number of worker pools created',
  }),

  tasksExecuted: Metric.counter('worker_tasks_executed', {
    description: 'Number of tasks executed by workers',
  }),

  taskExecutionTime: Metric.histogram('worker_task_execution_time', {
    description: 'Task execution time in milliseconds',
    boundaries: Chunk.fromIterable([1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000]),
  }),

  workerUtilization: Metric.gauge('worker_utilization', {
    description: 'Worker utilization percentage',
  }),

  taskQueueSize: Metric.gauge('worker_task_queue_size', {
    description: 'Number of tasks in queue',
  }),
}

// ============================================================================
// Worker Pool Configurations
// ============================================================================

export const defaultWorkerConfigs: ReadonlyArray<WorkerConfig> = [
  {
    type: 'compute',
    scriptUrl: '/workers/compute.worker.js',
    minWorkers: 2,
    maxWorkers: 8,
    idleTimeout: 30000,
    maxTasksPerWorker: 100,
    enableSharedMemory: true,
  },
  {
    type: 'physics',
    scriptUrl: '/workers/physics.worker.js',
    minWorkers: 1,
    maxWorkers: 4,
    idleTimeout: 60000,
    maxTasksPerWorker: 50,
    enableSharedMemory: true,
  },
  {
    type: 'terrain',
    scriptUrl: '/workers/terrain.worker.js',
    minWorkers: 2,
    maxWorkers: 6,
    idleTimeout: 45000,
    maxTasksPerWorker: 20,
    enableSharedMemory: false,
  },
]

// ============================================================================
// Helper Functions
// ============================================================================

export const offloadToWorker =
  <T, R>(type: WorkerType, operation: string, priority: TaskPriority = 'normal') =>
  (data: T) =>
    Effect.gen(function* () {
      const workerPool = yield* WorkerPoolService

      return yield* workerPool.execute<R>({
        id: `task_${Date.now()}_${Math.random()}`,
        type,
        operation,
        data,
        priority,
      })
    })

export const parallelWorkerExecution = <T, R>(type: WorkerType, operation: string, items: ReadonlyArray<T>) =>
  Effect.gen(function* () {
    const workerPool = yield* WorkerPoolService

    const tasks: WorkerTask[] = items.map((item, index) => ({
      id: `batch_${Date.now()}_${index}`,
      type,
      operation,
      data: item,
      priority: 'normal' as TaskPriority,
    }))

    return yield* workerPool.executeBatch<R>(tasks)
  })
