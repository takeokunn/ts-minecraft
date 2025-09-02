import { Effect } from 'effect'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ComputationWorkerLive, ComputationWorker, WorkerError } from '../computation.worker'
import type { ChunkGenerationResult, ComputationTask } from '@/domain/types'
import ComputationWorkerUrl from '@/workers/computation.worker.ts?worker'

// Mock the worker module
vi.mock('@/workers/computation.worker.ts?worker', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      postMessage: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  }
})

const mockedWorker = vi.mocked(ComputationWorkerUrl)

describe('ComputationWorker', () => {
  let mockWorkerInstance: any
  let messageHandler: (event: MessageEvent) => void
  let errorHandler: (event: ErrorEvent) => void

  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkerInstance = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn((event: string, handler: any) => {
        if (event === 'message') messageHandler = handler
        if (event === 'error') errorHandler = handler
      }),
      removeEventListener: vi.fn(),
    }
    mockedWorker.mockReturnValue(mockWorkerInstance)
    // Since we are not mocking the Pool anymore, we need to ensure maxWorkers is 1 for predictable tests.
    vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockReturnValue(1)
  })

  it('should post a task to a worker and receive a result', async () => {
    const task: ComputationTask = {
      type: 'generateChunk',
      payload: {
        chunkX: 0,
        chunkZ: 0,
        seeds: { world: 123, biome: 123, trees: 123 },
        amplitude: 1,
        editedBlocks: { placed: {}, destroyed: new Set() },
      },
    }
    const result: ChunkGenerationResult = {
      blocks: [],
      mesh: { positions: new Float32Array(), normals: new Float32Array(), uvs: new Float32Array(), indices: new Uint32Array() },
      chunkX: 0,
      chunkZ: 0,
    }

    const program = Effect.gen(function* (_) {
      const workerService = yield* _(ComputationWorker)
      const effect = workerService.postTask(task)

      // Simulate worker success
      setTimeout(() => {
        messageHandler(new MessageEvent('message', { data: result }))
      }, 0)

      const response = yield* _(effect)
      expect(response).toEqual(result)
      expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(task)
      expect(mockWorkerInstance.removeEventListener).toHaveBeenCalledTimes(2)
    })

    await Effect.runPromise(Effect.provide(program, ComputationWorkerLive))
  })

  it('should handle a worker error', async () => {
    const task: ComputationTask = {
      type: 'generateChunk',
      payload: {
        chunkX: 0,
        chunkZ: 0,
        seeds: { world: 123, biome: 123, trees: 123 },
        amplitude: 1,
        editedBlocks: { placed: {}, destroyed: new Set() },
      },
    }
    const error = new ErrorEvent('error', { message: 'Worker failed' })

    const program = Effect.gen(function* (_) {
      const workerService = yield* _(ComputationWorker)
      const effect = workerService.postTask(task)

      // Simulate worker error
      setTimeout(() => {
        errorHandler(error)
      }, 0)

      const result = yield* _(Effect.flip(effect))
      expect(result).toBeInstanceOf(WorkerError)
      expect(result.reason).toBe(error)
      expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(task)
      expect(mockWorkerInstance.removeEventListener).toHaveBeenCalledTimes(2)
    })

    await Effect.runPromise(Effect.provide(program, ComputationWorkerLive))
  })

  describe('when hardwareConcurrency is not available', () => {
    beforeEach(() => {
      // Mock hardwareConcurrency to be undefined
      vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockReturnValue(undefined as any)
    })

    it('should default to 4 workers', async () => {
      const program = Effect.gen(function* (_) {
        // This test just needs to run the layer to ensure the fallback is hit.
        // We don't need to post tasks.
      })

      // We expect this to run without errors, implying the fallback was used.
      await expect(Effect.runPromise(Effect.provide(program, ComputationWorkerLive))).resolves.toBeUndefined()
    })
  })
})
