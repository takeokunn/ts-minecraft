import { Effect, Queue, Ref, Duration, Layer, Context } from 'effect'
import * as S from 'effect/Schema'
import { 
  createTypedWorkerClient, 
  createWorkerPool,
  type WorkerClientConfig 
} from '../base/typed-worker'
import { 
  TerrainGenerationRequest,
  TerrainGenerationResponse,
  PhysicsSimulationRequest,
  PhysicsSimulationResponse,
  MeshGenerationRequest,
  MeshGenerationResponse
} from './protocols'

/**
 * Unified Worker Manager for Minecraft
 * Manages all worker types with a single interface
 */

// ============================================
// Worker Type Definitions
// ============================================

export type WorkerType = 'terrain' | 'physics' | 'mesh' | 'lighting' | 'computation'

export interface WorkerCapabilities {
  sharedArrayBuffer: boolean
  transferableObjects: boolean
  wasmSupport: boolean
  webglSupport: boolean
  maxMemory: number
  concurrency: number
}

export interface WorkerMetrics {
  totalRequests: number
  activeRequests: number
  averageResponseTime: number
  errorRate: number
  lastHeartbeat: number
}

export interface WorkerInstance {
  id: string
  type: WorkerType
  client: Awaited<ReturnType<typeof createTypedWorkerClient<any, any>>>
  capabilities: WorkerCapabilities
  metrics: WorkerMetrics
  status: 'idle' | 'busy' | 'error' | 'terminated'
  priority: number
}

// ============================================
// Service Interface
// ============================================

export interface WorkerManagerService {
  /**
   * Send terrain generation request
   */
  readonly generateTerrain: (
    request: TerrainGenerationRequest,
    options?: {
      priority?: number
      timeout?: Duration.Duration
      preferredWorkerId?: string
    }
  ) => Effect.Effect<TerrainGenerationResponse, never, never>

  /**
   * Send physics simulation request
   */
  readonly simulatePhysics: (
    request: PhysicsSimulationRequest,
    options?: {
      priority?: number
      timeout?: Duration.Duration
      preferredWorkerId?: string
    }
  ) => Effect.Effect<PhysicsSimulationResponse, never, never>

  /**
   * Send mesh generation request
   */
  readonly generateMesh: (
    request: MeshGenerationRequest,
    options?: {
      priority?: number
      timeout?: Duration.Duration
      preferredWorkerId?: string
    }
  ) => Effect.Effect<MeshGenerationResponse, never, never>

  /**
   * Get worker pool statistics
   */
  readonly getPoolStats: () => Effect.Effect<{
    totalWorkers: number
    activeWorkers: number
    idleWorkers: number
    errorWorkers: number
    totalRequests: number
    averageResponseTime: number
  }, never, never>

  /**
   * Get specific worker information
   */
  readonly getWorkerInfo: (workerId: string) => Effect.Effect<WorkerInstance | null, never, never>

  /**
   * Restart worker
   */
  readonly restartWorker: (workerId: string) => Effect.Effect<void, never, never>

  /**
   * Scale worker pool
   */
  readonly scalePool: (workerType: WorkerType, targetCount: number) => Effect.Effect<void, never, never>

  /**
   * Shutdown all workers
   */
  readonly shutdown: () => Effect.Effect<void, never, never>
}

export const WorkerManagerService = Context.GenericTag<WorkerManagerService>('@services/WorkerManagerService')

// ============================================
// Configuration
// ============================================

export interface WorkerManagerConfig {
  terrain: {
    poolSize: number
    maxConcurrency: number
    timeout: Duration.Duration
    priority: number
  }
  physics: {
    poolSize: number
    maxConcurrency: number
    timeout: Duration.Duration
    priority: number
  }
  mesh: {
    poolSize: number
    maxConcurrency: number
    timeout: Duration.Duration
    priority: number
  }
  lighting: {
    poolSize: number
    maxConcurrency: number
    timeout: Duration.Duration
    priority: number
  }
  computation: {
    poolSize: number
    maxConcurrency: number
    timeout: Duration.Duration
    priority: number
  }
  globalSettings: {
    enableMetrics: boolean
    heartbeatInterval: Duration.Duration
    maxRetries: number
    loadBalancing: 'round-robin' | 'least-busy' | 'priority'
  }
}

const defaultConfig: WorkerManagerConfig = {
  terrain: {
    poolSize: 2,
    maxConcurrency: 4,
    timeout: Duration.seconds(30),
    priority: 1
  },
  physics: {
    poolSize: 1,
    maxConcurrency: 2,
    timeout: Duration.seconds(16),
    priority: 2
  },
  mesh: {
    poolSize: 2,
    maxConcurrency: 4,
    timeout: Duration.seconds(20),
    priority: 1
  },
  lighting: {
    poolSize: 1,
    maxConcurrency: 2,
    timeout: Duration.seconds(25),
    priority: 3
  },
  computation: {
    poolSize: 1,
    maxConcurrency: 1,
    timeout: Duration.seconds(60),
    priority: 4
  },
  globalSettings: {
    enableMetrics: true,
    heartbeatInterval: Duration.seconds(30),
    maxRetries: 3,
    loadBalancing: 'least-busy'
  }
}

// ============================================
// Implementation
// ============================================

const make = (config: WorkerManagerConfig = defaultConfig) =>
  Effect.gen(function* () {
    // Worker pools by type
    const workerPools = yield* Ref.make<Map<WorkerType, WorkerInstance[]>>(new Map())
    
    // Request queues with priority
    const requestQueues = yield* Ref.make<Map<WorkerType, Queue.Queue<{
      request: any
      resolve: (value: any) => void
      reject: (error: Error) => void
      priority: number
      timeout: Duration.Duration
      timestamp: number
    }>>>(new Map())

    // Performance metrics
    const globalMetrics = yield* Ref.make({
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      startTime: Date.now()
    })

    /**
     * Create worker instance
     */
    const createWorkerInstance = (
      type: WorkerType,
      workerId: string
    ): Effect.Effect<WorkerInstance, never, never> =>
      Effect.gen(function* () {
        let workerScript: string
        let clientConfig: WorkerClientConfig<any, any>

        // Worker script mapping with better error handling
        const workerScripts: Record<WorkerType, string> = {
          terrain: new URL('../workers/terrain-generation.worker.ts', import.meta.url).href,
          physics: new URL('../workers/physics.worker.ts', import.meta.url).href,
          mesh: new URL('../workers/mesh-generation.worker.ts', import.meta.url).href,
          lighting: new URL('../workers/lighting.worker.ts', import.meta.url).href,
          computation: new URL('../workers/computation.worker.ts', import.meta.url).href
        }

        const inputSchemas: Record<WorkerType, any> = {
          terrain: TerrainGenerationRequest,
          physics: PhysicsSimulationRequest,
          mesh: MeshGenerationRequest,
          lighting: TerrainGenerationRequest, // Temporary - needs lighting protocol
          computation: PhysicsSimulationRequest // Temporary - needs computation protocol
        }

        const outputSchemas: Record<WorkerType, any> = {
          terrain: TerrainGenerationResponse,
          physics: PhysicsSimulationResponse,
          mesh: MeshGenerationResponse,
          lighting: TerrainGenerationResponse, // Temporary
          computation: PhysicsSimulationResponse // Temporary
        }

        if (!workerScripts[type]) {
          return yield* Effect.fail(new Error(`Unsupported worker type: ${type}`))
        }

        workerScript = workerScripts[type]
        clientConfig = {
          inputSchema: inputSchemas[type],
          outputSchema: outputSchemas[type],
          timeout: config[type].timeout,
          maxConcurrentRequests: config[type].maxConcurrency
        }

        const worker = new Worker(workerScript, { type: 'module' })
        const client = yield* createTypedWorkerClient(worker, clientConfig)
        const capabilities = yield* client.getCapabilities()

        return {
          id: workerId,
          type,
          client,
          capabilities: capabilities || {
            sharedArrayBuffer: false,
            transferableObjects: true,
            wasmSupport: false,
            webglSupport: false,
            maxMemory: 100 * 1024 * 1024, // 100MB
            concurrency: 1
          },
          metrics: {
            totalRequests: 0,
            activeRequests: 0,
            averageResponseTime: 0,
            errorRate: 0,
            lastHeartbeat: Date.now()
          },
          status: 'idle' as const,
          priority: config[type].priority
        }
      }).pipe(
        Effect.catchAll((error) =>
          Effect.sync(() => {
            console.error(`Failed to create ${type} worker:`, error)
            throw error
          })
        )
      )

    /**
     * Initialize worker pools
     */
    const initializePools = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        const pools = new Map<WorkerType, WorkerInstance[]>()
        const queues = new Map<WorkerType, Queue.Queue<any>>()

        for (const workerType of ['terrain', 'physics', 'mesh', 'lighting', 'computation'] as WorkerType[]) {
          const poolSize = config[workerType].poolSize
          const workers: WorkerInstance[] = []

          for (let i = 0; i < poolSize; i++) {
            const workerId = `${workerType}-${i}-${Date.now()}`
            const worker = yield* createWorkerInstance(workerType, workerId)
            workers.push(worker)
          }

          pools.set(workerType, workers)
          
          const queue = yield* Queue.bounded<any>(100)
          queues.set(workerType, queue)
        }

        yield* Ref.set(workerPools, pools)
        yield* Ref.set(requestQueues, queues)
      })

    /**
     * Get best available worker
     */
    const getBestWorker = (workerType: WorkerType): Effect.Effect<WorkerInstance | null, never, never> =>
      Effect.gen(function* () {
        const pools = yield* Ref.get(workerPools)
        const workers = pools.get(workerType) || []

        if (workers.length === 0) return null

        // Filter available workers
        const availableWorkers = workers.filter(w => 
          w.status === 'idle' || (w.status === 'busy' && w.metrics.activeRequests < config[workerType].maxConcurrency)
        )

        if (availableWorkers.length === 0) return null

        // Load balancing strategy
        switch (config.globalSettings.loadBalancing) {
          case 'round-robin':
            return availableWorkers[0]
          
          case 'least-busy':
            return availableWorkers.reduce((best, current) => 
              current.metrics.activeRequests < best.metrics.activeRequests ? current : best
            )
            
          case 'priority':
            return availableWorkers.reduce((best, current) =>
              current.priority < best.priority ? current : best
            )
            
          default:
            return availableWorkers[0]
        }
      })

    /**
     * Execute request with retry logic
     */
    const executeRequest = <TRequest, TResponse>(
      workerType: WorkerType,
      request: TRequest,
      options?: {
        priority?: number
        timeout?: Duration.Duration
        preferredWorkerId?: string
      }
    ): Effect.Effect<TResponse, never, never> =>
      Effect.gen(function* () {
        const startTime = Date.now()
        let attempts = 0
        const maxRetries = config.globalSettings.maxRetries

        while (attempts <= maxRetries) {
          try {
            const worker = yield* getBestWorker(workerType)
            if (!worker) {
              yield* Effect.sleep(Duration.millis(100))
              attempts++
              continue
            }

            // Update worker metrics
            worker.metrics.activeRequests++
            worker.status = 'busy'

            const response = yield* worker.client.sendRequest(request, {
              priority: options?.priority || config[workerType].priority
            }).pipe(
              Effect.timeout(options?.timeout || config[workerType].timeout),
              Effect.catchAll((error) => {
                worker.metrics.errorRate = (worker.metrics.errorRate + 1) / worker.metrics.totalRequests
                worker.status = 'error'
                return Effect.fail(error)
              }),
              Effect.tap(() => {
                worker.metrics.activeRequests--
                worker.metrics.totalRequests++
                const responseTime = Date.now() - startTime
                worker.metrics.averageResponseTime = 
                  (worker.metrics.averageResponseTime + responseTime) / 2
                worker.status = worker.metrics.activeRequests > 0 ? 'busy' : 'idle'
                worker.metrics.lastHeartbeat = Date.now()
              })
            )

            // Update global metrics
            yield* Ref.update(globalMetrics, metrics => ({
              ...metrics,
              totalRequests: metrics.totalRequests + 1,
              completedRequests: metrics.completedRequests + 1,
              averageResponseTime: (metrics.averageResponseTime + (Date.now() - startTime)) / 2
            }))

            return response
          } catch (error) {
            attempts++
            if (attempts > maxRetries) {
              yield* Ref.update(globalMetrics, metrics => ({
                ...metrics,
                failedRequests: metrics.failedRequests + 1
              }))
              throw error
            }
            yield* Effect.sleep(Duration.millis(Math.pow(2, attempts) * 100))
          }
        }

        return yield* Effect.fail(new Error(`Max retries exceeded for ${workerType} request`))
      })

    // Initialize pools
    yield* initializePools()

    // Heartbeat monitoring
    const heartbeatMonitor = Effect.gen(function* () {
      while (true) {
        yield* Effect.sleep(config.globalSettings.heartbeatInterval)
        
        const pools = yield* Ref.get(workerPools)
        for (const [workerType, workers] of pools.entries()) {
          for (const worker of workers) {
            const timeSinceHeartbeat = Date.now() - worker.metrics.lastHeartbeat
            if (timeSinceHeartbeat > Duration.toMillis(config.globalSettings.heartbeatInterval) * 2) {
              console.warn(`Worker ${worker.id} missed heartbeat, restarting...`)
              yield* restartWorkerInstance(worker.id)
            }
          }
        }
      }
    }).pipe(
      Effect.fork
    )

    /**
     * Restart specific worker instance
     */
    const restartWorkerInstance = (workerId: string): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        const pools = yield* Ref.get(workerPools)
        
        for (const [workerType, workers] of pools.entries()) {
          const workerIndex = workers.findIndex(w => w.id === workerId)
          if (workerIndex !== -1) {
            const oldWorker = workers[workerIndex]
            
            // Terminate old worker
            yield* oldWorker.client.terminate()
            
            // Create new worker
            const newWorker = yield* createWorkerInstance(workerType, `${workerType}-${Date.now()}`)
            workers[workerIndex] = newWorker
            
            yield* Ref.update(workerPools, pools => {
              const newPools = new Map(pools)
              newPools.set(workerType, [...workers])
              return newPools
            })
            
            break
          }
        }
      })

    return {
      generateTerrain: (request, options) => 
        executeRequest<TerrainGenerationRequest, TerrainGenerationResponse>('terrain', request, options),
      
      simulatePhysics: (request, options) =>
        executeRequest<PhysicsSimulationRequest, PhysicsSimulationResponse>('physics', request, options),
      
      generateMesh: (request, options) =>
        executeRequest<MeshGenerationRequest, MeshGenerationResponse>('mesh', request, options),

      getPoolStats: () =>
        Effect.gen(function* () {
          const pools = yield* Ref.get(workerPools)
          const metrics = yield* Ref.get(globalMetrics)
          
          let totalWorkers = 0
          let activeWorkers = 0
          let idleWorkers = 0
          let errorWorkers = 0

          for (const workers of pools.values()) {
            totalWorkers += workers.length
            for (const worker of workers) {
              switch (worker.status) {
                case 'busy': activeWorkers++; break
                case 'idle': idleWorkers++; break
                case 'error': errorWorkers++; break
              }
            }
          }

          return {
            totalWorkers,
            activeWorkers,
            idleWorkers,
            errorWorkers,
            totalRequests: metrics.totalRequests,
            averageResponseTime: metrics.averageResponseTime
          }
        }),

      getWorkerInfo: (workerId) =>
        Effect.gen(function* () {
          const pools = yield* Ref.get(workerPools)
          
          for (const workers of pools.values()) {
            const worker = workers.find(w => w.id === workerId)
            if (worker) return worker
          }
          
          return null
        }),

      restartWorker: restartWorkerInstance,

      scalePool: (workerType, targetCount) =>
        Effect.gen(function* () {
          const pools = yield* Ref.get(workerPools)
          const currentWorkers = pools.get(workerType) || []
          const currentCount = currentWorkers.length

          if (targetCount === currentCount) return

          if (targetCount > currentCount) {
            // Scale up
            const newWorkers = [...currentWorkers]
            for (let i = currentCount; i < targetCount; i++) {
              const workerId = `${workerType}-${i}-${Date.now()}`
              const worker = yield* createWorkerInstance(workerType, workerId)
              newWorkers.push(worker)
            }

            yield* Ref.update(workerPools, pools => {
              const newPools = new Map(pools)
              newPools.set(workerType, newWorkers)
              return newPools
            })
          } else {
            // Scale down
            const workersToRemove = currentWorkers.slice(targetCount)
            const remainingWorkers = currentWorkers.slice(0, targetCount)

            // Terminate removed workers
            for (const worker of workersToRemove) {
              yield* worker.client.terminate()
            }

            yield* Ref.update(workerPools, pools => {
              const newPools = new Map(pools)
              newPools.set(workerType, remainingWorkers)
              return newPools
            })
          }
        }),

      shutdown: () =>
        Effect.gen(function* () {
          const pools = yield* Ref.get(workerPools)
          
          for (const workers of pools.values()) {
            for (const worker of workers) {
              yield* worker.client.terminate()
            }
          }
          
          yield* Ref.set(workerPools, new Map())
          yield* Ref.set(requestQueues, new Map())
        })
    } satisfies WorkerManagerService
  })

/**
 * Live implementation of WorkerManagerService
 */
export const WorkerManagerServiceLive = Layer.effect(
  WorkerManagerService,
  make()
)

/**
 * Create WorkerManagerService with custom config
 */
export const WorkerManagerServiceLiveWith = (config: Partial<WorkerManagerConfig>) =>
  Layer.effect(
    WorkerManagerService,
    make({ ...defaultConfig, ...config })
  )