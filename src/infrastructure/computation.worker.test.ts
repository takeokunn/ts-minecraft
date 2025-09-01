
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { fc } from '@fast-check/vitest';
import { match, P } from 'ts-pattern';

import { createComputationWorker } from './computation.worker';
import { blockTypeNames } from '@/domain/block';
import type { GenerationParams } from '@/domain/types';
import type { GenerateChunkTask } from '@/workers/computation.worker';

// A mock Worker for robust testing. Using vi.fn() and letting types be inferred
// where the strict Mock<TArgs, TReturns> generic causes issues.
type MockWorker = {
  postMessage: Mock;
  terminate: Mock;
  addEventListener: (event: 'message' | 'error', listener: (ev: Event) => void) => void;
  removeEventListener: (event: 'message' | 'error', listener: (ev: Event) => void) => void;
  // Test-only methods to simulate worker behavior
  mockReceiveMessage: (data: unknown) => void;
  mockReceiveError: (error: Error) => void;
};

const createMockWorker = (): MockWorker => {
  const listeners: Record<'message' | 'error', ((ev: Event) => void)[]> = {
    message: [],
    error: [],
  };

  return {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: (event, listener) => {
      listeners[event]?.push(listener);
    },
    removeEventListener: (event, listener) => {
      const eventListeners = listeners[event];
      const index = eventListeners?.indexOf(listener);
      if (index !== undefined && index > -1) {
        eventListeners.splice(index, 1);
      }
    },
    mockReceiveMessage: data => {
      listeners.message.forEach(l => l(new MessageEvent('message', { data })));
    },
    mockReceiveError: error => {
      listeners.error.forEach(l => l(new ErrorEvent('error', { error })));
    },
  };
};

// Arbitraries for Property-Based Testing
const positionArbitrary = fc.record({
  x: fc.integer(),
  y: fc.integer(),
  z: fc.integer(),
});

const placedBlockArbitrary = fc.record({
  x: fc.integer(),
  y: fc.integer(),
  z: fc.integer(),
  blockType: fc.constantFrom(...blockTypeNames),
});

const generationParamsArbitrary: fc.Arbitrary<GenerationParams> = fc.record({
  chunkX: fc.integer(),
  chunkZ: fc.integer(),
  seeds: fc.record({
    world: fc.integer(),
    biome: fc.integer(),
    trees: fc.integer(),
  }),
  amplitude: fc.float({ noNaN: true }),
  editedBlocks: fc.record({
    destroyed: fc.array(positionArbitrary),
    placed: fc.array(placedBlockArbitrary),
  }),
});

const generateChunkTaskArbitrary: fc.Arbitrary<GenerateChunkTask> = generationParamsArbitrary.map(payload => ({
  type: 'generateChunk',
  payload,
}));

// Helper to get a guaranteed sample from an arbitrary for tests that need one.
const getSample = <T>(arbitrary: fc.Arbitrary<T>): T => {
  const sample = fc.sample(arbitrary, 1)[0];
  if (sample === undefined) {
    throw new Error('Failed to generate a sample from arbitrary');
  }
  return sample;
};

describe('infrastructure/computation.worker', () => {
  let mockWorkers: MockWorker[] = [];
  const workerCount = 4;

  beforeEach(() => {
    mockWorkers = Array.from({ length: workerCount }, createMockWorker);
    const workersToCreate = [...mockWorkers];
    vi.stubGlobal('navigator', { hardwareConcurrency: workerCount });
    vi.stubGlobal('Worker', vi.fn(() => workersToCreate.shift()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create a pool of workers on instantiation and terminate them on close', () => {
    const workerPool = createComputationWorker();
    expect(Worker).toHaveBeenCalledTimes(workerCount);

    workerPool.close();
    mockWorkers.forEach(worker => {
      expect(worker.terminate).toHaveBeenCalledTimes(1);
    });
  });

  it('should post a task to a worker and resolve with the result', async () => {
    await fc.assert(
      fc.asyncProperty(generateChunkTaskArbitrary, fc.anything(), async (task, resultData) => {
        const workerPool = createComputationWorker();
        const promise = workerPool.postTask(task);

        const usedWorker = mockWorkers.find(w => w.postMessage.mock.calls.length > 0);
        expect(usedWorker).toBeDefined();
        if (!usedWorker) return;

        usedWorker.mockReceiveMessage({ result: resultData, workerId: 0 });

        const result = await promise;

        expect(usedWorker.postMessage).toHaveBeenCalledWith(task);
        expect(result.result).toEqual(resultData);

        workerPool.close();
      }),
    );
  });

  it('should reject the promise if a worker throws an error', async () => {
    await fc.assert(
      fc.asyncProperty(generateChunkTaskArbitrary, fc.string(), async (task, errorMessage) => {
        const workerPool = createComputationWorker();
        const promise = workerPool.postTask(task);

        const usedWorker = mockWorkers.find(w => w.postMessage.mock.calls.length > 0);
        expect(usedWorker).toBeDefined();
        if (!usedWorker) return;

        usedWorker.mockReceiveError(new Error(errorMessage));

        await expect(promise).rejects.toThrow(errorMessage);

        workerPool.close();
      }),
    );
  });

  it('should queue tasks when all workers are busy', async () => {
    const workerPool = createComputationWorker();
    const basePayload = getSample(generationParamsArbitrary);
    const tasks: GenerateChunkTask[] = Array.from({ length: workerCount + 2 }, (_, i) => ({
      type: 'generateChunk',
      payload: { ...basePayload, chunkX: i },
    }));
    const results = tasks.map((_, i) => ({ result: `data-${i}`, workerId: i % workerCount }));

    const promises = tasks.map(task => workerPool.postTask(task));

    expect(mockWorkers.every(w => w.postMessage.mock.calls.length === 1)).toBe(true);

    for (let i = 0; i < workerCount; i++) {
      mockWorkers[i]?.mockReceiveMessage(results[i]);
    }
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockWorkers[0]?.postMessage).toHaveBeenCalledTimes(2);
    expect(mockWorkers[1]?.postMessage).toHaveBeenCalledTimes(2);

    mockWorkers[0]?.mockReceiveMessage(results[workerCount]);
    mockWorkers[1]?.mockReceiveMessage(results[workerCount + 1]);

    const finalResults = await Promise.all(promises);
    expect(finalResults.map(r => r.result)).toEqual(expect.arrayContaining(results.map(r => r.result)));

    workerPool.close();
  });

  describe('close() behavior', () => {
    it('should reject pending tasks when closed', async () => {
      const workerPool = createComputationWorker();
      const task = getSample(generateChunkTaskArbitrary);
      const promise = workerPool.postTask(task);

      workerPool.close();

      await expect(promise).rejects.toThrow('ComputationWorker is closed.');
    });

    it('should reject new tasks if the pool is already closed', async () => {
      const workerPool = createComputationWorker();
      workerPool.close();

      const task = getSample(generateChunkTaskArbitrary);
      const promise = workerPool.postTask(task);

      await expect(promise).rejects.toThrow('ComputationWorker is closed.');
    });

    it('should use ts-pattern for handling closed state', async () => {
      const workerPool = createComputationWorker();
      workerPool.close();

      const task = getSample(generateChunkTaskArbitrary);
      const result = await workerPool.postTask(task).catch(e => e);

      const outcome = match(result)
        .with(P.instanceOf(Error), e => e.message)
        .otherwise(() => 'success');

      expect(outcome).toBe('ComputationWorker is closed.');
    });
  });
});
