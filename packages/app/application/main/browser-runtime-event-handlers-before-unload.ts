import { Effect, MutableRef } from 'effect'

type BrowserBeforeUnloadHandlerDeps = {
  readonly pendingSaveDirtyChunksRef: MutableRef.MutableRef<boolean>
  readonly bestEffortSave?: Effect.Effect<void, never>
}

export const createBrowserBeforeUnloadHandler = ({
  pendingSaveDirtyChunksRef,
  bestEffortSave,
}: BrowserBeforeUnloadHandlerDeps): (() => void) => {
  return () => {
    MutableRef.set(pendingSaveDirtyChunksRef, true)
    if (bestEffortSave) Effect.runFork(bestEffortSave)
  }
}
