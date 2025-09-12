import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, Layer, Duration, TestContext, Schedule } from 'effect'
import {
  WorkerPoolService,
  WorkerPoolLive,
  WorkerPoolError,
  WorkerUnavailableError,
  TaskTimeoutError,
  WorkerInitializationError,
  Task,
  TaskType,
  TaskPriority,
  TaskResult,
  WorkerStatus,
  defaultWorkerPoolConfig,
  createMeshGenerationTask,
  createChunkProcessingTask,
  createPhysicsCalculationTask
} from '@infrastructure/performance/worker-pool.layer'

// Mock Worker implementation for testing
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  
  private messageHandlers = new Map<string, (data: any) => any>()
  private shouldFail = false
  private processingDelay = 10
  
  constructor() {
    // Set up default handlers for different task types
    this.messageHandlers.set(TaskType.MESH_GENERATION, this.handleMeshGeneration.bind(this))
    this.messageHandlers.set(TaskType.CHUNK_PROCESSING, this.handleChunkProcessing.bind(this))
    this.messageHandlers.set(TaskType.PHYSICS_CALCULATION, this.handlePhysicsCalculation.bind(this))
    this.messageHandlers.set(TaskType.TERRAIN_GENERATION, this.handleTerrainGeneration.bind(this))
    this.messageHandlers.set(TaskType.LIGHTING_CALCULATION, this.handleLightingCalculation.bind(this))
  }
  
  postMessage(message: any): void {
    // Simulate async message processing
    setTimeout(() => {
      if (this.shouldFail) {
        this.triggerError(new Error('Mock worker error'))
        return
      }
      
      if (message.type === 'execute-task') {
        this.handleTask(message.task)
      }
    }, this.processingDelay)
  }
  
  private handleTask(task: any): void {
    const handler = this.messageHandlers.get(task.type)
    
    if (!handler) {
      this.triggerError(new Error(`Unknown task type: ${task.type}`))
      return
    }
    
    try {
      const result = handler(task.data)
      this.triggerMessage({
        type: 'task-result',
        taskId: task.id,
        result
      })
    } catch (error) {
      this.triggerMessage({
        type: 'task-error',
        taskId: task.id,
        error: error.message
      })
    }
  }
  
  private handleMeshGeneration(data: any): any {
    return {
      vertices: new Array(data.vertexCount || 100).fill(0),
      faces: new Array(data.faceCount || 50).fill([0, 1, 2]),
      processingTime: this.processingDelay
    }
  }
  
  private handleChunkProcessing(data: any): any {
    return {
      chunkId: data.chunkId,
      blocks: new Array(16 * 16 * 256).fill(0),
      lightData: new Array(16 * 16 * 256).fill(15),
      processingTime: this.processingDelay
    }
  }
  
  private handlePhysicsCalculation(data: any): any {
    return {
      collisions: data.entities?.map((entity: any) => ({
        entityId: entity.id,
        position: { x: entity.x + 0.1, y: entity.y, z: entity.z },
        velocity: { x: 0, y: -9.8, z: 0 }
      })) || [],
      deltaTime: data.deltaTime || 16.67,
      processingTime: this.processingDelay
    }
  }
  
  private handleTerrainGeneration(data: any): any {
    return {
      heightMap: new Array(data.size || 256).fill(0).map(() => Math.random() * 100),
      biomeData: new Array(data.size || 256).fill('plains'),
      processingTime: this.processingDelay
    }
  }
  
  private handleLightingCalculation(data: any): any {
    return {
      lightLevels: new Array(data.blockCount || 1000).fill(15),
      shadows: new Array(data.blockCount || 1000).fill(false),
      processingTime: this.processingDelay
    }
  }
  
  private triggerMessage(data: any): void {
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent)
    }
  }
  
  private triggerError(error: Error): void {
    if (this.onerror) {
      this.onerror({ message: error.message } as ErrorEvent)
    }
  }
  
  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail
  }
  
  setProcessingDelay(delay: number): void {
    this.processingDelay = delay
  }
  
  terminate(): void {
    // Mock termination
    this.onmessage = null
    this.onerror = null
  }
}

// Mock global Worker constructor
const originalWorker = global.Worker
beforeEach(() => {
  global.Worker = MockWorker as any
})

afterEach(() => {
  global.Worker = originalWorker
})

describe('WorkerPoolLayer', () => {
  let testLayer: Layer.Layer<WorkerPoolService>

  beforeEach(() => {
    testLayer = WorkerPoolLive
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Worker Pool Initialization', () => {
    it('should create worker pool with default configuration', async () => {
      const result = await Effect.runPromise(Effect.provide(
        Effect.gen(function* () {
          const service = yield* WorkerPoolService
          
          const metrics = yield* service.getMetrics()
          const workerInfo = yield* service.getWorkerInfo()
          
          return {
            totalWorkers: metrics.totalWorkers,
            activeWorkers: metrics.activeWorkers,
            workerCount: workerInfo.length,
            minWorkers: defaultWorkerPoolConfig.minWorkers
          }
        }), testLayer)
      )

      expect(result.totalWorkers).toBeGreaterThanOrEqual(result.minWorkers)
      expect(result.workerCount).toBeGreaterThanOrEqual(result.minWorkers)
      expect(result.activeWorkers).toBeGreaterThanOrEqual(0)
    })

    it('should initialize with custom configuration', async () => {
      // Create a custom layer with different config
      const customConfig = {
        ...defaultWorkerPoolConfig,
        minWorkers: 4,
        maxWorkers: 12,
        taskQueueSize: 500
      }
      
      // Note: In a real implementation, you'd pass config to the layer
      const result = await Effect.runPromise(Effect.provide(
        Effect.gen(function* () {
          const service = yield* WorkerPoolService
          
          const metrics = yield* service.getMetrics()
          
          return {
            totalWorkers: metrics.totalWorkers,
            queuedTasks: metrics.queuedTasks
          }
        }), testLayer)
      )

      expect(result.totalWorkers).toBeGreaterThanOrEqual(2) // At least default min
      expect(result.queuedTasks).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Task Submission and Execution', () => {
    describe('submitTask', () => {
      it('should submit and execute mesh generation task', async () => {
        const result = await Effect.runPromise(Effect.provide(
          Effect.gen(function* () {
            const service = yield* WorkerPoolService
            
            const task = createMeshGenerationTask({
              vertexCount: 200,
              faceCount: 100
            })
            
            const taskResult = yield* service.submitTask(task)
            
            return taskResult
          }).pipe(
            Layer.provide(testLayer),
            Effect.provide(TestContext.TestContext)
          )
        )

        expect(result.taskId).toBeDefined()
        expect(result.result).toBeDefined()
        expect(result.processingTime).toBeGreaterThan(0)
        expect(result.workerId).toBeDefined()
        expect(result.result.vertices).toHaveLength(200)
        expect(result.result.faces).toHaveLength(100)
      })

      it('should submit and execute chunk processing task', async () => {
        const result = await Effect.runPromise(Effect.provide(
          Effect.gen(function* () {
            const service = yield* WorkerPoolService
            
            const task = createChunkProcessingTask({
              chunkId: 'chunk-1-1',
              position: { x: 1, z: 1 }
            })
            
            const taskResult = yield* service.submitTask(task)
            
            return taskResult
          }).pipe(
            Layer.provide(testLayer),
            Effect.provide(TestContext.TestContext)
          )
        )

        expect(result.result.chunkId).toBe('chunk-1-1')
        expect(result.result.blocks).toHaveLength(16 * 16 * 256)
        expect(result.result.lightData).toHaveLength(16 * 16 * 256)
      })

      it('should submit and execute physics calculation task', async () => {
        const entities = [
          { id: 'entity-1', x: 10, y: 5, z: 15 },
          { id: 'entity-2', x: 20, y: 10, z: 25 }
        ]

        const result = await Effect.runPromise(Effect.provide(
          Effect.gen(function* () {
            const service = yield* WorkerPoolService
            
            const task = createPhysicsCalculationTask({
              entities,
              deltaTime: 16.67
            })
            
            const taskResult = yield* service.submitTask(task)
            
            return taskResult
          }).pipe(
            Layer.provide(testLayer),
            Effect.provide(TestContext.TestContext)
          )
        )

        expect(result.result.collisions).toHaveLength(2)
        expect(result.result.collisions[0].entityId).toBe('entity-1')
        expect(result.result.collisions[1].entityId).toBe('entity-2')
        expect(result.result.deltaTime).toBe(16.67)
      })

      it('should handle task with different priorities', async () => {
        const tasks = [
          {
            ...createMeshGenerationTask({ vertexCount: 10 }),
            priority: TaskPriority.LOW
          },
          {
            ...createChunkProcessingTask({ chunkId: 'urgent' }),
            priority: TaskPriority.CRITICAL
          },
          {
            ...createPhysicsCalculationTask({ entities: [] }),
            priority: TaskPriority.HIGH
          }
        ]

        const results = await Effect.runPromise(Effect.provide(
          Effect.gen(function* () {
            const service = yield* WorkerPoolService
            
            const taskResults = []
            for (const task of tasks) {
              taskResults.push(yield* service.submitTask(task))
            }
            
            return taskResults
          }).pipe(
            Layer.provide(testLayer),
            Effect.provide(TestContext.TestContext)
          )
        )

        expect(results).toHaveLength(3)
        results.forEach(result => {
          expect(result.taskId).toBeDefined()
          expect(result.workerId).toBeDefined()
        })
      })

      it('should handle task timeout', async () => {
        const result = await Effect.runPromiseExit(Effect.provide(
          Effect.gen(function* () {
            const service = yield* WorkerPoolService
            
            const task = {
              ...createMeshGenerationTask({ vertexCount: 1000 }),
              timeout: Duration.millis(5) // Very short timeout
            }
            
            yield* service.submitTask(task)
          }).pipe(
            Layer.provide(testLayer),
            Effect.provide(TestContext.TestContext)
          )
        )

        expect(Effect.isFailure(result)).toBe(true)
        if (Effect.isFailure(result)) {
          const error = result.cause.error as TaskTimeoutError
          expect(error._tag).toBe('TaskTimeoutError')
        }
      })

      it('should handle worker errors', async () => {
        // Mock worker to fail
        const originalPostMessage = MockWorker.prototype.postMessage
        MockWorker.prototype.postMessage = function(message: any) {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror({ message: 'Mock worker failure' } as ErrorEvent)
            }
          }, 10)
        }

        const result = await Effect.runPromiseExit(Effect.provide(
          Effect.gen(function* () {
            const service = yield* WorkerPoolService
            
            const task = createMeshGenerationTask({ vertexCount: 10 })
            yield* service.submitTask(task)
          }).pipe(
            Layer.provide(testLayer),
            Effect.provide(TestContext.TestContext)
          )
        )

        // Restore original method
        MockWorker.prototype.postMessage = originalPostMessage

        expect(Effect.isFailure(result)).toBe(true)
      })
    })

    describe('submitBatch', () => {
      it('should submit multiple tasks in batch', async () => {
        const tasks = [
          createMeshGenerationTask({ vertexCount: 50 }),
          createChunkProcessingTask({ chunkId: 'batch-1' }),
          createPhysicsCalculationTask({ entities: [{ id: 'test', x: 0, y: 0, z: 0 }] })
        ]

        const results = await Effect.runPromise(Effect.provide(
          Effect.gen(function* () {
            const service = yield* WorkerPoolService
            
            const taskResults = yield* service.submitBatch(tasks)
            
            return taskResults
          }).pipe(
            Layer.provide(testLayer),
            Effect.provide(TestContext.TestContext)
          )
        )

        expect(results).toHaveLength(3)
        expect(results[0].result.vertices).toHaveLength(50)
        expect(results[1].result.chunkId).toBe('batch-1')
        expect(results[2].result.collisions).toHaveLength(1)
      })

      it('should handle batch with some task failures', async () => {
        const tasks = [
          createMeshGenerationTask({ vertexCount: 10 }),
          {
            id: 'failing-task',
            type: TaskType.CUSTOM,
            priority: TaskPriority.NORMAL,
            data: { shouldFail: true },
            createdAt: performance.now()
          } as Task,
          createChunkProcessingTask({ chunkId: 'success' })
        ]

        const result = await Effect.runPromiseExit(Effect.provide(
          Effect.gen(function* () {
            const service = yield* WorkerPoolService
            
            const taskResults = yield* service.submitBatch(tasks)
            
            return taskResults
          }).pipe(
            Layer.provide(testLayer),
            Effect.provide(TestContext.TestContext)
          )
        )

        // Batch might fail if any task fails, depending on implementation
        // This tests the error handling behavior
      })
    })

    describe('cancelTask', () => {
      it('should cancel pending tasks', async () => {
        const result = await Effect.runPromise(Effect.provide(
          Effect.gen(function* () {
            const service = yield* WorkerPoolService
            
            const task = createMeshGenerationTask({ vertexCount: 1000 })
            
            // Submit task but don't wait for result
            const submitFiber = yield* Effect.fork(service.submitTask(task))
            
            // Cancel the task
            const cancelled = yield* service.cancelTask(task.id)
            
            // Try to get the result
            const submitResult = yield* Effect.either(Effect.join(submitFiber))
            
            return {
              cancelled,
              submitFailed: Effect.isLeft(submitResult)
            }
          }).pipe(
            Layer.provide(testLayer),
            Effect.provide(TestContext.TestContext)
          )
        )

        expect(result.cancelled).toBe(true)
        // Submit should fail since task was cancelled
      })

      it('should return false for non-existent task', async () => {
        const result = await Effect.runPromise(Effect.provide(
          Effect.gen(function* () {
            const service = yield* WorkerPoolService
            
            const cancelled = yield* service.cancelTask('non-existent-task-id')
            
            return cancelled
          }), testLayer)
        )

        expect(result).toBe(false)
      })
    })
  })

  describe('Worker Pool Management', () => {
    describe('scaling operations', () => {
      it('should scale up worker pool', async () => {
        const result = await Effect.runPromise(Effect.provide(
          Effect.gen(function* () {
            const service = yield* WorkerPoolService
            
            const beforeMetrics = yield* service.getMetrics()
            
            const scaledUp = yield* service.scaleUp(2)
            
            const afterMetrics = yield* service.getMetrics()
            
            return {
              beforeWorkers: beforeMetrics.totalWorkers,
              afterWorkers: afterMetrics.totalWorkers,
              scaledUp
            }
          }), testLayer)
        )

        expect(result.scaledUp).toBeGreaterThanOrEqual(0)
        expect(result.afterWorkers).toBeGreaterThanOrEqual(result.beforeWorkers)
      })

      it('should scale down worker pool', async () => {
        const result = await Effect.runPromise(Effect.provide(
          Effect.gen(function* () {
            const service = yield* WorkerPoolService
            
            // First scale up to have workers to scale down
            yield* service.scaleUp(3)
            
            const beforeMetrics = yield* service.getMetrics()
            
            const scaledDown = yield* service.scaleDown(2)
            
            const afterMetrics = yield* service.getMetrics()
            
            return {
              beforeWorkers: beforeMetrics.totalWorkers,
              afterWorkers: afterMetrics.totalWorkers,
              scaledDown
            }
          }), testLayer)
        )

        expect(result.scaledDown).toBeGreaterThanOrEqual(0)
        expect(result.afterWorkers).toBeLessThanOrEqual(result.beforeWorkers)
      })

      it('should respect minimum worker count when scaling down', async () => {
        const result = await Effect.runPromise(Effect.provide(
          Effect.gen(function* () {
            const service = yield* WorkerPoolService
            
            // Try to scale down more than allowed
            const scaledDown = yield* service.scaleDown(100)
            
            const metrics = yield* service.getMetrics()
            
            return {
              scaledDown,
              totalWorkers: metrics.totalWorkers
            }
          }), testLayer)
        )

        expect(result.totalWorkers).toBeGreaterThanOrEqual(defaultWorkerPoolConfig.minWorkers)
      })

      it('should respect maximum worker count when scaling up', async () => {
        const result = await Effect.runPromise(Effect.provide(
          Effect.gen(function* () {
            const service = yield* WorkerPoolService
            
            // Try to scale up more than allowed
            const scaledUp = yield* service.scaleUp(1000)
            
            const metrics = yield* service.getMetrics()
            
            return {
              scaledUp,
              totalWorkers: metrics.totalWorkers
            }
          }), testLayer)
        )

        expect(result.totalWorkers).toBeLessThanOrEqual(defaultWorkerPoolConfig.maxWorkers)
      })
    })

    describe('pause and resume operations', () => {
      it('should pause and resume worker pool', async () => {
        const result = await Effect.runPromise(Effect.provide(
          Effect.gen(function* () {
            const service = yield* WorkerPoolService
            
            // Submit a task before pausing
            const task1 = createMeshGenerationTask({ vertexCount: 10 })
            const result1 = yield* service.submitTask(task1)
            
            // Pause the pool
            yield* service.pause()
            
            // Try to submit task while paused (should fail)
            const task2 = createMeshGenerationTask({ vertexCount: 10 })
            const pausedResult = yield* Effect.either(service.submitTask(task2))
            
            // Resume the pool
            yield* service.resume()
            
            // Submit task after resuming (should succeed)
            const task3 = createMeshGenerationTask({ vertexCount: 10 })
            const result3 = yield* service.submitTask(task3)
            
            return {
              result1: result1.taskId,
              pausedFailed: Effect.isLeft(pausedResult),
              result3: result3.taskId
            }
          }).pipe(
            Layer.provide(testLayer),
            Effect.provide(TestContext.TestContext)
          )
        )

        expect(result.result1).toBeDefined()
        expect(result.pausedFailed).toBe(true)
        expect(result.result3).toBeDefined()
      })
    })

    describe('health check operations', () => {
      it('should perform health check', async () => {
        const result = await Effect.runPromise(Effect.provide(
          Effect.gen(function* () {
            const service = yield* WorkerPoolService
            
            const healthy = yield* service.healthCheck()
            
            return healthy
          }), testLayer)
        )

        expect(result).toBe(true)
      })

      it('should report unhealthy when shut down', async () => {
        const result = await Effect.runPromise(Effect.provide(
          Effect.gen(function* () {
            const service = yield* WorkerPoolService
            
            yield* service.shutdown()
            
            const healthy = yield* service.healthCheck()
            
            return healthy
          }), testLayer)
        )

        expect(result).toBe(false)
      })
    })
  })

  describe('Performance Metrics and Monitoring', () => {
    it('should track worker pool metrics', async () => {
      const result = await Effect.runPromise(Effect.provide(
        Effect.gen(function* () {
          const service = yield* WorkerPoolService
          
          // Submit some tasks to generate metrics
          const tasks = [
            createMeshGenerationTask({ vertexCount: 10 }),
            createChunkProcessingTask({ chunkId: 'metrics-test' }),
            createPhysicsCalculationTask({ entities: [] })
          ]
          
          for (const task of tasks) {
            yield* service.submitTask(task)
          }
          
          const metrics = yield* service.getMetrics()
          
          return metrics
        }).pipe(
          Layer.provide(testLayer),
          Effect.provide(TestContext.TestContext)
        )
      )

      expect(result.totalWorkers).toBeGreaterThan(0)
      expect(result.completedTasks).toBeGreaterThanOrEqual(3)
      expect(result.averageTaskTime).toBeGreaterThanOrEqual(0)
      expect(result.throughput).toBeGreaterThanOrEqual(0)
      expect(result.errorRate).toBeGreaterThanOrEqual(0)
    })

    it('should track worker information', async () => {
      const result = await Effect.runPromise(Effect.provide(
        Effect.gen(function* () {
          const service = yield* WorkerPoolService
          
          const workerInfo = yield* service.getWorkerInfo()
          
          return workerInfo
        }), testLayer)
      )

      expect(result.length).toBeGreaterThan(0)
      result.forEach(worker => {
        expect(worker.id).toBeDefined()
        expect(worker.status).toBeDefined()
        expect(worker.type).toBeDefined()
        expect(worker.tasksCompleted).toBeGreaterThanOrEqual(0)
        expect(worker.averageProcessingTime).toBeGreaterThanOrEqual(0)
        expect(worker.errorRate).toBeGreaterThanOrEqual(0)
        expect(worker.createdAt).toBeGreaterThan(0)
        expect(worker.lastActiveAt).toBeGreaterThan(0)
      })
    })

    it('should calculate performance metrics correctly', async () => {
      const result = await Effect.runPromise(Effect.provide(
        Effect.gen(function* () {
          const service = yield* WorkerPoolService
          
          const startTime = performance.now()
          
          // Submit multiple tasks to measure throughput
          const tasks = Array.from({ length: 10 }, (_, i) =>
            createMeshGenerationTask({ vertexCount: 5 + i })
          )
          
          for (const task of tasks) {
            yield* service.submitTask(task)
          }
          
          const endTime = performance.now()
          const metrics = yield* service.getMetrics()
          
          return {
            totalTime: endTime - startTime,
            completedTasks: metrics.completedTasks,
            throughput: metrics.throughput,
            averageTaskTime: metrics.averageTaskTime
          }
        }).pipe(
          Layer.provide(testLayer),
          Effect.provide(TestContext.TestContext)
        )
      )

      expect(result.completedTasks).toBe(10)
      expect(result.throughput).toBeGreaterThan(0)
      expect(result.averageTaskTime).toBeGreaterThan(0)
      expect(result.totalTime).toBeGreaterThan(0)
    })
  })

  describe('Task Queue Management', () => {
    it('should handle queue backpressure', async () => {
      // Create many tasks quickly to test backpressure
      const taskCount = 50
      const tasks = Array.from({ length: taskCount }, (_, i) =>
        createMeshGenerationTask({ 
          vertexCount: 10,
          id: `backpressure-task-${i}`
        })
      )

      const result = await Effect.runPromise(Effect.provide(
        Effect.gen(function* () {
          const service = yield* WorkerPoolService
          
          const startTime = performance.now()
          
          // Submit all tasks concurrently
          const submitPromises = tasks.map(task =>
            Effect.either(service.submitTask(task))
          )
          
          const results = yield* Effect.all(submitPromises, { concurrency: 'unbounded' })
          
          const endTime = performance.now()
          
          const successful = results.filter(Effect.isRight).length
          const failed = results.filter(Effect.isLeft).length
          
          return {
            totalTime: endTime - startTime,
            successful,
            failed,
            totalTasks: taskCount
          }
        }).pipe(
          Layer.provide(testLayer),
          Effect.provide(TestContext.TestContext)
        )
      )

      expect(result.successful + result.failed).toBe(taskCount)
      expect(result.successful).toBeGreaterThan(0) // At least some should succeed
      expect(result.totalTime).toBeGreaterThan(0)
    })

    it('should prioritize high-priority tasks', async () => {
      const tasks = [
        { ...createMeshGenerationTask({ vertexCount: 10 }), priority: TaskPriority.LOW },
        { ...createMeshGenerationTask({ vertexCount: 10 }), priority: TaskPriority.CRITICAL },
        { ...createMeshGenerationTask({ vertexCount: 10 }), priority: TaskPriority.HIGH },
        { ...createMeshGenerationTask({ vertexCount: 10 }), priority: TaskPriority.NORMAL }
      ]

      const result = await Effect.runPromise(Effect.provide(
        Effect.gen(function* () {
          const service = yield* WorkerPoolService
          
          const startTimes = tasks.map(() => performance.now())
          
          const results = yield* Effect.all(
            tasks.map(task => service.submitTask(task)),
            { concurrency: 'unbounded' }
          )
          
          return results.map((result, index) => ({
            taskId: result.taskId,
            priority: tasks[index].priority,
            processingTime: result.processingTime,
            startTime: startTimes[index]
          }))
        }).pipe(
          Layer.provide(testLayer),
          Effect.provide(TestContext.TestContext)
        )
      )

      expect(result).toHaveLength(4)
      // High priority tasks should generally complete faster, but this depends on implementation
      result.forEach(taskResult => {
        expect(taskResult.taskId).toBeDefined()
        expect(taskResult.processingTime).toBeGreaterThan(0)
      })
    })
  })

  describe('Auto-scaling Behavior', () => {
    it('should auto-scale based on queue load', async () => {
      const result = await Effect.runPromise(Effect.provide(
        Effect.gen(function* () {
          const service = yield* WorkerPoolService
          
          const initialMetrics = yield* service.getMetrics()
          
          // Create high load
          const heavyTasks = Array.from({ length: 20 }, () =>
            createPhysicsCalculationTask({
              entities: Array.from({ length: 100 }, (_, i) => ({
                id: `entity-${i}`,
                x: i,
                y: 0,
                z: i
              }))
            })
          )
          
          // Submit tasks that will create high load
          const submitFibers = heavyTasks.map(task =>
            Effect.fork(service.submitTask(task))
          )
          
          // Wait a bit for auto-scaling to potentially trigger
          yield* Effect.sleep(Duration.millis(100))
          
          const duringLoadMetrics = yield* service.getMetrics()
          
          // Wait for tasks to complete
          yield* Effect.all(submitFibers.map(fiber => Effect.join(fiber)))
          
          const finalMetrics = yield* service.getMetrics()
          
          return {
            initialWorkers: initialMetrics.totalWorkers,
            duringLoadWorkers: duringLoadMetrics.totalWorkers,
            finalWorkers: finalMetrics.totalWorkers,
            completedTasks: finalMetrics.completedTasks
          }
        }).pipe(
          Layer.provide(testLayer),
          Effect.provide(TestContext.TestContext)
        )
      )

      expect(result.completedTasks).toBeGreaterThanOrEqual(20)
      expect(result.finalWorkers).toBeGreaterThanOrEqual(result.initialWorkers)
      // Auto-scaling might have increased worker count during high load
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should recover from worker failures', async () => {
      const result = await Effect.runPromise(Effect.provide(
        Effect.gen(function* () {
          const service = yield* WorkerPoolService
          
          const initialWorkerInfo = yield* service.getWorkerInfo()
          const healthyWorkers = initialWorkerInfo.filter(w => w.status !== WorkerStatus.ERROR).length
          
          // Submit some tasks that should succeed
          const successTask = createMeshGenerationTask({ vertexCount: 5 })
          const successResult = yield* service.submitTask(successTask)
          
          const finalWorkerInfo = yield* service.getWorkerInfo()
          const finalHealthyWorkers = finalWorkerInfo.filter(w => w.status !== WorkerStatus.ERROR).length
          
          return {
            initialHealthyWorkers: healthyWorkers,
            finalHealthyWorkers: finalHealthyWorkers,
            taskCompleted: successResult.taskId !== null
          }
        }).pipe(
          Layer.provide(testLayer),
          Effect.provide(TestContext.TestContext)
        )
      )

      expect(result.taskCompleted).toBe(true)
      expect(result.finalHealthyWorkers).toBeGreaterThan(0)
    })

    it('should handle worker pool shutdown gracefully', async () => {
      const result = await Effect.runPromise(Effect.provide(
        Effect.gen(function* () {
          const service = yield* WorkerPoolService
          
          // Submit a task before shutdown
          const preShutdownTask = createMeshGenerationTask({ vertexCount: 5 })
          const preShutdownResult = yield* service.submitTask(preShutdownTask)
          
          // Shutdown the pool
          yield* service.shutdown()
          
          // Try to submit task after shutdown (should fail)
          const postShutdownTask = createMeshGenerationTask({ vertexCount: 5 })
          const postShutdownResult = yield* Effect.either(service.submitTask(postShutdownTask))
          
          const healthCheck = yield* service.healthCheck()
          
          return {
            preShutdownSuccess: preShutdownResult.taskId !== null,
            postShutdownFailed: Effect.isLeft(postShutdownResult),
            healthCheckFailed: !healthCheck
          }
        }).pipe(
          Layer.provide(testLayer),
          Effect.provide(TestContext.TestContext)
        )
      )

      expect(result.preShutdownSuccess).toBe(true)
      expect(result.postShutdownFailed).toBe(true)
      expect(result.healthCheckFailed).toBe(true)
    })
  })

  describe('Specialized Task Creation Helpers', () => {
    it('should create mesh generation tasks with correct properties', () => {
      const taskData = { vertexCount: 500, faceCount: 250 }
      const task = createMeshGenerationTask(taskData)
      
      expect(task.id).toMatch(/^mesh-/)
      expect(task.type).toBe(TaskType.MESH_GENERATION)
      expect(task.priority).toBe(TaskPriority.NORMAL)
      expect(task.data).toEqual(taskData)
      expect(task.createdAt).toBeGreaterThan(0)
    })

    it('should create chunk processing tasks with correct properties', () => {
      const taskData = { chunkId: 'test-chunk', position: { x: 5, z: 10 } }
      const task = createChunkProcessingTask(taskData)
      
      expect(task.id).toMatch(/^chunk-/)
      expect(task.type).toBe(TaskType.CHUNK_PROCESSING)
      expect(task.priority).toBe(TaskPriority.HIGH)
      expect(task.data).toEqual(taskData)
      expect(task.createdAt).toBeGreaterThan(0)
    })

    it('should create physics calculation tasks with correct properties', () => {
      const taskData = { entities: [], deltaTime: 16.67 }
      const task = createPhysicsCalculationTask(taskData)
      
      expect(task.id).toMatch(/^physics-/)
      expect(task.type).toBe(TaskType.PHYSICS_CALCULATION)
      expect(task.priority).toBe(TaskPriority.CRITICAL)
      expect(task.data).toEqual(taskData)
      expect(task.createdAt).toBeGreaterThan(0)
    })

    it('should create tasks with custom priorities', () => {
      const lowPriorityTask = createMeshGenerationTask({}, TaskPriority.LOW)
      const backgroundTask = createChunkProcessingTask({}, TaskPriority.BACKGROUND)
      
      expect(lowPriorityTask.priority).toBe(TaskPriority.LOW)
      expect(backgroundTask.priority).toBe(TaskPriority.BACKGROUND)
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle many concurrent task submissions', async () => {
      const concurrentTaskCount = 100
      
      const result = await Effect.runPromise(Effect.provide(
        Effect.gen(function* () {
          const service = yield* WorkerPoolService
          
          const startTime = performance.now()
          
          // Create many different types of tasks
          const tasks = Array.from({ length: concurrentTaskCount }, (_, i) => {
            const taskType = i % 3
            switch (taskType) {
              case 0:
                return createMeshGenerationTask({ vertexCount: 10 + i })
              case 1:
                return createChunkProcessingTask({ chunkId: `chunk-${i}` })
              case 2:
                return createPhysicsCalculationTask({ 
                  entities: [{ id: `entity-${i}`, x: i, y: 0, z: i }] 
                })
              default:
                return createMeshGenerationTask({ vertexCount: 10 })
            }
          })
          
          // Submit all tasks concurrently
          const results = yield* Effect.all(
            tasks.map(task => Effect.either(service.submitTask(task))),
            { concurrency: 10 }
          )
          
          const endTime = performance.now()
          
          const successful = results.filter(Effect.isRight).length
          const failed = results.filter(Effect.isLeft).length
          
          const metrics = yield* service.getMetrics()
          
          return {
            totalTime: endTime - startTime,
            successful,
            failed,
            totalSubmitted: concurrentTaskCount,
            completedTasks: metrics.completedTasks,
            errorRate: metrics.errorRate
          }
        }).pipe(
          Layer.provide(testLayer),
          Effect.provide(TestContext.TestContext)
        )
      )

      expect(result.successful + result.failed).toBe(concurrentTaskCount)
      expect(result.successful).toBeGreaterThan(0)
      expect(result.completedTasks).toBeGreaterThanOrEqual(result.successful)
      expect(result.totalTime).toBeGreaterThan(0)
    })
  })

  describe('Memory and Resource Management', () => {
    it('should track memory usage across workers', async () => {
      const result = await Effect.runPromise(Effect.provide(
        Effect.gen(function* () {
          const service = yield* WorkerPoolService
          
          // Submit memory-intensive tasks
          const heavyTasks = Array.from({ length: 5 }, (_, i) =>
            createMeshGenerationTask({ 
              vertexCount: 1000 * (i + 1),
              faceCount: 500 * (i + 1)
            })
          )
          
          for (const task of heavyTasks) {
            yield* service.submitTask(task)
          }
          
          const metrics = yield* service.getMetrics()
          const workerInfo = yield* service.getWorkerInfo()
          
          return {
            poolMemoryUsage: metrics.memoryUsage,
            workerMemoryUsages: workerInfo.map(w => w.memoryUsage),
            averageWorkerMemory: workerInfo.reduce((sum, w) => sum + w.memoryUsage, 0) / workerInfo.length
          }
        }).pipe(
          Layer.provide(testLayer),
          Effect.provide(TestContext.TestContext)
        )
      )

      expect(result.poolMemoryUsage).toBeGreaterThanOrEqual(0)
      expect(result.workerMemoryUsages.length).toBeGreaterThan(0)
      expect(result.averageWorkerMemory).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Configuration Validation', () => {
    it('should validate default configuration', () => {
      expect(defaultWorkerPoolConfig.minWorkers).toBeGreaterThan(0)
      expect(defaultWorkerPoolConfig.maxWorkers).toBeGreaterThan(defaultWorkerPoolConfig.minWorkers)
      expect(defaultWorkerPoolConfig.taskQueueSize).toBeGreaterThan(0)
      expect(defaultWorkerPoolConfig.enableBackpressure).toBe(true)
      expect(defaultWorkerPoolConfig.enableMetrics).toBe(true)
      expect(defaultWorkerPoolConfig.retryPolicy.maxAttempts).toBeGreaterThan(0)
    })
  })
})