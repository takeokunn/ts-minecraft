import { Effect, MutableRef } from 'effect'
import { performAutoSaveTick } from '@ts-minecraft/app/main/session-autosave'
import type { AutoSaveStatusReporter } from '@ts-minecraft/app/main/session-autosave'
import type { ChunkManagerService } from '@ts-minecraft/world'

export type FlushPendingSavesDeps = {
  readonly pendingSaveDirtyChunksRef: MutableRef.MutableRef<boolean>
  readonly chunkManagerService: ChunkManagerService
  readonly persistSessionState: Effect.Effect<void, never>
  readonly reportAutoSaveStatus?: AutoSaveStatusReporter
}

export const flushPendingSaves = ({
  pendingSaveDirtyChunksRef,
  chunkManagerService,
  persistSessionState,
  reportAutoSaveStatus,
}: FlushPendingSavesDeps): Effect.Effect<void, never> => Effect.suspend(() => {
  const pendingSaveDirtyChunks = MutableRef.get(pendingSaveDirtyChunksRef)
  MutableRef.set(pendingSaveDirtyChunksRef, false)
  if (!pendingSaveDirtyChunks) return Effect.void

  // Shares the autosave-daemon tick so lifecycle flushes and periodic saves keep
  // identical error handling, persistence ordering, and status reporting.
  return performAutoSaveTick(
    chunkManagerService.saveDirtyChunks(),
    persistSessionState,
    reportAutoSaveStatus,
  )
})
