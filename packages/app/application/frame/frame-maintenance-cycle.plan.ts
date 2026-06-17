import { Option } from 'effect'

export type MaintenanceCycleContinuationInput = {
  readonly didLoadChunks: boolean
  readonly chunkSyncPending: boolean
  readonly flushedDirtyChunkCount: number
  readonly simulationResult: {
    readonly despawnedCount: number
    readonly spawnResult: Option.Option<unknown>
  }
}

export const shouldContinueMaintenanceCycle = (
  input: MaintenanceCycleContinuationInput,
): boolean =>
  input.didLoadChunks ||
  input.chunkSyncPending ||
  input.flushedDirtyChunkCount > 0 ||
  input.simulationResult.despawnedCount > 0 ||
  Option.isSome(input.simulationResult.spawnResult)
