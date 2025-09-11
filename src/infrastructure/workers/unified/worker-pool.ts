import { Effect, Queue, Ref, Duration, Context, Layer, Schedule } from 'effect'
import * as S from 'effect/Schema'
import { createTypedWorkerClient, type WorkerClientConfig } from '../base/typed-worker'

/**
 * Advanced Worker Pool Management System
 * Handles dynamic scaling, load balancing, and health monitoring
 */

// ============================================
// Types and Interfaces
// ============================================

export type PoolStrategy = 'fixed' | 'dynamic' | 'adaptive'
export type LoadBalanceStrategy = 'round-robin' | 'least-busy' | 'priority' | 'random'
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'terminated'

export interface WorkerPoolConfig {
  name: string
  workerScript: string
  inputSchema: S.Schema<any>
  outputSchema: S.Schema<any>

  // Pool sizing
  minWorkers: number
  maxWorkers: number
  initialWorkers: number
  strategy: PoolStrategy

  // Performance settings
  maxConcurrentRequests: number
  requestTimeout: Duration.Duration
  idleTimeout: Duration.Duration

  // Load balancing
  loadBalanceStrategy: LoadBalanceStrategy

  // Health monitoring
  healthCheckInterval: Duration.Duration
  healthCheckTimeout: Duration.Duration
  maxConsecutiveFailures: number

  // Auto-scaling (for dynamic strategy)
  scaleUpThreshold: number // CPU/queue utilization %
  scaleDownThreshold: number // CPU/queue utilization %
  scaleUpCooldown: Duration.Duration
  scaleDownCooldown: Duration.Duration

  // Advanced features
  enableSharedArrayBuffer: boolean
  enableTransferableObjects: boolean
  warmupRequests?: any[]
}

export interface WorkerInstance {
  id: string
  worker: Worker
  client: Awaited<ReturnType<typeof createTypedWorkerClient<any, any>>>
  status: HealthStatus
  createdAt: number
  lastUsed: number

  // Metrics
  totalRequests: number
  activeRequests: number
  completedRequests: number
  failedRequests: number
  averageResponseTime: number
  consecutiveFailures: number

  // Resource usage
  memoryUsage: number
  cpuUsage: number
}

export interface PoolMetrics {
  totalWorkers: number
  activeWorkers: number
  idleWorkers: number
  unhealthyWorkers: number

  totalRequests: number
  completedRequests: number
  failedRequests: number
  averageResponseTime: number

  queueLength: number
  queueUtilization: number

  memoryUsage: number
  cpuUtilization: number

  lastScaleEvent: number | null
  scaleEvents: Array<{
    timestamp: number
    action: 'scale-up' | 'scale-down'
    reason: string
    workerCount: number
  }>
}

export interface QueuedRequest {
  id: string
  payload: any
  priority: number
  timeout: Duration.Duration
  createdAt: number
  resolve: (value: any) => void
  reject: (error: Error) => void
  retryCount: number
}

// ============================================
// Worker Pool Service Interface
// ============================================

export interface WorkerPoolService {
  /**
   * Submit request to the pool
   */
  readonly submit: <TInput, TOutput>(
    payload: TInput,
    options?: {
      priority?: number
      timeout?: Duration.Duration
      retryCount?: number
      preferredWorkerId?: string
    },
  ) => Effect.Effect<TOutput, never, never>

  /**
   * Get pool metrics
   */
  readonly getMetrics: () => Effect.Effect<PoolMetrics, never, never>

  /**
   * Get worker information
   */
  readonly getWorker: (workerId: string) => Effect.Effect<WorkerInstance | null, never, never>

  /**
   * Get all workers
   */
  readonly getWorkers: () => Effect.Effect<WorkerInstance[], never, never>

  /**
   * Scale pool manually
   */
  readonly scale: (targetSize: number, reason?: string) => Effect.Effect<void, never, never>

  /**
   * Remove unhealthy workers
   */
  readonly removeUnhealthyWorkers: () => Effect.Effect<number, never, never>

  /**
   * Shutdown pool
   */
  readonly shutdown: () => Effect.Effect<void, never, never>

  /**
   * Restart specific worker
   */
  readonly restartWorker: (workerId: string) => Effect.Effect<boolean, never, never>

  /**
   * Pause/resume pool
   */
  readonly pause: () => Effect.Effect<void, never, never>
  readonly resume: () => Effect.Effect<void, never, never>
}

export const WorkerPoolService = Context.GenericTag<WorkerPoolService>('@services/WorkerPoolService')

// ============================================
// Implementation
// ============================================

const make = (config: WorkerPoolConfig) =>
  Effect.gen(function* () {
    // Worker instances
    const workers = yield* Ref.make<Map<string, WorkerInstance>>(new Map())

    // Request queue with priority
    const requestQueue = yield* Queue.bounded<QueuedRequest>(1000)

    // Pool metrics
    const metrics = yield* Ref.make<PoolMetrics>({
      totalWorkers: 0,
      activeWorkers: 0,
      idleWorkers: 0,
      unhealthyWorkers: 0,
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      queueLength: 0,
      queueUtilization: 0,
      memoryUsage: 0,
      cpuUtilization: 0,
      lastScaleEvent: null,
      scaleEvents: [],
    })

    // Pool state
    const poolState = yield* Ref.make<{
      isPaused: boolean
      isShuttingDown: boolean
      lastScaleUp: number
      lastScaleDown: number
    }>({
      isPaused: false,
      isShuttingDown: false,
      lastScaleUp: 0,
      lastScaleDown: 0,
    })

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
     * Process request queue
     */
    const processQueue = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        while (true) {
          const state = yield* Ref.get(poolState)
          if (state.isPaused || state.isShuttingDown) {
            yield* Effect.sleep(Duration.millis(100))
            continue
          }

          const request = yield* Queue.take(requestQueue)
          const worker = yield* getBestWorker()

          if (!worker) {
            // No available workers, check if we can scale up
            yield* autoScale()

            // Re-queue request
            yield* Queue.offer(requestQueue, request)
            yield* Effect.sleep(Duration.millis(50))
            continue
          }

          // Execute request
          const result = executeRequest(worker, request).pipe(
            Effect.timeout(request.timeout),
            Effect.catchAll((error) => {
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
     * Update metrics
     */
    const updateMetrics = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        const workerMap = yield* Ref.get(workers)
        const queueSize = yield* Queue.size(requestQueue)

        const healthyWorkers = Array.from(workerMap.values()).filter((w) => w.status === 'healthy')
        const activeWorkers = healthyWorkers.filter((w) => w.activeRequests > 0)
        const unhealthyWorkers = Array.from(workerMap.values()).filter((w) => w.status === 'unhealthy')

        const totalRequests = Array.from(workerMap.values()).reduce((sum, w) => sum + w.totalRequests, 0)
        const completedRequests = Array.from(workerMap.values()).reduce((sum, w) => sum + w.completedRequests, 0)
        const failedRequests = Array.from(workerMap.values()).reduce((sum, w) => sum + w.failedRequests, 0)
        const avgResponseTime = Array.from(workerMap.values()).reduce((sum, w) => sum + w.averageResponseTime, 0) / workerMap.size || 0

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
          queueLength: queueSize,
          queueUtilization: (queueSize / 1000) * 100, // Based on queue capacity
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

            Effect.runPromise(Queue.offer(requestQueue, queuedRequest))
          })

          return yield* request
        }),

      getMetrics: () => Ref.get(metrics),

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
