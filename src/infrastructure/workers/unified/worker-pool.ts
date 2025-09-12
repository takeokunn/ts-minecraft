import { Effect, Queue, Ref, Duration as EffectDuration, Context, Layer, Schedule } from 'effect'
import * as S from '@effect/schema/Schema'
import { createTypedWorkerClient, type WorkerClientConfig } from '@infrastructure/workers/base/typed-worker'
import {
  WorkerPoolSchemas,
  type WorkerPoolConfig,
  type WorkerInstance,
  type QueuedRequest,
  type PoolMetrics,
  type PoolStrategy,
  type LoadBalanceStrategy,
  type HealthStatus,
  type RequestOptions,
  type ScaleOptions,
  validateWorkerPoolConfig,
  validateWorkerInstance,
  validatePoolMetrics,
  createDefaultWorkerPoolConfig,
  createEmptyPoolMetrics,
} from '@infrastructure/workers/schemas/worker-pool.schema'
import {
  MessageId,
  WorkerId,
  MessagePriority,
  Timestamp,
  Duration,
  createMessageId,
  createWorkerId,
} from '@infrastructure/workers/schemas/worker-messages.schema'

/**
 * Advanced Worker Pool Management System with Complete Type Safety
 * Handles dynamic scaling, load balancing, and health monitoring using @effect/schema
 */

// Re-export the schema-based types for convenience
export type { 
  WorkerPoolConfig,
  WorkerInstance,
  QueuedRequest,
  PoolMetrics,
  PoolStrategy,
  LoadBalanceStrategy,
  HealthStatus,
  RequestOptions,
  ScaleOptions
}

// All type definitions are now handled by the schema system

// ============================================
// Enhanced Worker Pool Service Interface with Schema Validation
// ============================================

export interface WorkerPoolService {
  /**
   * Submit validated request to the pool
   */
  readonly submit: <TInput, TOutput>(
    payload: TInput,
    options?: RequestOptions,
  ) => Effect.Effect<TOutput, S.ParseResult.ParseError, never>

  /**
   * Get validated pool metrics
   */
  readonly getMetrics: () => Effect.Effect<PoolMetrics, never, never>

  /**
   * Get worker information with validation
   */
  readonly getWorker: (workerId: WorkerId) => Effect.Effect<WorkerInstance | null, never, never>

  /**
   * Get all workers with validation
   */
  readonly getWorkers: () => Effect.Effect<WorkerInstance[], never, never>

  /**
   * Scale pool with validated options
   */
  readonly scale: (options: ScaleOptions) => Effect.Effect<void, S.ParseResult.ParseError, never>

  /**
   * Remove unhealthy workers
   */
  readonly removeUnhealthyWorkers: () => Effect.Effect<number, never, never>

  /**
   * Shutdown pool gracefully
   */
  readonly shutdown: (graceful?: boolean, drainTimeout?: Duration) => Effect.Effect<void, never, never>

  /**
   * Restart specific worker with validation
   */
  readonly restartWorker: (workerId: WorkerId, reason?: string) => Effect.Effect<boolean, never, never>

  /**
   * Pause pool operations
   */
  readonly pause: (reason?: string) => Effect.Effect<void, never, never>
  
  /**
   * Resume pool operations  
   */
  readonly resume: (reason?: string) => Effect.Effect<void, never, never>

  /**
   * Validate and update pool configuration
   */
  readonly updateConfig: (config: Partial<WorkerPoolConfig>) => Effect.Effect<void, S.ParseResult.ParseError, never>

  /**
   * Get pool configuration
   */
  readonly getConfig: () => Effect.Effect<WorkerPoolConfig, never, never>

  /**
   * Drain pool (complete existing requests, don't accept new ones)
   */
  readonly drain: (timeout?: Duration) => Effect.Effect<void, never, never>
}

export const WorkerPoolService = Context.GenericTag<WorkerPoolService>('WorkerPoolService')

// ============================================
// Enhanced Implementation with Schema Validation
// ============================================

const make = (inputConfig: WorkerPoolConfig) =>
  Effect.gen(function* () {
    // Validate configuration using schema
    const config = yield* Effect.try(() => validateWorkerPoolConfig(inputConfig))

    // Worker instances with schema-based types
    const workers = yield* Ref.make<Map<WorkerId, WorkerInstance>>(new Map())

    // Request queue with backpressure and schema validation
    const requestQueue = yield* Queue.bounded<QueuedRequest>(config.maxQueueSize || 1000)
    
    // Backpressure queue for high priority requests
    const highPriorityQueue = yield* Queue.bounded<QueuedRequest>(config.maxHighPriorityQueueSize || 100)
    
    // Backpressure metrics
    const backpressureMetrics = yield* Ref.make<{
      queueFull: boolean
      droppedRequests: number
      lastBackpressureTime: Timestamp
      backpressureEvents: number
    }>({
      queueFull: false,
      droppedRequests: 0,
      lastBackpressureTime: 0 as Timestamp,
      backpressureEvents: 0,
    })

    // Pool metrics with schema validation
    const metrics = yield* Ref.make<PoolMetrics>(createEmptyPoolMetrics())

    // Enhanced pool state
    const poolState = yield* Ref.make<{
      isPaused: boolean
      isShuttingDown: boolean
      isDraining: boolean
      lastScaleUp: Timestamp
      lastScaleDown: Timestamp
      configVersion: number
    }>({
      isPaused: false,
      isShuttingDown: false,
      isDraining: false,
      lastScaleUp: 0 as Timestamp,
      lastScaleDown: 0 as Timestamp,
      configVersion: 1,
    })

    // Configuration reference for dynamic updates
    const currentConfig = yield* Ref.make<WorkerPoolConfig>(config)

    /**
     * Create a new worker instance
     */
    const createWorker = (): Effect.Effect<WorkerInstance, never, never> =>
      Effect.gen(function* () {
        const workerId = `${config.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const worker = new Worker(config.workerScript, { type: 'module' })

        const clientConfig: WorkerClientConfig<any, any> = {
          inputSchema: config.inputSchema,
          outputSchema: config.outputSchema,
          timeout: config.requestTimeout,
          maxConcurrentRequests: config.maxConcurrentRequests,
        }

        const client = yield* createTypedWorkerClient(worker, clientConfig)

        const instance: WorkerInstance = {
          id: workerId,
          worker,
          client,
          status: 'healthy',
          createdAt: Date.now(),
          lastUsed: Date.now(),
          totalRequests: 0,
          activeRequests: 0,
          completedRequests: 0,
          failedRequests: 0,
          averageResponseTime: 0,
          consecutiveFailures: 0,
          memoryUsage: 0,
          cpuUsage: 0,
        }

        // Warmup worker if warmup requests are provided
        if (config.warmupRequests && config.warmupRequests.length > 0) {
          for (const warmupRequest of config.warmupRequests) {
            yield* client.sendRequest(warmupRequest).pipe(
              Effect.timeout(Duration.seconds(5)),
              Effect.catchAll((error) => {
                console.warn(`Warmup failed for worker ${workerId}:`, error)
                return Effect.void
              }),
            )
          }
        }

        return instance
      })

    /**
     * Remove worker instance
     */
    const removeWorker = (workerId: string): Effect.Effect<boolean, never, never> =>
      Effect.gen(function* () {
        const workerMap = yield* Ref.get(workers)
        const instance = workerMap.get(workerId)

        if (!instance) return false

        // Terminate worker
        yield* instance.client.terminate()

        // Remove from map
        yield* Ref.update(workers, (map) => {
          const newMap = new Map(map)
          newMap.delete(workerId)
          return newMap
        })

        return true
      })

    /**
     * Get best available worker using load balancing strategy
     */
    const getBestWorker = (): Effect.Effect<WorkerInstance | null, never, never> =>
      Effect.gen(function* () {
        const workerMap = yield* Ref.get(workers)
        const availableWorkers = Array.from(workerMap.values()).filter((w) => w.status === 'healthy' && w.activeRequests < config.maxConcurrentRequests)

        if (availableWorkers.length === 0) return null

        switch (config.loadBalanceStrategy) {
          case 'round-robin': {
            // Simple round-robin based on creation time
            availableWorkers.sort((a, b) => a.createdAt - b.createdAt)
            const lastUsedWorker = availableWorkers.reduce((latest, current) => (current.lastUsed > latest.lastUsed ? current : latest))
            const index = availableWorkers.indexOf(lastUsedWorker)
            return availableWorkers[(index + 1) % availableWorkers.length]
          }

          case 'least-busy': {
            return availableWorkers.reduce((best, current) => (current.activeRequests < best.activeRequests ? current : best))
          }

          case 'priority': {
            // Prefer workers with lower response times
            return availableWorkers.reduce((best, current) => (current.averageResponseTime < best.averageResponseTime ? current : best))
          }

          case 'random': {
            return availableWorkers[Math.floor(Math.random() * availableWorkers.length)]
          }

          default:
            return availableWorkers[0]
        }
      })

    /**
     * Execute request with worker
     */
    const executeRequest = <TInput, TOutput>(worker: WorkerInstance, request: QueuedRequest): Effect.Effect<TOutput, never, never> =>
      Effect.gen(function* () {
        const startTime = Date.now()

        // Update worker state
        worker.activeRequests++
        worker.totalRequests++
        worker.lastUsed = startTime

        return yield* worker.client.sendRequest(request.payload).pipe(
          Effect.timeout(request.timeout),
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              worker.failedRequests++
              worker.consecutiveFailures++

              if (worker.consecutiveFailures >= config.maxConsecutiveFailures) {
                worker.status = 'unhealthy'
              }

              return yield* Effect.fail(error)
            }),
          ),
          Effect.tap(() => {
            const responseTime = Date.now() - startTime
            worker.completedRequests++
            worker.consecutiveFailures = 0
            worker.averageResponseTime = (worker.averageResponseTime * (worker.completedRequests - 1) + responseTime) / worker.completedRequests
          }),
          Effect.ensuring(
            Effect.sync(() => {
              worker.activeRequests--
            }),
          ),
        )
      })

    /**
     * Process request queue with priority handling
     */
    const processQueue = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        while (true) {
          const state = yield* Ref.get(poolState)
          if (state.isPaused || state.isShuttingDown) {
            yield* Effect.sleep(Duration.millis(100))
            continue
          }

          // Check high priority queue first
          const highPrioritySize = yield* Queue.size(highPriorityQueue)
          const regularSize = yield* Queue.size(requestQueue)
          
          let request: QueuedRequest
          
          if (highPrioritySize > 0) {
            // Process high priority requests first
            request = yield* Queue.take(highPriorityQueue)
          } else if (regularSize > 0) {
            // Process regular priority requests
            request = yield* Queue.take(requestQueue)
          } else {
            // No requests available, wait a bit
            yield* Effect.sleep(Duration.millis(10))
            continue
          }
          
          const worker = yield* getBestWorker()

          if (!worker) {
            // No available workers, check if we can scale up
            yield* autoScale()

            // Re-queue request to appropriate queue based on priority
            const targetQueue = request.priority > 7 ? highPriorityQueue : requestQueue
            yield* Queue.offer(targetQueue, request).pipe(
              Effect.catchTag('QueueFull', () => {
                // If we can't re-queue, reject the request
                request.reject(new Error('WorkerPoolFullError: Cannot re-queue request after failed processing'))
                return Effect.void
              })
            )
            yield* Effect.sleep(Duration.millis(50))
            continue
          }

          // Execute request with enhanced error handling
          const result = executeRequest(worker, request).pipe(
            Effect.timeout(request.timeout),
            Effect.catchAll((error) => {
              // Enhanced error logging for debugging
              console.warn(`Request ${request.id} failed:`, error)
              request.reject(error instanceof Error ? error : new Error(String(error)))
              return Effect.void
            }),
            Effect.tap((result) => {
              request.resolve(result)
            }),
            Effect.fork,
          )

          yield* result
        }
      }).pipe(Effect.forever)

    /**
     * Auto-scaling logic
     */
    const autoScale = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        if (config.strategy !== 'dynamic' && config.strategy !== 'adaptive') return

        const currentMetrics = yield* Ref.get(metrics)
        const workerMap = yield* Ref.get(workers)
        const state = yield* Ref.get(poolState)
        const now = Date.now()

        const currentWorkerCount = workerMap.size
        const queueUtilization = currentMetrics.queueUtilization
        const avgResponseTime = currentMetrics.averageResponseTime

        // Scale up conditions
        if (
          currentWorkerCount < config.maxWorkers &&
          (queueUtilization > config.scaleUpThreshold || avgResponseTime > Duration.toMillis(config.requestTimeout) * 0.8) &&
          now - state.lastScaleUp > Duration.toMillis(config.scaleUpCooldown)
        ) {
          const newWorkerCount = Math.min(config.maxWorkers, currentWorkerCount + 1)
          yield* scalePool(newWorkerCount, 'auto-scale-up: high utilization')

          yield* Ref.update(poolState, (s) => ({ ...s, lastScaleUp: now }))
        }

        // Scale down conditions
        if (
          currentWorkerCount > config.minWorkers &&
          queueUtilization < config.scaleDownThreshold &&
          avgResponseTime < Duration.toMillis(config.requestTimeout) * 0.3 &&
          now - state.lastScaleDown > Duration.toMillis(config.scaleDownCooldown)
        ) {
          const newWorkerCount = Math.max(config.minWorkers, currentWorkerCount - 1)
          yield* scalePool(newWorkerCount, 'auto-scale-down: low utilization')

          yield* Ref.update(poolState, (s) => ({ ...s, lastScaleDown: now }))
        }
      })

    /**
     * Scale pool to target size
     */
    const scalePool = (targetSize: number, reason: string = 'manual'): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        const workerMap = yield* Ref.get(workers)
        const currentSize = workerMap.size

        if (targetSize === currentSize) return

        if (targetSize > currentSize) {
          // Scale up
          const workersToAdd = targetSize - currentSize
          for (let i = 0; i < workersToAdd; i++) {
            const newWorker = yield* createWorker()
            yield* Ref.update(workers, (map) => {
              const newMap = new Map(map)
              newMap.set(newWorker.id, newWorker)
              return newMap
            })
          }
        } else {
          // Scale down - remove least used workers
          const workersArray = Array.from(workerMap.values())
          workersArray.sort((a, b) => a.lastUsed - b.lastUsed)

          const workersToRemove = currentSize - targetSize
          for (let i = 0; i < workersToRemove; i++) {
            const workerToRemove = workersArray[i]
            if (workerToRemove.activeRequests === 0) {
              yield* removeWorker(workerToRemove.id)
            }
          }
        }

        // Update metrics
        yield* Ref.update(metrics, (m) => ({
          ...m,
          lastScaleEvent: Date.now(),
          scaleEvents: [
            ...m.scaleEvents.slice(-9), // Keep last 10 events
            {
              timestamp: Date.now(),
              action: targetSize > currentSize ? 'scale-up' : 'scale-down',
              reason,
              workerCount: targetSize,
            },
          ],
        }))
      })

    /**
     * Health check for workers
     */
    const healthCheck = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        const workerMap = yield* Ref.get(workers)

        for (const worker of workerMap.values()) {
          // Check if worker is idle too long
          const idleTime = Date.now() - worker.lastUsed
          if (idleTime > Duration.toMillis(config.idleTimeout) && worker.activeRequests === 0) {
            if (workerMap.size > config.minWorkers) {
              yield* removeWorker(worker.id)
              continue
            }
          }

          // Check consecutive failures
          if (worker.consecutiveFailures >= config.maxConsecutiveFailures) {
            worker.status = 'unhealthy'
          }

          // Basic health ping
          yield* worker.client.getCapabilities().pipe(
            Effect.timeout(config.healthCheckTimeout),
            Effect.tap(() => {
              if (worker.status !== 'healthy') {
                worker.status = 'healthy'
                worker.consecutiveFailures = 0
              }
            }),
            Effect.catchAll(() =>
              Effect.sync(() => {
                worker.consecutiveFailures++
                if (worker.consecutiveFailures >= config.maxConsecutiveFailures) {
                  worker.status = 'unhealthy'
                }
              }),
            ),
          )
        }
      })

    /**
     * Update metrics with enhanced backpressure tracking
     */
    const updateMetrics = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        const workerMap = yield* Ref.get(workers)
        const regularQueueSize = yield* Queue.size(requestQueue)
        const highPriorityQueueSize = yield* Queue.size(highPriorityQueue)
        const backpressure = yield* Ref.get(backpressureMetrics)

        const healthyWorkers = Array.from(workerMap.values()).filter((w) => w.status === 'healthy')
        const activeWorkers = healthyWorkers.filter((w) => w.activeRequests > 0)
        const unhealthyWorkers = Array.from(workerMap.values()).filter((w) => w.status === 'unhealthy')

        const totalRequests = Array.from(workerMap.values()).reduce((sum, w) => sum + w.totalRequests, 0)
        const completedRequests = Array.from(workerMap.values()).reduce((sum, w) => sum + w.completedRequests, 0)
        const failedRequests = Array.from(workerMap.values()).reduce((sum, w) => sum + w.failedRequests, 0)
        const avgResponseTime = Array.from(workerMap.values()).reduce((sum, w) => sum + w.averageResponseTime, 0) / workerMap.size || 0
        
        const totalQueueSize = regularQueueSize + highPriorityQueueSize
        const maxQueueCapacity = (config.maxQueueSize || 1000) + (config.maxHighPriorityQueueSize || 100)

        yield* Ref.update(metrics, (m) => ({
          ...m,
          totalWorkers: workerMap.size,
          activeWorkers: activeWorkers.length,
          idleWorkers: healthyWorkers.length - activeWorkers.length,
          unhealthyWorkers: unhealthyWorkers.length,
          totalRequests,
          completedRequests,
          failedRequests,
          averageResponseTime: avgResponseTime,
          queueLength: totalQueueSize,
          queueUtilization: (totalQueueSize / maxQueueCapacity) * 100,
          
          // Enhanced backpressure metrics
          regularQueueLength: regularQueueSize,
          highPriorityQueueLength: highPriorityQueueSize,
          backpressureActive: backpressure.queueFull,
          droppedRequests: backpressure.droppedRequests,
          backpressureEvents: backpressure.backpressureEvents,
          lastBackpressureTime: backpressure.lastBackpressureTime,
          
          // Performance indicators
          throughput: completedRequests > 0 ? (completedRequests / (Date.now() - (m.startTime || Date.now()))) * 1000 : 0,
          errorRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
          utilizationRate: workerMap.size > 0 ? (activeWorkers.length / workerMap.size) * 100 : 0,
        }))
      })

    // Initialize pool
    for (let i = 0; i < config.initialWorkers; i++) {
      const worker = yield* createWorker()
      yield* Ref.update(workers, (map) => {
        const newMap = new Map(map)
        newMap.set(worker.id, worker)
        return newMap
      })
    }

    // Start background tasks
    const queueProcessor = yield* processQueue().pipe(Effect.fork)

    const healthMonitor = yield* Effect.repeat(healthCheck(), Schedule.fixed(config.healthCheckInterval)).pipe(Effect.fork)

    const metricsUpdater = yield* Effect.repeat(updateMetrics(), Schedule.fixed(Duration.seconds(5))).pipe(Effect.fork)

    const autoScaler = yield* Effect.repeat(autoScale(), Schedule.fixed(Duration.seconds(10))).pipe(Effect.fork)

    return {
      submit: <TInput, TOutput>(payload: TInput, options = {}) =>
        Effect.gen(function* () {
          const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          const state = yield* Ref.get(poolState)
          
          // Check if pool is paused or shutting down
          if (state.isPaused || state.isShuttingDown) {
            return yield* Effect.fail(new Error('WorkerPool is paused or shutting down'))
          }

          const request = yield* Effect.async<TOutput>((resume) => {
            const queuedRequest: QueuedRequest = {
              id: requestId,
              payload,
              priority: options.priority || 0,
              timeout: options.timeout || config.requestTimeout,
              createdAt: Date.now(),
              resolve: (value) => resume(Effect.succeed(value)),
              reject: (error) => resume(Effect.fail(error)),
              retryCount: 0,
            }

            // Enhanced backpressure mechanism
            const submitWithBackpressure = Effect.gen(function* () {
              const isHighPriority = (options.priority || 0) > 7
              const targetQueue = isHighPriority ? highPriorityQueue : requestQueue
              
              // Try to offer to the appropriate queue
              const offered = yield* Queue.offer(targetQueue, queuedRequest).pipe(
                Effect.catchTag('QueueFull', () => Effect.succeed(false))
              )
              
              if (!offered) {
                // Handle backpressure based on strategy
                const backpressureStrategy = config.backpressureStrategy || 'reject'
                
                yield* Ref.update(backpressureMetrics, (metrics) => ({
                  ...metrics,
                  queueFull: true,
                  backpressureEvents: metrics.backpressureEvents + 1,
                  lastBackpressureTime: Date.now() as Timestamp,
                }))
                
                switch (backpressureStrategy) {
                  case 'reject':
                    queuedRequest.reject(new Error('WorkerPoolFullError: Queue is full, request rejected'))
                    break
                    
                  case 'drop_oldest':
                    // Drop oldest request from regular queue
                    const droppedRequest = yield* Queue.take(requestQueue).pipe(
                      Effect.timeout(EffectDuration.millis(10)),
                      Effect.catchAll(() => Effect.succeed(null))
                    )
                    
                    if (droppedRequest) {
                      droppedRequest.reject(new Error('WorkerPoolFullError: Request dropped due to backpressure'))
                      yield* Ref.update(backpressureMetrics, (metrics) => ({
                        ...metrics,
                        droppedRequests: metrics.droppedRequests + 1,
                      }))
                    }
                    
                    // Try to add the new request
                    yield* Queue.offer(targetQueue, queuedRequest).pipe(
                      Effect.catchTag('QueueFull', () => {
                        queuedRequest.reject(new Error('WorkerPoolFullError: Still no space after drop'))
                        return Effect.void
                      })
                    )
                    break
                    
                  case 'block':
                    // Block until space is available (with timeout)
                    yield* Queue.offer(targetQueue, queuedRequest).pipe(
                      Effect.timeout(EffectDuration.millis(config.backpressureTimeout || 30000)),
                      Effect.catchTag('TimeoutException', () => {
                        queuedRequest.reject(new Error('WorkerPoolFullError: Timeout waiting for queue space'))
                        return Effect.void
                      })
                    )
                    break
                    
                  case 'scale_up':
                    // Attempt to scale up the pool
                    if (config.strategy === 'dynamic' || config.strategy === 'adaptive') {
                      yield* autoScale()
                    }
                    
                    // Try again after potential scaling
                    yield* Effect.sleep(EffectDuration.millis(100))
                    const retryOffered = yield* Queue.offer(targetQueue, queuedRequest).pipe(
                      Effect.catchTag('QueueFull', () => Effect.succeed(false))
                    )
                    
                    if (!retryOffered) {
                      queuedRequest.reject(new Error('WorkerPoolFullError: Still no space after scale attempt'))
                    }
                    break
                    
                  default:
                    queuedRequest.reject(new Error('WorkerPoolFullError: Queue is full'))
                }
              } else {
                // Successfully queued, reset backpressure flag
                yield* Ref.update(backpressureMetrics, (metrics) => ({
                  ...metrics,
                  queueFull: false,
                }))
              }
            })
            
            Effect.runPromise(submitWithBackpressure)
          })

          return yield* request
        }),

      getMetrics: () => 
        Effect.gen(function* () {
          const baseMetrics = yield* Ref.get(metrics)
          const backpressure = yield* Ref.get(backpressureMetrics)
          const queueSize = yield* Queue.size(requestQueue)
          const highPriorityQueueSize = yield* Queue.size(highPriorityQueue)
          
          return {
            ...baseMetrics,
            queueLength: queueSize + highPriorityQueueSize,
            regularQueueLength: queueSize,
            highPriorityQueueLength: highPriorityQueueSize,
            backpressureActive: backpressure.queueFull,
            droppedRequests: backpressure.droppedRequests,
            backpressureEvents: backpressure.backpressureEvents,
            lastBackpressureTime: backpressure.lastBackpressureTime,
          }
        }),

      getWorker: (workerId) =>
        Effect.gen(function* () {
          const workerMap = yield* Ref.get(workers)
          return workerMap.get(workerId) || null
        }),

      getWorkers: () =>
        Effect.gen(function* () {
          const workerMap = yield* Ref.get(workers)
          return Array.from(workerMap.values())
        }),

      scale: scalePool,

      removeUnhealthyWorkers: () =>
        Effect.gen(function* () {
          const workerMap = yield* Ref.get(workers)
          const unhealthyWorkers = Array.from(workerMap.values()).filter((w) => w.status === 'unhealthy')

          let removed = 0
          for (const worker of unhealthyWorkers) {
            if (yield* removeWorker(worker.id)) {
              removed++
            }
          }

          return removed
        }),

      restartWorker: (workerId) =>
        Effect.gen(function* () {
          const removed = yield* removeWorker(workerId)
          if (removed) {
            const newWorker = yield* createWorker()
            yield* Ref.update(workers, (map) => {
              const newMap = new Map(map)
              newMap.set(newWorker.id, newWorker)
              return newMap
            })
            return true
          }
          return false
        }),

      pause: () => Ref.update(poolState, (s) => ({ ...s, isPaused: true })).pipe(Effect.asVoid),

      resume: () => Ref.update(poolState, (s) => ({ ...s, isPaused: false })).pipe(Effect.asVoid),

      shutdown: () =>
        Effect.gen(function* () {
          yield* Ref.update(poolState, (s) => ({ ...s, isShuttingDown: true }))

          const workerMap = yield* Ref.get(workers)
          for (const worker of workerMap.values()) {
            yield* worker.client.terminate()
          }

          yield* Ref.set(workers, new Map())
        }),
    } satisfies WorkerPoolService
  })

/**
 * Create a WorkerPool layer
 */
export const createWorkerPool = (config: WorkerPoolConfig) => Layer.effect(WorkerPoolService, make(config))

/**
 * Create multiple WorkerPool instances
 */
export const createMultipleWorkerPools = (configs: WorkerPoolConfig[]) => {
  const layers = configs.map((config) => createWorkerPool(config))
  return Layer.mergeAll(...layers)
}
