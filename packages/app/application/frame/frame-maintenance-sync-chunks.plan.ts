import type { Position } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world'
import { Option } from 'effect'

export type MaintenanceChunkSyncInput = {
  readonly playerPos: Position
  readonly renderDistance: number
  readonly chunkStreamingEnabled: boolean
  readonly chunkSceneSyncEnabled: boolean
  readonly cx: number
  readonly cz: number
}

export type MaintenanceChunkSyncPlan = {
  readonly shouldRefreshChunks: boolean
}

export type MaintenanceChunkSceneSyncPlan = {
  readonly chunksChanged: boolean
  readonly shouldSyncWorld: boolean
}

export const resolveMaintenanceChunkSyncPlan = (
  input: MaintenanceChunkSyncInput,
  chunkSyncPending: boolean,
  lastChunkStreaming: { readonly cx: number; readonly cz: number; readonly renderDistance: number },
): MaintenanceChunkSyncPlan => ({
  shouldRefreshChunks:
    input.chunkStreamingEnabled &&
    (chunkSyncPending ||
      lastChunkStreaming.cx !== input.cx ||
      lastChunkStreaming.cz !== input.cz ||
      lastChunkStreaming.renderDistance !== input.renderDistance),
})

export const resolveMaintenanceChunkSceneSyncPlan = (
  chunkSyncPending: boolean,
  lastLoadedChunks: Option.Option<ReadonlyArray<Chunk>>,
  loadedChunks: ReadonlyArray<Chunk>,
): MaintenanceChunkSceneSyncPlan => {
  const lastLoadedChunksValue = Option.getOrNull(lastLoadedChunks)
  const chunksChanged = lastLoadedChunksValue === null || lastLoadedChunksValue !== loadedChunks

  return {
    chunksChanged,
    shouldSyncWorld: chunkSyncPending || chunksChanged,
  }
}
