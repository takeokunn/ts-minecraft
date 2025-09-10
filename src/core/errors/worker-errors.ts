import { Data } from 'effect'

/**
 * Worker-related errors
 */

export class WorkerCommunicationError extends Data.TaggedError('WorkerCommunicationError')<{
  readonly workerType: string
  readonly operation: string
  readonly error: unknown
  readonly timestamp: Date
}> {
  constructor(workerType: string, operation: string, error: unknown) {
    super({ workerType, operation, error, timestamp: new Date() })
  }
}

export class WorkerTaskFailedError extends Data.TaggedError('WorkerTaskFailedError')<{
  readonly taskType: string
  readonly taskId: string
  readonly error: unknown
  readonly timestamp: Date
}> {
  constructor(taskType: string, taskId: string, error: unknown) {
    super({ taskType, taskId, error, timestamp: new Date() })
  }
}