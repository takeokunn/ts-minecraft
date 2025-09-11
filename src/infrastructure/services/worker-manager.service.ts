import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

export interface WorkerManagerInterface {
  readonly sendTask: <R, A>(
    workerId: string, 
    request: R, 
    requestSchema: any, 
    responseSchema: any
  ) => Effect.Effect<A, never, never>
  readonly createWorker: (workerId: string, script: string) => Effect.Effect<void, never, never>
  readonly terminateWorker: (workerId: string) => Effect.Effect<void, never, never>
  readonly getWorkerStatus: (workerId: string) => Effect.Effect<string, never, never>
}

export class WorkerManager extends Context.GenericTag('WorkerManager')<
  WorkerManager,
  WorkerManagerInterface
>() {}