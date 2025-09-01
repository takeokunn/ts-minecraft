
import { match } from 'ts-pattern';
import type { ComputationResult } from '@/domain/types';
import type { ComputationTask } from '@/workers/computation.worker';

const MAX_WORKERS = navigator.hardwareConcurrency || 4;

type WorkerStatus = {
  readonly worker: Worker;
  isBusy: boolean;
};

// Defines the shape of a task waiting in the queue
type QueuedTask<T extends ComputationTask> = {
  readonly task: T;
  readonly resolve: (value: ComputationResult<T['payload']>) => void;
  readonly reject: (reason?: Error) => void;
};

export type ComputationWorker = {
  /**
   * Posts a task to the worker pool.
   * The task will be queued and executed by the next available worker.
   * @param task The computation task to execute.
   * @returns A promise that resolves with the result from the worker.
   */
  postTask<T extends ComputationTask>(task: T): Promise<ComputationResult<T['payload']>>;
  /**
   * Terminates all workers and rejects any pending tasks.
   */
  close(): void;
};

/**
 * Creates a pool of computation workers to offload heavy tasks from the main thread.
 */
export function createComputationWorker(): ComputationWorker {
  const workers: WorkerStatus[] = Array.from({ length: MAX_WORKERS }, () => ({
    worker: new Worker(new URL('../workers/computation.worker.ts', import.meta.url), { type: 'module' }),
    isBusy: false,
  }));

  let taskQueue: QueuedTask<ComputationTask>[] = [];
  let isClosed = false;

  const findIdleWorker = (): WorkerStatus | undefined => {
    return workers.find(w => !w.isBusy);
  };

  const scheduleTasks = (): void => {
    if (isClosed) {
      return;
    }

    let idleWorker = findIdleWorker();
    while (idleWorker && taskQueue.length > 0) {
      const nextTask = taskQueue.shift();
      if (nextTask) {
        executeTask(idleWorker, nextTask);
      }
      idleWorker = findIdleWorker();
    }
  };

  const executeTask = <T extends ComputationTask>(workerStatus: WorkerStatus, queuedTask: QueuedTask<T>): void => {
    workerStatus.isBusy = true;
    const { task, resolve, reject } = queuedTask;

    const handleMessage = (ev: MessageEvent<ComputationResult<T['payload']>>) => {
      cleanUp();
      resolve(ev.data);
    };

    const handleError = (err: ErrorEvent) => {
      cleanUp();
      console.error(`Worker failed to execute task: ${task.type}`, err);
      reject(new Error(err.message));
    };

    const cleanUp = () => {
      workerStatus.worker.removeEventListener('message', handleMessage);
      workerStatus.worker.removeEventListener('error', handleError);
      workerStatus.isBusy = false;
      scheduleTasks();
    };

    workerStatus.worker.addEventListener('message', handleMessage, { once: true });
    workerStatus.worker.addEventListener('error', handleError, { once: true });
    workerStatus.worker.postMessage(task);
  };

  const postTask = <T extends ComputationTask>(task: T): Promise<ComputationResult<T['payload']>> => {
    return match(isClosed)
      .with(true, () => Promise.reject(new Error('ComputationWorker is closed.')))
      .otherwise(() => {
        return new Promise((resolve, reject) => {
          taskQueue.push({ task, resolve, reject });
          scheduleTasks();
        });
      });
  };

  const close = (): void => {
    if (isClosed) {
      return;
    }
    isClosed = true;
    workers.forEach(({ worker }) => worker.terminate());
    taskQueue.forEach(({ reject }) => reject(new Error('ComputationWorker is closed.')));
    taskQueue = [];
  };

  return {
    postTask,
    close,
  };
}
