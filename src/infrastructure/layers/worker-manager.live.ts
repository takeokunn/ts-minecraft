import { Layer, Effect, Ref, Queue } from 'effect'
import { WorkerManager } from '@/services/worker/worker-manager.service'
import { createWorkerClient } from '@/workers/shared/worker-base'
import * as S from "/schema/Schema"

/**
 * WorkerManager Live implementation
 * Manages worker lifecycle and communication
 */
export const WorkerManagerLive = Layer.effect(
  WorkerManager,
  Effect.gen(function* () {
    // Worker pool management
    const workers = yield* Ref.make<Map<string, Worker>>(new Map())
    const _messageQueue = yield* Queue.bounded<{
      id: string
      type: string
      data: unknown
    }>(100)

    // Create a new worker
    const createWorker = (type: string) =>
      Effect.gen(function* () {
        const workerUrl = `/workers/${type}.worker.js`
        const worker = new Worker(workerUrl, { type: 'module' })
        
        // Store worker reference
        yield* Ref.update(workers, (map) => {
          const newMap = new Map(map)
          newMap.set(type, worker)
          return newMap
        })
        
        return worker
      })

    // Get or create worker
    const getWorker = (type: string) =>
      Effect.gen(function* () {
        const currentWorkers = yield* Ref.get(workers)
        const existing = currentWorkers.get(type)
        
        if (existing) {
          return existing
        }
        
        return yield* createWorker(type)
      })

    // Send task to worker
    const sendTask = <TIn, TOut>(
      workerType: string,
      data: TIn,
      inputSchema: S.Schema<TIn>,
      outputSchema: S.Schema<TOut>
    ) =>
      Effect.gen(function* () {
        const worker = yield* getWorker(workerType)
        const client = createWorkerClient(worker, {
          inputSchema,
          outputSchema,
          timeout: 30000 // 30 second timeout
        })
        
        return yield* client.sendMessage(data)
      })

    // Terminate a specific worker
    const terminateWorker = (type: string) =>
      Effect.gen(function* () {
        const currentWorkers = yield* Ref.get(workers)
        const worker = currentWorkers.get(type)
        
        if (worker) {
          worker.terminate()
          yield* Ref.update(workers, (map) => {
            const newMap = new Map(map)
            newMap.delete(type)
            return newMap
          })
        }
      })

    // Terminate all workers
    const terminateAll = () =>
      Effect.gen(function* () {
        const currentWorkers = yield* Ref.get(workers)
        
        for (const [, worker] of currentWorkers) {
          worker.terminate()
        }
        yield* Ref.set(workers, new Map())
      })

    // Get worker status
    const getStatus = () =>
      Effect.gen(function* () {
        const currentWorkers = yield* Ref.get(workers)
        return {
          activeWorkers: Array.from(currentWorkers.keys()),
          workerCount: currentWorkers.size
        }
      })

    return WorkerManager.of({
      createWorker,
      getWorker,
      sendTask,
      terminateWorker,
      terminateAll,
      getStatus,
    })
  })
)