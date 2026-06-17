import { MutableRef } from 'effect'

type BrowserBeforeUnloadHandlerDeps = {
  readonly pendingSaveDirtyChunksRef: MutableRef.MutableRef<boolean>
}

export const createBrowserBeforeUnloadHandler = ({
  pendingSaveDirtyChunksRef,
}: BrowserBeforeUnloadHandlerDeps): (() => void) => {
  return () => {
    MutableRef.set(pendingSaveDirtyChunksRef, true)
  }
}
