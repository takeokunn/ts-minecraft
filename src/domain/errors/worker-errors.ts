import { defineError } from '@domain/errors/generator'
import { SystemError } from '@domain/errors/base-errors'

/**
 * Worker communication failed
 * Recovery: Retry communication or fallback to main thread
 */
export const WorkerCommunicationError = defineError<{
  readonly workerType: string
  readonly operation: 'start' | 'stop' | 'message' | 'transfer'
  readonly error: unknown
  readonly workerState?: string
}>('WorkerCommunicationError', SystemError, 'retry', 'high')

/**
 * Worker task execution failed
 * Recovery: Retry task or execute on main thread
 */
export const WorkerTaskFailedError = defineError<{
  readonly taskType: string
  readonly taskId: string
  readonly error: unknown
  readonly retryCount?: number
  readonly taskData?: unknown
}>('WorkerTaskFailedError', SystemError, 'retry', 'medium')

/**
 * Worker initialization failed
 * Recovery: Use main thread processing or disable feature
 */
export const WorkerInitializationError = defineError<{
  readonly workerType: string
  readonly scriptPath: string
  readonly reason: string
  readonly browserSupport?: boolean
}>('WorkerInitializationError', SystemError, 'fallback', 'high')

/**
 * Worker pool exhausted
 * Recovery: Queue task or create additional worker
 */
export const WorkerPoolExhaustedError = defineError<{
  readonly poolType: string
  readonly maxWorkers: number
  readonly queueSize: number
  readonly taskType: string
}>('WorkerPoolExhaustedError', SystemError, 'fallback', 'medium')

/**
 * Worker terminated unexpectedly
 * Recovery: Restart worker or redistribute tasks
 */
export const WorkerTerminatedError = defineError<{
  readonly workerType: string
  readonly workerId: string
  readonly reason?: string
  readonly activeTasks: string[]
}>('WorkerTerminatedError', SystemError, 'retry', 'high')

/**
 * Worker data transfer failed
 * Recovery: Use smaller chunks or alternative serialization
 */
export const WorkerDataTransferError = defineError<{
  readonly operation: 'send' | 'receive'
  readonly dataType: string
  readonly dataSize: number
  readonly reason: string
}>('WorkerDataTransferError', SystemError, 'retry', 'medium')

/**
 * Worker timeout exceeded
 * Recovery: Terminate worker and retry or use fallback
 */
export const WorkerTimeoutError = defineError<{
  readonly workerType: string
  readonly taskType: string
  readonly timeoutMs: number
  readonly elapsedMs: number
}>('WorkerTimeoutError', SystemError, 'retry', 'medium')
