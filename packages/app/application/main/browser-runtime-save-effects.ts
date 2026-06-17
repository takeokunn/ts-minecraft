import { Effect, MutableRef } from 'effect'
import { performAutoSaveTick } from '@ts-minecraft/app/main/session-autosave'
import type { ChunkManagerService } from '@ts-minecraft/world'

export const flushPendingSaves = ({
  pendingSaveDirtyChunksRef,
  chunkManagerService,
  persistSessionState,
}: Pick<{ readonly pendingSaveDirtyChunksRef: MutableRef.MutableRef<boolean>; readonly chunkManagerService: ChunkManagerService; readonly persistSessionState: Effect.Effect<void, never> }, 'pendingSaveDirtyChunksRef' | 'chunkManagerService' | 'persistSessionState'>): Effect.Effect<void, never> => {
  const pendingSaveDirtyChunks = MutableRef.get(pendingSaveDirtyChunksRef)
  MutableRef.set(pendingSaveDirtyChunksRef, false)
  if (!pendingSaveDirtyChunks) return Effect.void

  // Shares the autosave-daemon tick: persist chunks + session together, swallowing
  // (and now LOGGING) any failure. Previously this path silently dropped errors; the
  // shared helper keeps a single source for the Effect.all + catchAllCause shape.
  return performAutoSaveTick(chunkManagerService.saveDirtyChunks(), persistSessionState)
}
